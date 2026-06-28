"""DDL for the append-only ``audit_log`` table, notify trigger and guards.

Design notes (validated against PostgreSQL guidance):

* **Append-only** — ``REVOKE UPDATE, DELETE`` from the application role *and* a
  ``BEFORE UPDATE OR DELETE`` guard trigger that raises, so the table stays
  immutable even for the table owner (only a superuser can bypass it). For
  tamper-*evidence* (detecting changes a superuser could still make), add row
  hash-chaining on top — see the README.
* **Compact NOTIFY** — the ``AFTER INSERT`` trigger emits *identifiers only*
  (no ``changes`` diff), keeping every payload far under PostgreSQL's hard
  8000-byte ``NOTIFY`` limit; consumers fetch the full row by id if needed.
* ``request_id``/``ip_address`` are ``TEXT`` (not ``UUID``/``INET``) because the
  event model treats them as free-form strings and redaction may replace
  ``ip_address`` with a mask value.

``schema_sql()`` returns the DDL as one script; ``apply_schema()`` runs it.
"""

from __future__ import annotations

import re
from typing import Any, Awaitable, Optional

__all__ = ["schema_sql", "apply_schema"]

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
NOTIFY_CHANNEL = "audit_events"


def _ident(name: str, what: str) -> str:
    if not _IDENTIFIER.match(name):
        raise ValueError(f"invalid {what}: {name!r}")
    return name


def schema_sql(*, table: str = "audit_log", app_role: Optional[str] = None) -> str:
    """Return the full DDL script for the audit table, triggers and (optional) REVOKE.

    ``app_role`` — when given, ``REVOKE UPDATE, DELETE`` is emitted for that role
    (it must already be a valid SQL identifier). Run this script as a privileged
    role that the application does *not* use, so the app role can only INSERT.
    """
    t = _ident(table, "table name")
    parts = [
        f"""
CREATE TABLE IF NOT EXISTS {t} (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT NOT NULL,
    changes         JSONB,
    metadata        JSONB,
    request_id      TEXT,
    ip_address      TEXT,
    detail_level    TEXT,
    policy_name     TEXT,
    retention_days  INT
);
""".strip(),
        f"CREATE INDEX IF NOT EXISTS {t}_resource_idx ON {t} (resource_type, resource_id);",
        f"CREATE INDEX IF NOT EXISTS {t}_actor_idx ON {t} (actor_id);",
        f"CREATE INDEX IF NOT EXISTS {t}_ts_idx ON {t} (timestamp DESC);",
        f"""
CREATE OR REPLACE FUNCTION {t}_notify() RETURNS trigger AS $$
BEGIN
    -- Identifiers only: stays well under the 8000-byte NOTIFY limit. The
    -- unbounded `changes` diff is intentionally excluded; a consumer fetches
    -- the full row by id from the audit store when it needs detail.
    PERFORM pg_notify('{NOTIFY_CHANNEL}', json_build_object(
        'id',            NEW.id,
        'actor_id',      NEW.actor_id,
        'action',        NEW.action,
        'resource_type', NEW.resource_type,
        'resource_id',   NEW.resource_id,
        'timestamp',     NEW.timestamp::text,
        'request_id',    NEW.request_id
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
""".strip(),
        f"DROP TRIGGER IF EXISTS {t}_notify_trg ON {t};",
        f"CREATE TRIGGER {t}_notify_trg AFTER INSERT ON {t} "
        f"FOR EACH ROW EXECUTE FUNCTION {t}_notify();",
        f"""
CREATE OR REPLACE FUNCTION {t}_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit log % is append-only: % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;
""".strip(),
        f"DROP TRIGGER IF EXISTS {t}_immutable_trg ON {t};",
        f"CREATE TRIGGER {t}_immutable_trg BEFORE UPDATE OR DELETE ON {t} "
        f"FOR EACH ROW EXECUTE FUNCTION {t}_immutable();",
    ]
    if app_role is not None:
        role = _ident(app_role, "app role")
        parts.append(f"REVOKE UPDATE, DELETE ON {t} FROM {role};")
    return "\n\n".join(parts) + "\n"


def apply_schema(
    executor: Any, *, table: str = "audit_log", app_role: Optional[str] = None
) -> Awaitable[Any]:
    """Execute :func:`schema_sql` via an executor (e.g. an asyncpg connection)."""
    return executor.execute(schema_sql(table=table, app_role=app_role))
