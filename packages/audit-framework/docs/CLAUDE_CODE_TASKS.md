# Claude Code Task Prompt — Audit & Notification System

> **Usage:** Place `AUDIT_NOTIFICATION_SPEC.md` in your project root (or `docs/`).
> Then paste one of the task blocks below into Claude Code, adapting paths to your project structure.
> Work incrementally — one task block per session, verify, then move to the next.

---

## Task 0 — Read and Internalise (Always Start Here)

```
Read the file docs/AUDIT_NOTIFICATION_SPEC.md in full. This is the architecture spec
for an audit logging, notification, and case management system.

Before writing any code, confirm you understand the key decisions:
1. The audit pipeline uses pipe-and-filter (middleware chain) + event bus for fan-out.
2. Case management uses hexagonal/clean architecture.
3. The two are connected via an in-process event bus.
4. Every external integration is behind a Protocol (port). The core has zero deps beyond stdlib.
5. Policies (what to audit, what to broadcast) are YAML-driven and hot-reloadable.

Summarise any conflicts you see with the existing codebase before proceeding.
```

---

## Task 1 — Core Models + Ports (No Infrastructure)

```
Referencing docs/AUDIT_NOTIFICATION_SPEC.md sections 4 and 5:

Create the core package at app/audit/core/ with:
- models.py — all domain models (AuditEvent, AuditPolicy, BroadcastPolicy,
  NotificationDirective, Notification, BroadcastTarget, ThrottleConfig,
  EscalationConfig, PipelineContext). All frozen dataclasses. Zero external deps.
- ports.py — all Protocol definitions (AuditStore, NotificationStore, PolicyStore,
  IdentityResolver, ResourceOwnerResolver, NotificationChannel, RealtimePush,
  ExternalSink, CaseBackend, EventBus, Subscription, TemplateRenderer,
  ThrottleStore, Redactor). All runtime_checkable.
- plugin_registry.py — PluginRegistry with register(), get(), list_providers(),
  discover_entrypoints(), load_from_config().

Constraints:
- Zero imports outside stdlib and typing.
- Every model must have a to_dict() method for serialisation.
- Add docstrings to every Protocol method explaining the contract.
- Add __all__ to each module.
- Write tests in tests/audit/core/ using only stdlib (no pytest fixtures needed,
  just plain assert). Test that models are immutable, registry raises on unknown
  provider, etc.
```

---

## Task 2 — Pipeline + Middlewares

```
Referencing docs/AUDIT_NOTIFICATION_SPEC.md section 3:

Create the pipeline orchestrator and built-in middlewares at app/audit/core/:
- pipeline.py — Pipeline class with use(middleware) and execute(event) methods.
  Middleware interface: process(event, context, next). The chain is linear;
  each middleware calls await next() to continue.
- middlewares/ directory with:
  - redact.py — RedactMiddleware (uses Redactor port)
  - audit_policy.py — AuditPolicyMiddleware (uses PolicyStore port, evaluates
    audit policies, sets context.audit_context or halts)
  - store.py — StoreMiddleware (uses AuditStore port, writes if audit context present)
  - sink_fanout.py — SinkFanOutMiddleware (uses ExternalSink ports, fan-out
    in parallel via asyncio.gather, best-effort, respects per-policy sink filtering)
  - broadcast.py — BroadcastPolicyMiddleware (uses PolicyStore + IdentityResolver +
    ThrottleStore, produces NotificationDirectives on context)
  - dispatch.py — DispatchMiddleware (uses NotificationChannel ports +
    TemplateRenderer + NotificationStore, delivers notifications)
  - escalation.py — EscalationMiddleware (emits escalation.requested to EventBus)

Also create:
- policy_engine.py — PolicyMatcher (static match logic), AuditPolicyEngine,
  BroadcastPolicyEngine. Consider using the `rule-engine` library for the
  matching expression language if already installed, otherwise implement
  simple dict matching as a starting point.
- dispatcher.py — Dispatcher class that routes directives to registered channels.
- decorators.py — @auditable decorator for service-layer methods.

Constraints:
- Every middleware depends only on ports (Protocols), never on concrete implementations.
- PipelineContext is a mutable bag that middlewares read/write to pass state
  down the chain. Define it in models.py.
- Fan-out (sinks, channels) uses asyncio.gather with return_exceptions=True.
- Write tests with fake implementations of each port. Test the full pipeline
  end-to-end with all middlewares chained.
```

