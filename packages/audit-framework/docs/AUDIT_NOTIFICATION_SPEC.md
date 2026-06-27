# Audit, Notification & Case Management — Architecture Specification

> **Status:** Draft v1 — extracted from design session, not yet implemented.
> **Stack context:** Angular frontend, FastAPI/Python backend, SQLAlchemy ORM, Keycloak OIDC/SSO, PostgreSQL, intranet/air-gapped deployment.

---

## 1. Problem Statement

The application needs:

- **Audit logging** — configurable, policy-driven recording of who did what, when, to which resource, with before/after diffs.
- **Real-time notifications** — rule-based, multi-channel (in-app SSE now; email, SMS, webhook later), with recipient resolution via Keycloak groups/roles.
- **External sink fan-out** — forwarding audit events to SIEM/log platforms (Splunk, ELK, Loki, syslog, flat file) without coupling the application to any specific platform.
- **Case management integration** — escalating audit events into case/incident management systems (TheHive, Jira, ServiceNow, or custom) based on policy rules.
- **Technology agnosticism** — customers must be able to swap any infrastructure component (database, identity provider, SIEM, case manager) without touching core logic.

---

## 2. Architectural Decisions

### AD-1: Mixed architecture — use the pattern that fits the component

| Component nature | Pattern | Rationale |
|---|---|---|
| Audit & notification processing flow | **Pipe-and-filter** + **event bus** | Cross-cutting, linear processing, simple plugin surface, natural fan-out via event bus |
| Case management domain | **Hexagonal / Clean / Ports & Adapters** | Rich domain with state machines, business rules, and multiple backend adapters |
| Inter-context communication | **Event bus** (in-process, upgradeable to NATS/Redis/PG LISTEN-NOTIFY) | Loose coupling between bounded contexts |
| Simple CRUD contexts | Whatever is simplest | Don't over-architect |

### AD-2: Audit and broadcast are separate policy layers

Not everything audited is broadcast. Not everything broadcast needs full audit detail. Two independent policy evaluations per event:

```
Event → Audit Policy ("should I record this?") → Store + Sinks
      → Broadcast Policy ("should I notify?") → Rule Engine → Dispatcher → Channels
```

### AD-3: Configuration-driven, hot-reloadable policies

Policies are defined in YAML (or DB, or both via composite provider). Changes take effect without code deployment. The policy file is the single source of truth for what is audited and what triggers notifications.

### AD-4: SSE for real-time push (unidirectional, auto-reconnect)

SSE over WebSocket because notifications are server→client only. Use `sse-starlette` on the backend, native `EventSource` wrapped in an Angular service on the frontend.

### AD-5: Plugin discovery via Python entrypoints + explicit config

Plugins register themselves via `pyproject.toml` entrypoints or explicit module paths in config. The core never imports concrete implementations.

### AD-6: PG LISTEN/NOTIFY for multi-worker event propagation

For single-process: in-memory asyncio queues. For multi-worker: PostgreSQL LISTEN/NOTIFY (zero new infrastructure). Upgradeable to Redis pub/sub or NATS if needed.

### AD-7: Keycloak Admin API for recipient resolution, with TTL cache

Resolve groups/roles to user IDs via Keycloak Admin REST API using a service account (client_credentials grant). Cache with configurable TTL (default 300s) to avoid per-event API calls.

---

## 3. Processing Flow — Audit Pipeline (Pipe-and-Filter)

```
Event
  → [RedactMiddleware]        — sanitise sensitive fields per policy
  → [AuditPolicyMiddleware]   — evaluate audit policies, decide IF and HOW to record
  → [StoreMiddleware]         — write to primary audit store (append-only)
  → [SinkFanOutMiddleware]    — emit to external sinks (Splunk, ELK, file, ...) via event bus
  → [BroadcastPolicyMiddleware] — evaluate broadcast policies, produce NotificationDirectives
  → [DispatchMiddleware]      — route directives to channels (SSE, email, SMS, webhook, ...)
  → [EscalationMiddleware]    — emit escalation.requested events for case management
```

Each middleware implements one interface:

```python
class AuditMiddleware(Protocol):
    async def process(self, event: AuditEvent, context: PipelineContext, next: Callable) -> None: ...
```

Fan-out (multiple sinks, multiple channels) happens inside specific middlewares via the event bus, not by branching the chain.

---

## 4. Domain Models

### 4.1 AuditEvent (immutable, the atomic unit)

