# audit-framework-postgres

The **append-only PostgreSQL `AuditStore`** for
[`audit-framework`](../audit-framework) — the *authoritative, queryable system
of record* for the audit log (as opposed to the best-effort `ExternalSink`
fan-out). Ships the `audit_log` schema, a compact `LISTEN/NOTIFY` trigger, and
append-only guards.

## Install

```bash
pip install audit-framework-postgres            # bring your own executor
pip install audit-framework-postgres[asyncpg]   # + asyncpg for a real pool
```

## Use

```python
import asyncpg
from audit_framework_postgres import PostgresAuditStore, apply_schema
from audit_framework.core.middlewares.store import StoreMiddleware

pool = await asyncpg.create_pool(dsn, min_size=5, max_size=20)
await apply_schema(pool, app_role="app_user")     # create table + triggers (run once, as a privileged role)

store = PostgresAuditStore(pool)                  # the asyncpg pool *is* the executor
pipeline.use(StoreMiddleware(store))              # now events are persisted authoritatively
```

Query it back (this is what backs an admin audit-log view — sinks can't do this):

```python
await store.query({"actor_id": "alice", "action": "DELETE", "from": "2026-06-01", "to": "2026-07-01"},
                  offset=0, limit=50)
await store.get_by_resource("contract", "c-42")
```

It advertises itself as the `postgres` audit store via the
`audit_framework.plugins` entry point, so it's discoverable through the registry.

## No hard driver dependency

All DB access goes through an injected **`Executor`** — anything exposing
`fetchval` / `fetch` / `execute` (an `asyncpg` pool or connection satisfies this
structurally). So the SQL logic is fully unit-testable without a database
(14 stdlib-only tests use a fake executor), and you control pooling.

## Schema design (validated against PostgreSQL guidance)

`schema_sql()` / `apply_schema()` emit:

- an **append-only `audit_log`** table — `REVOKE UPDATE, DELETE` from the app
  role **and** a `BEFORE UPDATE OR DELETE` guard trigger that raises, so the log
  is immutable even for the table owner (only a superuser can bypass it). Run
  the app under an **unprivileged, non-owning** role that can only `INSERT`/`SELECT`;
- a **compact `AFTER INSERT` `pg_notify`** trigger on channel `audit_events` that
  sends **identifiers only** — never the unbounded `changes` diff — so every
  payload stays well under PostgreSQL's hard **8000-byte `NOTIFY` limit**.
  A `LISTEN` consumer fetches the full row by id when it needs detail (this is
  also the upgrade path to the multi-worker event bus, AD-6);
- `request_id` / `ip_address` as **`TEXT`** (not `UUID`/`INET`), because the
  event model treats them as free-form strings and redaction can replace
  `ip_address` with a mask.

> **Tamper-evidence:** `REVOKE` + guards make the log *append-only*, but a
> superuser can still rewrite history. For tamper-*detection*, add per-row hash
> chaining (`prev_hash`/`hash`) on top — a natural follow-up.

### SQL-injection posture
The table name is validated against a strict identifier whitelist at
construction; every value is a bound `$n` parameter; query filters are mapped
through a fixed column allow-list (unknown keys raise `ValueError`). The only
interpolation is the validated table name (Postgres can't bind an identifier as
a parameter).

## Development

```bash
pip install -e ".[dev]"
pytest        # 14 stdlib-only tests (fake executor; no database needed)
```

A live-DB integration test (real `asyncpg` + a throwaway Postgres) is the
recommended next layer; the unit suite already pins the generated SQL, the
parameter binding, the append-only DDL, and the compact-notify payload.

## License

MIT