---

## Task 3 — PostgreSQL Plugin

```
Referencing docs/AUDIT_NOTIFICATION_SPEC.md sections 5.1, 6, and 9:

Create the PostgreSQL plugin at app/audit/plugins/postgres/:
- audit_store.py — PostgresAuditStore implementing AuditStore port. Uses asyncpg
  or SQLAlchemy async (match whatever the existing project uses). Append-only.
- notification_store.py — PostgresNotificationStore implementing NotificationStore.
- event_bus.py — PgListenNotifyBus implementing EventBus using asyncpg LISTEN/NOTIFY.
- plugin.py — register() function that registers all three with the PluginRegistry.

Also create the Alembic migration for the audit_log and notifications tables
per the schema in section 9. Include the pg_notify trigger function.

Constraints:
- Match the existing project's DB session / connection pool patterns.
- audit_log table: REVOKE UPDATE, DELETE for the app user (add as a comment
  in migration with instructions).
- Add health_check query to the store (SELECT 1 from audit_log LIMIT 1).
```

---

## Task 4 — Keycloak Identity Resolver Plugin

```
Referencing docs/AUDIT_NOTIFICATION_SPEC.md section 5.2:

Create the Keycloak plugin at app/audit/plugins/keycloak/:
- resolver.py — KeycloakIdentityResolver implementing IdentityResolver port.
  Uses Keycloak Admin REST API via httpx.AsyncClient. Service account auth
  via client_credentials grant. Methods: resolve_group (by name → members),
  resolve_role (realm role → users), resolve_user (passthrough),
  get_user_contact (fetch user attributes for email/phone).
- cached_resolver.py — CachedIdentityResolver wrapping any IdentityResolver
  with TTL-based caching. Does NOT cache user or resource_owner lookups.
- plugin.py — register().

Constraints:
- Check if fastapi-keycloak-middleware is already in the project. If so,
  reuse its token/session management rather than duplicating.
- Token refresh: cache the service account token, refresh on 401.
- Pagination: Keycloak defaults to max=100. Handle pagination for large groups.
```

---

## Task 5 — SSE + FastAPI Integration

```
Referencing docs/AUDIT_NOTIFICATION_SPEC.md sections 2 (AD-4), 11, and 12:

Create the SSE and FastAPI integration at app/audit/:
- plugins/sse/channel.py — SSEConnectionManager (per-user asyncio.Queue management)
  and InAppSSEChannel implementing NotificationChannel.
- fastapi_integration/middleware.py — ASGI middleware that extracts user from
  request (via existing Keycloak auth) and sets contextvars for actor_id
  and request_id.
- fastapi_integration/endpoints.py — SSE stream endpoint (GET /notifications/stream),
  REST endpoints (GET /notifications, PATCH /notifications/{id}/read).
- fastapi_integration/bootstrap.py — setup_audit(app, config_path) function
  that reads YAML config, discovers plugins, wires the pipeline, and registers
  the lifespan, middleware, and routes on the FastAPI app.

Constraints:
- SSE endpoint must filter events to the authenticated user only.
- Include keepalive ping every 30 seconds.
- REST GET /notifications returns unread notifications for the current user.
- Match the existing project's auth dependency (Depends(get_current_user) or equivalent).
- Install sse-starlette if not present.
```

---

## Task 6 — YAML Policy Provider + Config