```python
@dataclass(frozen=True)
class AuditEvent:
    actor_id: str
    action: str                    # CREATE, READ, UPDATE, DELETE, LOGIN, LOGIN_FAILED, ...
    resource_type: str             # user, contract, case, ...
    resource_id: str
    changes: dict = field(default_factory=dict)    # {"field": {"old": ..., "new": ...}}
    timestamp: str                 # ISO 8601
    request_id: str                # correlation ID
    ip_address: str | None = None
    metadata: dict = field(default_factory=dict)   # extensible bag
```

### 4.2 AuditPolicy

```python
@dataclass(frozen=True)
class AuditPolicy:
    name: str
    match: dict                     # {"action": [...], "resource_type": [...]}
    enabled: bool = True
    detail_level: str = "standard"  # basic | standard | full
    capture_changes: bool = True
    capture_request: bool = False
    redact_fields: list[str] = field(default_factory=list)
    retention_days: int | None = None
    sinks: list[str] | None = None  # restrict to specific sinks; None = all
    priority: int = 0
```

### 4.3 BroadcastPolicy

```python
@dataclass(frozen=True)
class BroadcastPolicy:
    name: str
    match: dict
    enabled: bool = True
    targets: list[BroadcastTarget] = field(default_factory=list)
    template: str = "default"
    throttle: ThrottleConfig | None = None
    conditions: BroadcastCondition | None = None
    escalation: EscalationConfig | None = None
    priority: int = 0

@dataclass(frozen=True)
class BroadcastTarget:
    type: str               # "role", "group", "user", "resource_owner"
    value: str | None = None
    channels: list[str] = field(default_factory=lambda: ["in_app"])

@dataclass(frozen=True)
class ThrottleConfig:
    window_seconds: int = 60
    max_per_window: int = 10

@dataclass(frozen=True)
class EscalationConfig:
    enabled: bool = False
    severity: int = 2
    tags: list[str] = field(default_factory=list)
```

### 4.4 Notification / NotificationDirective

```python
@dataclass(frozen=True)
class NotificationDirective:
    recipient_id: str
    channel: str
    template_key: str
    event: AuditEvent
    rule_id: str

@dataclass
class Notification:
    id: str
    audit_event_request_id: str
    rule_id: str
    recipient_id: str
    channel: str
    status: str = "pending"       # pending, delivered, read, failed
    payload: dict = field(default_factory=dict)
    created_at: str = ""
    delivered_at: str | None = None
    error: str | None = None
```

---

## 5. Ports (Protocols) — Technology-Agnostic Interfaces

Every external capability is a Protocol. The core has zero dependencies beyond stdlib.

### 5.1 Storage

- **AuditStore** — append(context) → str, query(filters, offset, limit), get_by_resource(type, id)
- **NotificationStore** — save, mark_delivered, mark_failed, get_pending, get_unread, mark_read
- **PolicyStore** — get_audit_policies, get_broadcast_policies, reload

### 5.2 Identity

- **IdentityResolver** — resolve_group(id), resolve_role(name), resolve_user(id), get_user_contact(id, channel)
- **ResourceOwnerResolver** — get_owners(resource_type, resource_id)

### 5.3 Delivery

- **NotificationChannel** — channel_name (property), send(recipient_id, contact, payload)
- **RealtimePush** — push_to_user(user_id, event_type, payload), broadcast(event_type, payload)

### 5.4 External Sinks

- **ExternalSink** — sink_name (property), emit(event, context), health_check()

### 5.5 Case Management

- **CaseBackend** — create, update, get, search, add_observable, add_task, transition
- **CaseRepository** — save, find_by_source_event, find_open_by_resource
- **AlertPublisher** — publish(event_name, payload)

### 5.6 Infrastructure

- **EventBus** — publish(channel, payload), subscribe(channel) → Subscription
- **Subscription** — receive(timeout), close()
- **TemplateRenderer** — render(template_key, event, channel) → dict
- **ThrottleStore** — increment(key, window_seconds) → int, get_count(key)
- **Redactor** — redact(data, fields) → dict

---

## 6. Plugin System

Plugins are Python packages that implement one or more ports and register via a `register(registry)` function.

Discovery: Python entrypoints (`audit_framework.plugins` group) + explicit module paths in config.

```python
# Example plugin registration
def register(registry: PluginRegistry):
    registry.register("audit_store", "postgres", PostgresAuditStore)
    registry.register("external_sink", "splunk_hec", SplunkHECSink)
```

```toml
# Example pyproject.toml entrypoint
[project.entry-points."audit_framework.plugins"]
postgres = "audit_plugins_postgres.plugin:register"
```

---

## 7. Configuration Format

Single YAML file with two sections:

