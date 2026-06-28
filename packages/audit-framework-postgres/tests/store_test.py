"""Tests for PostgresAuditStore + schema — stdlib-only, fake executor (no DB)."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

import pytest

from audit_framework.core.models import AuditEvent, AuditPolicy, PipelineContext
from audit_framework.core.ports import AuditStore
from audit_framework.core.plugin_registry import PluginRegistry

from audit_framework_postgres.plugin import register
from audit_framework_postgres.schema import schema_sql
from audit_framework_postgres.store import PostgresAuditStore


def _event(resource_id: str = "c-1", **kw) -> AuditEvent:
    base = dict(
        actor_id="alice",
        action="DELETE",
        resource_type="contract",
        resource_id=resource_id,
        timestamp="2026-06-26T00:00:00+00:00",
        request_id="req-1",
        changes={"amount": {"old": 1, "new": 2}},
        ip_address="10.0.0.1",
    )
    base.update(kw)
    return AuditEvent(**base)


def _ctx(event: AuditEvent, policy: AuditPolicy | None = None) -> PipelineContext:
    ctx = PipelineContext(event=event)
    ctx.audit_policy = policy
    return ctx


class FakeExecutor:
    def __init__(self, *, fetchval=7, fetch=None, raises=None) -> None:
        self.calls: list[tuple] = []
        self._fetchval = fetchval
        self._fetch = fetch if fetch is not None else []
        self._raises = raises

    async def fetchval(self, query, *args):
        self.calls.append(("fetchval", query, args))
        if self._raises:
            raise self._raises
        return self._fetchval

    async def fetch(self, query, *args):
        self.calls.append(("fetch", query, args))
        if self._raises:
            raise self._raises
        return list(self._fetch)

    async def execute(self, query, *args):
        self.calls.append(("execute", query, args))
        return "OK"


def test_satisfies_audit_store_protocol() -> None:
    store = PostgresAuditStore(FakeExecutor())
    assert isinstance(store, AuditStore)


def test_append_returns_row_id_and_binds_values() -> None:
    ex = FakeExecutor(fetchval=42)
    store = PostgresAuditStore(ex)
    ev = _event("c-9")

    row_id = asyncio.run(store.append(_ctx(ev)))

    assert row_id == "42"
    kind, sql, args = ex.calls[0]
    assert kind == "fetchval"
    assert "INSERT INTO audit_log" in sql
    assert "RETURNING id" in sql
    # values are bound, not interpolated
    assert args[0] == "2026-06-26T00:00:00+00:00"  # timestamp
    assert args[1] == "alice" and args[2] == "DELETE"
    assert args[4] == "c-9"  # resource_id
    assert json.loads(args[5]) == {"amount": {"old": 1, "new": 2}}  # changes as JSON text
    assert args[8] == "10.0.0.1"  # ip_address (TEXT, survives a redaction mask too)


def test_append_includes_audit_policy_fields() -> None:
    ex = FakeExecutor()
    store = PostgresAuditStore(ex)
    policy = AuditPolicy(name="contracts", match={}, detail_level="full", retention_days=90)

    asyncio.run(store.append(_ctx(_event(), policy)))

    args = ex.calls[0][2]
    assert args[9] == "full"  # detail_level
    assert args[10] == "contracts"  # policy_name
    assert args[11] == 90  # retention_days


def test_append_coerces_non_json_native_values() -> None:
    ex = FakeExecutor()
    store = PostgresAuditStore(ex)
    ev = _event(metadata={"at": datetime(2026, 6, 26, tzinfo=timezone.utc)})

    asyncio.run(store.append(_ctx(ev)))

    metadata_json = ex.calls[0][2][6]
    assert isinstance(metadata_json, str)
    assert "2026-06-26" in json.loads(metadata_json)["at"]


def test_query_builds_parameterized_where() -> None:
    ex = FakeExecutor(fetch=[])
    store = PostgresAuditStore(ex)

    asyncio.run(
        store.query(
            {"actor_id": "alice", "action": "DELETE", "from": "t0", "to": "t1"},
            offset=5,
            limit=20,
        )
    )

    _, sql, args = ex.calls[0]
    assert "WHERE actor_id = $1 AND action = $2" in sql
    assert "timestamp >= $3::timestamptz AND timestamp <= $4::timestamptz" in sql
    assert "LIMIT $5 OFFSET $6" in sql
    assert list(args) == ["alice", "DELETE", "t0", "t1", 20, 5]


def test_query_without_filters_has_no_where() -> None:
    ex = FakeExecutor(fetch=[])
    store = PostgresAuditStore(ex)

    asyncio.run(store.query({}, offset=0, limit=10))

    _, sql, args = ex.calls[0]
    assert "WHERE" not in sql
    assert list(args) == [10, 0]


def test_query_rejects_unknown_filter_key() -> None:
    store = PostgresAuditStore(FakeExecutor())
    with pytest.raises(ValueError):
        asyncio.run(store.query({"actor_id; DROP TABLE audit_log": "x"}))


def test_query_decodes_json_and_timestamp() -> None:
    rows = [
        {
            "id": 1,
            "actor_id": "alice",
            "changes": '{"amount": {"old": 1, "new": 2}}',
            "metadata": "{}",
            "timestamp": datetime(2026, 6, 26, tzinfo=timezone.utc),
        }
    ]
    store = PostgresAuditStore(FakeExecutor(fetch=rows))

    result = asyncio.run(store.query({}))

    assert result[0]["changes"] == {"amount": {"old": 1, "new": 2}}
    assert result[0]["metadata"] == {}
    assert result[0]["timestamp"] == "2026-06-26T00:00:00+00:00"


def test_get_by_resource_orders_chronologically() -> None:
    ex = FakeExecutor(fetch=[])
    store = PostgresAuditStore(ex)

    asyncio.run(store.get_by_resource("contract", "c-1"))

    _, sql, args = ex.calls[0]
    assert "WHERE resource_type = $1 AND resource_id = $2" in sql
    assert "ORDER BY timestamp ASC" in sql
    assert list(args) == ["contract", "c-1"]


def test_health_check_true_then_false() -> None:
    assert asyncio.run(PostgresAuditStore(FakeExecutor()).health_check()) is True
    down = PostgresAuditStore(FakeExecutor(raises=RuntimeError("no db")))
    assert asyncio.run(down.health_check()) is False


def test_invalid_table_name_rejected() -> None:
    with pytest.raises(ValueError):
        PostgresAuditStore(FakeExecutor(), table="audit_log; DROP TABLE users")
    # valid plain and schema-qualified names are accepted
    PostgresAuditStore(FakeExecutor(), table="audit_log")
    PostgresAuditStore(FakeExecutor(), table="audit.audit_log")


def test_register_wires_store_into_registry() -> None:
    registry = PluginRegistry()
    register(registry)
    assert registry.get("audit_store", "postgres") is PostgresAuditStore


def test_schema_sql_is_append_only_with_compact_notify() -> None:
    sql = schema_sql(app_role="app_user")
    assert "CREATE TABLE IF NOT EXISTS audit_log" in sql
    # compact NOTIFY: identifiers only, never the unbounded changes diff
    assert "pg_notify('audit_events'" in sql
    assert "NEW.changes" not in sql
    # append-only: REVOKE + guard trigger
    assert "REVOKE UPDATE, DELETE ON audit_log FROM app_user" in sql
    assert "BEFORE UPDATE OR DELETE ON audit_log" in sql
    # request_id / ip_address are TEXT (not UUID/INET) to tolerate the model
    assert "request_id      TEXT" in sql
    assert "ip_address      TEXT" in sql


def test_schema_sql_rejects_bad_identifiers() -> None:
    with pytest.raises(ValueError):
        schema_sql(table="audit_log; DROP TABLE users")
    with pytest.raises(ValueError):
        schema_sql(app_role="role; GRANT ALL")


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
