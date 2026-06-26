# audit-framework

Technology-agnostic **audit logging, notification & case-management** core for
Python services. A pipe-and-filter audit pipeline plus a ports-and-adapters
plugin system — with **zero runtime dependencies**.

> Extracted from the AI-Boilerplate monorepo to become a standalone package
> published to PyPI. The core (`audit_framework.core`) depends only on the
> Python standard library. Every infrastructure concern (database, identity
> provider, SIEM sink, notification channel, case backend) lives behind a
> `Protocol` and ships as a separate plugin.

## Why

Applications in regulated/defence contexts need to record *who did what, when,
to which resource*, fan those events out to SIEM platforms, notify the right
people in real time, and escalate incidents into case management — **without
coupling core logic to any specific database, IdP, or SIEM**. Customers must be
able to swap any component out. This package is that core.

## Install

```bash
pip install audit-framework
```

Plugins (Postgres store, Keycloak identity, SSE push, JSONL/Splunk/ELK sinks,
…) are installed separately and discovered at runtime — see
[Plugins](#plugins).

## Architecture at a glance

```
Event
  → AuditPolicyMiddleware   — decide IF/HOW to record (or halt)
  → RedactMiddleware        — strip sensitive fields (per selected policy + base_fields)
  → StoreMiddleware         — append to the audit store
  → SinkFanOutMiddleware    — fan out to SIEM/file sinks (parallel, best-effort)
  → BroadcastPolicyMiddleware — produce NotificationDirectives
  → DispatchMiddleware      — render + deliver over channels
  → EscalationMiddleware    — emit escalation.requested onto the event bus
```

> Redaction runs **after** policy selection so a policy's `redact_fields` are
> honoured; add a second `RedactMiddleware(base_fields=[...])` at the front if
> you need pre-policy scrubbing of always-sensitive fields.

Two **independent** policy layers are evaluated per event (audit ≠ broadcast).
Fan-out (many sinks, many channels) happens *inside* a middleware via
`asyncio.gather`, never by branching the chain. Bounded contexts (e.g. case
management) communicate over an in-process `EventBus` — upgradeable to
PostgreSQL `LISTEN/NOTIFY`, Redis, or NATS without touching the core.

### Layout

```
src/audit_framework/core/
├── models.py            # AuditEvent, policies, notifications, PipelineContext (frozen)
├── ports.py             # every Protocol: stores, identity, channels, sinks, bus, ...
├── pipeline.py          # Pipeline + AuditMiddleware protocol (the chain orchestrator)
├── policy_engine.py     # PolicyMatcher, AuditPolicyEngine, BroadcastPolicyEngine
├── dispatcher.py        # routes directives → channels (render, persist, deliver)
├── decorators.py        # @auditable — the primary developer-facing API
├── plugin_registry.py   # PluginRegistry (entry-point + config discovery)
└── middlewares/         # the seven built-in middlewares
```

## Quickstart

The core is fully runnable with in-memory adapters — no infrastructure required.

```python
import asyncio
from audit_framework.core import (
    AuditEvent, AuditPolicy, BroadcastPolicy, BroadcastTarget, Pipeline,
)
from audit_framework.core.middlewares import (
    AuditPolicyMiddleware, BroadcastPolicyMiddleware, StoreMiddleware,
)
# ... bring your own (or in-memory) adapters implementing the ports ...

policy_store = MyPolicyStore(
    audit=[AuditPolicy(name="writes", match={"action": ["CREATE", "UPDATE", "DELETE"]})],
    broadcast=[BroadcastPolicy(
        name="notify-admins",
        match={"action": ["DELETE"]},
        targets=[BroadcastTarget(type="role", value="admin", channels=["in_app"])],
    )],
)

pipeline = (
    Pipeline()
    .use(AuditPolicyMiddleware(policy_store))
    .use(StoreMiddleware(my_audit_store))
    .use(BroadcastPolicyMiddleware(policy_store, my_identity_resolver))
    # ... dispatch, sinks, escalation ...
)

event = AuditEvent(
    actor_id="alice", action="DELETE", resource_type="contract",
    resource_id="c-42", timestamp="2026-06-26T00:00:00+00:00", request_id="req-1",
)
context = asyncio.run(pipeline.execute(event))
print(context.stored_id, len(context.directives))
```

### The `@auditable` decorator (recommended)

Annotate service methods and forget about audit plumbing — ambient
`actor_id`/`request_id` are read from `contextvars` your web middleware sets:

```python
from audit_framework.core import auditable, set_pipeline_provider

set_pipeline_provider(lambda: pipeline)  # done once at startup

class ContractService:
    @auditable(action="UPDATE", resource_type="contract", resource_id="contract_id")
    async def update(self, contract_id: str, **changes) -> Contract:
        ...
```

The event is emitted only **after** the method returns successfully — a raising
call is never recorded as a completed action.

## Ports

Every external capability is a `runtime_checkable` `Protocol` in
[`ports.py`](src/audit_framework/core/ports.py):

| Category | Ports |
|---|---|
| Storage | `AuditStore`, `NotificationStore`, `PolicyStore` |
| Identity | `IdentityResolver`, `ResourceOwnerResolver` |
| Delivery | `NotificationChannel`, `RealtimePush` |
| Sinks | `ExternalSink` |
| Case management | `CaseBackend`, `CaseRepository`, `AlertPublisher` |
| Infrastructure | `EventBus`, `Subscription`, `TemplateRenderer`, `ThrottleStore`, `Redactor` |

## Plugins

A plugin is any package that implements one or more ports and exposes a
`register(registry)` function. Two discovery mechanisms:

```python
# my_plugin/plugin.py
def register(registry):
    registry.register("audit_store", "postgres", PostgresAuditStore)
    registry.register("external_sink", "splunk_hec", SplunkHECSink)
```

```toml
# my_plugin/pyproject.toml — entry-point discovery
[project.entry-points."audit_framework.plugins"]
postgres = "my_plugin.plugin:register"
```

```python
registry = PluginRegistry()
registry.discover_entrypoints()                 # via installed entry points
registry.load_from_config(["my_plugin.plugin"]) # via explicit module paths
store = registry.get("audit_store", "postgres")
```

## Development

```bash
pip install -e ".[dev]"
pytest                  # 48 stdlib-only tests, no infrastructure needed
```

The core test-suite drives coroutines with `asyncio.run` and uses in-memory
fakes for every port (see `tests/core/fakes.py`), so it needs nothing but
`pytest`.

## Roadmap

The zero-dependency **core** (this package — pipeline, middlewares, policy
engine, dispatcher, plugin registry, `@auditable`) is implemented and tested.
Planned companion plugin packages, each a separate adapter behind the existing
ports:

- `audit-framework-postgres` — `AuditStore`, `NotificationStore`, PG `LISTEN/NOTIFY` `EventBus`
- `audit-framework-keycloak` — `IdentityResolver` (Admin API + TTL cache)
- `audit-framework-sse` — `RealtimePush` / in-app SSE `NotificationChannel`
- `audit-framework-sinks` — JSONL / Splunk HEC / ELK / syslog `ExternalSink`s
- `audit-framework-yaml` — hot-reloadable YAML `PolicyStore`
- `audit-framework-fastapi` — ASGI middleware, SSE + REST endpoints, bootstrap wiring
- case-management bounded context (hexagonal) consuming `escalation.requested`

See [`docs/AUDIT_NOTIFICATION_SPEC.md`](docs/AUDIT_NOTIFICATION_SPEC.md) for the
full architecture specification.

## License

MIT