```
Referencing docs/AUDIT_NOTIFICATION_SPEC.md sections 2 (AD-3) and 7:

Create:
- plugins/yaml_policies/provider.py — YamlPolicyProvider implementing PolicyStore.
  Loads from YAML file, hot-reloads via watchfiles, thread-safe via reference swap.
- config/audit_config.yaml — complete config file with:
  - infrastructure section (postgres, keycloak, sse, file_jsonl sink)
  - audit policies for the existing project's entities (adapt to actual models)
  - broadcast policies (at least one example per target type: role, group, resource_owner)
  - env var placeholders for secrets

Constraints:
- ${ENV_VAR} interpolation in config values.
- Graceful handling of missing env vars (log warning, don't crash).
- On YAML parse error during hot reload: keep previous policies, log error.
- Install watchfiles and pyyaml if not present.
```

---

## Task 7 — External Sink: JSONL File (Simplest Sink)

```
Create app/audit/plugins/file_jsonl/:
- sink.py — JsonlFileSink implementing ExternalSink. Appends one JSON line per event
  to a file. Optional rotation (by date or size).
- plugin.py — register().

This is the simplest sink and serves as the reference implementation for
how to write an ExternalSink plugin. Include clear docstrings that a customer
could follow to write their own sink (Splunk HEC, ELK, syslog, etc.).
```

---

## Task 8 — Angular SSE Service + Notification Component

```
Referencing docs/AUDIT_NOTIFICATION_SPEC.md section 12:

Create Angular services and components:
- services/sse-notification.service.ts — wraps EventSource, exposes
  notifications$ as Observable, handles reconnection, passes auth token.
- components/notification-bell/ — bell icon with unread count badge,
  dropdown showing recent notifications, mark-as-read on click.
- Integrate with existing auth service for the token.
- On app init: connect to SSE stream + fetch unread via REST.

Constraints:
- Use existing Angular patterns and styling from the project.
- EventSource doesn't support custom headers; use withCredentials: true
  if cookies are used, or pass token as query param if JWT-based.
- Unsubscribe from SSE on component destroy.
- Handle reconnection gracefully (EventSource does this natively, but
  show a "reconnecting..." indicator if disconnected > 5s).
```

---

## Task 9 — Case Management Bounded Context (Hexagonal)

```
Referencing docs/AUDIT_NOTIFICATION_SPEC.md section 8:

Create app/case_management/ with hexagonal structure:
- domain/models.py — Case, Observable, Task, CaseStatus (enum with transition rules),
  Severity, Priority value objects. Case has methods: escalate(), assign(),
  transition_to() that return domain events.
- domain/events.py — CaseCreated, CaseAssigned, CaseSeverityEscalated,
  CaseStatusChanged.
- domain/services.py — CaseService (orchestrates domain logic).
- application/commands.py — CreateCaseFromAuditEvent, AssignCase, TransitionCase.
- application/handlers.py — CreateCaseHandler, AssignCaseHandler (use cases).
- application/event_handlers.py — handles escalation.requested from audit pipeline.
- ports/outbound.py — CaseBackend, CaseRepository, AlertPublisher (Protocols).
- adapters/postgres/ — simple CaseRepository using existing DB.

Wire into the event bus in bootstrap.py:
- event_bus.on("escalation.requested", create_case_handler.handle)
- Case lifecycle events flow back into audit pipeline.

Do NOT implement TheHive/Jira adapters yet — just the ports and the Postgres adapter.
```

---

## Usage Notes

### Incremental approach

Run tasks 0→1→2→3 first. That gives you the core + persistence — a working audit
system you can verify. Then layer on 4→5→6 for notifications. Tasks 7-9 are
independent and can be done in any order.

### Adapting to existing code

Each task prompt says "match existing patterns." Claude Code should look at the
existing project structure, DB session management, auth setup, and Angular
conventions before generating code. If the existing project uses SQLAlchemy
(not asyncpg directly), the Postgres plugin should use SQLAlchemy async sessions.

### Testing

Every task includes a testing constraint. The core (tasks 1-2) should be testable
with zero infrastructure. Plugin tests (tasks 3+) may need a test database or
mocking.