1. **infrastructure** — maps each port to a provider + config (connection strings, credentials via `${ENV_VAR}` references).
2. **policies** — audit policies and broadcast policies (match rules, targets, channels, throttling, escalation).

See section 3 of this document for the policy format. See the full config example in the design conversation for the infrastructure section.

The config supports:
- Multiple channels (list under `infrastructure.channels`)
- Multiple sinks (list under `infrastructure.sinks`)
- Optional case manager
- Plugin discovery settings
- Environment variable interpolation

---

## 8. Case Management Bounded Context (Hexagonal)

Separate from the audit pipeline. Connected via event bus.

### Domain entities: Case, Observable, Task, Alert
### State machine: OPEN → IN_PROGRESS → PENDING → RESOLVED → CLOSED (with allowed transitions)
### Domain logic: severity escalation, SLA timers, assignment rules — all in the domain layer, not in adapters.

### Integration with audit pipeline:
- Pipeline emits `escalation.requested` → Case management consumes it, creates a case.
- Case management emits `case.created`, `case.assigned`, etc. → Pipeline can audit/notify on case lifecycle events (bidirectional loop via event bus).

---

## 9. Database Schema (PostgreSQL Reference Implementation)

### audit_log (append-only)

```sql
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT NOT NULL,
    changes         JSONB,
    request_id      UUID,
    ip_address      INET,
    detail_level    TEXT,
    policy_name     TEXT,
    retention_days  INT
);

REVOKE UPDATE, DELETE ON audit_log FROM app_user;
```

### PG LISTEN/NOTIFY trigger

```sql
CREATE OR REPLACE FUNCTION notify_audit() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('audit_events', json_build_object(
        'actor_id',      NEW.actor_id,
        'action',        NEW.action,
        'resource_type', NEW.resource_type,
        'resource_id',   NEW.resource_id,
        'changes',       NEW.changes,
        'timestamp',     NEW.timestamp::text,
        'request_id',    NEW.request_id::text,
        'ip_address',    NEW.ip_address::text
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_notify
    AFTER INSERT ON audit_log
    FOR EACH ROW EXECUTE FUNCTION notify_audit();
```

### notifications

```sql
CREATE TABLE notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_event_id  BIGINT REFERENCES audit_log(id),
    rule_id         TEXT,
    recipient_id    TEXT NOT NULL,
    channel         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    payload         JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    delivered_at    TIMESTAMPTZ,
    read_at         TIMESTAMPTZ,
    error           TEXT
);
```

### notification_rules (if using DB-backed policies)

```sql
CREATE TABLE notification_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT true,
    priority        INT DEFAULT 0,
    event_filter    JSONB NOT NULL,
    target_type     TEXT NOT NULL,
    target_value    TEXT,
    channels        TEXT[] NOT NULL DEFAULT '{in_app}',
    template_key    TEXT NOT NULL,
    cooldown_seconds INT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
```

---

## 10. Key Libraries (Vetted)

| Purpose | Library | Notes |
|---|---|---|
| Entity-level versioning | `sqlalchemy-history` | Fork of sqlalchemy-continuum. Automatic `_history` tables. Supports SA 2+, Python 3.9+. |
| Rule expression matching | `rule-engine` (zeroSteiner) | Lightweight expression language for matching arbitrary Python objects. Replace hand-rolled `_matches()`. |
| SSE endpoint | `sse-starlette` | SSE for Starlette/FastAPI. |
| Keycloak auth middleware | `fastapi-keycloak-middleware` | OIDC token validation, role extraction, FastAPI dependencies. |
| Async PG (LISTEN/NOTIFY) | `asyncpg` | For the PG event bus. |
| Config with env vars | `pydantic-settings` | For `${ENV_VAR}` resolution in config. |
| File watching (hot reload) | `watchfiles` | For YAML policy hot-reload. |
| Frontend event bus (Angular) | `ng-event-bus` or plain RxJS `Subject` | Distribute SSE events to Angular components. |

Libraries explicitly evaluated and rejected or deprioritised:
- `fastapi-audit-log` (v1.4.0) — request-level only, no entity tracking, no notification layer.
- `fastapi-audit` (v0.2.3) — too new, zero dependents.
- `bh-fastapi-audit` — good architecture (study its ASGI middleware + chain hashing), but healthcare-specific. Worth studying, not adopting wholesale.
- `fastapi-rebac` — alpha, interesting for RBAC+audit combo but too immature.
- `durable-rules` — overkill for policy matching; Rete algorithm is unnecessary here.

---

## 11. File Structure (Target)

