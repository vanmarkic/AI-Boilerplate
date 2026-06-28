"""PostgresAuditStore — the append-only ``AuditStore`` backed by PostgreSQL.

This is the authoritative system of record for the audit log (distinct from the
best-effort ``ExternalSink`` fan-out): an append-only ``audit_log`` table that is
also queryable to back an admin audit-log view.

Like the other adapters, it carries **no hard driver dependency**: all database
access goes through an injected :class:`Executor` (whose method set
``fetchval``/``fetch``/``execute`` is satisfied structurally by an
``asyncpg`` pool or connection), so the SQL logic is fully unit-testable without
a live database. ``asyncpg`` is only needed to construct a real pool.

SQL-injection posture: the table name is validated against a strict identifier
whitelist at construction; every value is a bound ``$n`` parameter; and query
filters are mapped through a fixed column allow-list (unknown keys raise). The
only interpolation is the validated table name (Postgres does not allow an
identifier to be a bind parameter), so the ``# nosemgrep`` markers below are
justified.
"""

from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Any, Awaitable, Mapping, Optional, Protocol, runtime_checkable

from audit_framework.core.models import PipelineContext

__all__ = ["PostgresAuditStore", "Executor"]

_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$")

# Query filter key -> column. Anything not listed is rejected (no interpolation).
_FILTER_COLUMNS = {
    "actor_id": "actor_id",
    "action": "action",
    "resource_type": "resource_type",
    "resource_id": "resource_id",
    "request_id": "request_id",
}
# Range filters map to a comparison on the timestamp column.
_RANGE_FILTERS = {"from": ">=", "to": "<="}
_JSON_COLUMNS = ("changes", "metadata")


@runtime_checkable
class Executor(Protocol):
    """The subset of the asyncpg pool/connection API the store relies on."""

    def fetchval(self, query: str, *args: Any) -> Awaitable[Any]: ...

    def fetch(self, query: str, *args: Any) -> Awaitable[list[Any]]: ...

    def execute(self, query: str, *args: Any) -> Awaitable[Any]: ...


def _validate_identifier(name: str) -> str:
    if not _IDENTIFIER.match(name):
        raise ValueError(f"invalid table identifier: {name!r}")
    return name


def _json_text(value: Any) -> str:
    """Serialise a bag to JSON text, coercing non-native values (datetime/...)."""
    return json.dumps(value, default=str)


class PostgresAuditStore:
    """Append-only :class:`~audit_framework.core.ports.AuditStore` on PostgreSQL."""

    def __init__(self, executor: Executor, *, table: str = "audit_log") -> None:
        self._db = executor
        self._table = _validate_identifier(table)

    async def append(self, context: PipelineContext) -> str:
        """Insert the (sanitised) event and return its new row id as a string."""
        e = context.event
        p = context.audit_policy
        # nosemgrep -- table name is whitelist-validated; all values are bound $n params.
        sql = (
            f"INSERT INTO {self._table} "  # nosec B608  # nosemgrep
            "(timestamp, actor_id, action, resource_type, resource_id, changes, "
            "metadata, request_id, ip_address, detail_level, policy_name, retention_days) "
            "VALUES ($1::timestamptz, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, "
            "$10, $11, $12) RETURNING id"
        )
        row_id = await self._db.fetchval(
            sql,
            e.timestamp,
            e.actor_id,
            e.action,
            e.resource_type,
            e.resource_id,
            _json_text(e.changes),
            _json_text(e.metadata),
            e.request_id,
            e.ip_address,
            p.detail_level if p else None,
            p.name if p else None,
            p.retention_days if p else None,
        )
        return str(row_id)

    async def query(
        self, filters: dict[str, Any], offset: int = 0, limit: int = 100
    ) -> list[dict[str, Any]]:
        """Return stored events matching ``filters``, newest first (paginated)."""
        clauses: list[str] = []
        params: list[Any] = []
        for key, value in filters.items():
            if key in _FILTER_COLUMNS:
                params.append(value)
                clauses.append(f"{_FILTER_COLUMNS[key]} = ${len(params)}")
            elif key in _RANGE_FILTERS:
                params.append(value)
                clauses.append(f"timestamp {_RANGE_FILTERS[key]} ${len(params)}::timestamptz")
            else:
                raise ValueError(f"unknown audit query filter: {key!r}")
        where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
        params.append(limit)
        limit_ph = f"${len(params)}"
        params.append(offset)
        offset_ph = f"${len(params)}"
        # nosemgrep -- validated table name + bound params; `where` is built only
        # from the fixed column allow-list above, never from raw filter keys.
        sql = (
            f"SELECT * FROM {self._table}{where} "  # nosec B608  # nosemgrep
            f"ORDER BY timestamp DESC, id DESC LIMIT {limit_ph} OFFSET {offset_ph}"
        )
        rows = await self._db.fetch(sql, *params)
        return [self._row_to_dict(row) for row in rows]

    async def get_by_resource(
        self, resource_type: str, resource_id: str
    ) -> list[dict[str, Any]]:
        """Return all stored events for one resource, in chronological order."""
        # nosemgrep -- validated table name; resource type/id are bound $n params.
        sql = (
            f"SELECT * FROM {self._table} "  # nosec B608  # nosemgrep
            "WHERE resource_type = $1 AND resource_id = $2 ORDER BY timestamp ASC, id ASC"
        )
        rows = await self._db.fetch(sql, resource_type, resource_id)
        return [self._row_to_dict(row) for row in rows]

    async def health_check(self) -> bool:
        """Return True if the audit table is reachable."""
        try:
            # nosemgrep -- validated table name; no user input in this statement.
            await self._db.fetchval(f"SELECT 1 FROM {self._table} LIMIT 1")  # nosec B608  # nosemgrep
            return True
        except Exception:
            return False

    @staticmethod
    def _row_to_dict(row: Mapping[str, Any]) -> dict[str, Any]:
        data = dict(row)
        for column in _JSON_COLUMNS:
            value = data.get(column)
            if isinstance(value, str):
                try:
                    data[column] = json.loads(value)
                except (ValueError, TypeError):
                    pass
        ts = data.get("timestamp")
        if isinstance(ts, datetime):
            data["timestamp"] = ts.isoformat()
        return data