```
app/
├── audit/                             # Audit & notification pipeline
│   ├── core/                          # Zero external deps
│   │   ├── models.py                  # AuditEvent, policies, notifications
│   │   ├── ports.py                   # All Protocol definitions
│   │   ├── pipeline.py                # Middleware chain orchestrator
│   │   ├── middlewares/               # Built-in middlewares
│   │   │   ├── redact.py
│   │   │   ├── audit_policy.py
│   │   │   ├── store.py
│   │   │   ├── sink_fanout.py
│   │   │   ├── broadcast.py
│   │   │   ├── dispatch.py
│   │   │   └── escalation.py
│   │   ├── policy_engine.py           # Audit + Broadcast policy evaluation
│   │   ├── dispatcher.py              # Routes directives to channels
│   │   ├── plugin_registry.py         # Plugin discovery + registration
│   │   └── decorators.py              # @auditable decorator
│   │
│   ├── plugins/                       # Infrastructure adapters (each could be a separate package)
│   │   ├── postgres/                  # AuditStore, NotificationStore, EventBus (PG LISTEN/NOTIFY)
│   │   ├── keycloak/                  # IdentityResolver (Keycloak Admin API + cache)
│   │   ├── sse/                       # RealtimePush (SSE connection manager)
│   │   ├── smtp/                      # NotificationChannel (email)
│   │   ├── splunk/                    # ExternalSink (Splunk HEC)
│   │   ├── elk/                       # ExternalSink (Elasticsearch)
│   │   ├── file_jsonl/                # ExternalSink (append-only JSONL)
│   │   ├── syslog/                    # ExternalSink (syslog)
│   │   ├── yaml_policies/             # PolicyStore (YAML + hot reload)
│   │   ├── jinja_templates/           # TemplateRenderer
│   │   ├── hash_redactor/             # Redactor
│   │   └── in_memory_throttle/        # ThrottleStore
│   │
│   └── fastapi_integration/           # Framework-specific wiring
│       ├── middleware.py              # ASGI audit middleware (sets actor context)
│       ├── endpoints.py               # SSE stream, REST notification endpoints
│       └── bootstrap.py               # Reads config, wires pipeline, lifespan
│
├── case_management/                   # Case management bounded context (hexagonal)
│   ├── domain/
│   │   ├── models.py                  # Case, Observable, Task, CaseStatus
│   │   ├── events.py                  # CaseCreated, CaseAssigned, ...
│   │   ├── services.py                # CaseService (domain logic, state machine)
│   │   └── value_objects.py           # Severity, Priority, TLP, PAP
│   ├── application/
│   │   ├── commands.py                # CreateCase, AssignCase, ...
│   │   ├── queries.py                 # GetCase, ListCases, ...
│   │   ├── handlers.py                # Use case handlers
│   │   └── event_handlers.py          # Consumes events from audit pipeline
│   ├── ports/
│   │   └── outbound.py                # CaseBackend, CaseRepository, AlertPublisher
│   └── adapters/
│       ├── thehive/
│       ├── jira/
│       └── postgres/
│
├── config/
│   ├── audit_config.yaml              # Infrastructure + policy configuration
│   └── templates/
│       └── notifications/             # Jinja templates per notification type
│
└── main.py                            # Composition root
```

---

## 12. Angular Frontend (Minimal Spec)

### SSE Service

Wrap `EventSource` in an Angular service. Expose notifications as an RxJS `Observable`. Handle reconnection (native to EventSource). Pass auth token via query param or cookie (EventSource doesn't support custom headers).

### Notification Component

Subscribe to the SSE service. Display in-app notifications (toast/bell icon). Fetch unread notifications on page load via REST (`GET /notifications`). Mark as read via REST (`PATCH /notifications/{id}/read`).

### Audit Log Component (Admin)

Query audit log via REST (`GET /audit?resource_type=...&action=...&actor=...&from=...&to=...`). Display as a filterable, sortable table.

---

## 13. Open Questions / Future Decisions

- [ ] Retention cleanup job for audit_log (based on `retention_days` per policy).
- [ ] User notification preferences (mute channels/categories) — `user_notification_preferences` table.
- [ ] Retry queue for failed email/SMS notifications.
- [ ] Admin UI for managing policies via DB (CRUD on notification_rules).
- [ ] Whether to extract the audit framework into a standalone pip-installable package vs. keeping it in-repo.
- [ ] Redis-backed ThrottleStore for multi-worker deployments.
- [ ] EventSource auth strategy (query param token vs. cookie vs. initial handshake endpoint).
