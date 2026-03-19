# TFC Data Model — Full Recreation Prompt

You are building the data model for **TFC (Training Flow Control)**, a domain-agnostic exercise simulation platform. This prompt specifies every entity, field, relationship, constraint, and data flow layer needed to recreate the data model from scratch.

Read the companion document `TFC-RECREATION-PROMPT.md` for full game design context. This document focuses exclusively on **data structures**.

---

## Part 1: Data Architecture Overview

TFC has **six distinct data layers**, each with a specific purpose:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Layer 1: Database Models (SQLAlchemy)                              │
│  Persistent storage — exercises, scenarios, decisions, audit, config │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 2: HTTP Schemas (Pydantic)                                   │
│  Request/response validation for REST API                           │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 3: Scenario Content (Nested Pydantic)                        │
│  Structured JSON stored in scenarios.content column                  │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 4: Engine Config (Dataclasses)                               │
│  Passed to ExerciseEngine at construction — scenario → runtime       │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 5: Runtime State (Dataclasses)                               │
│  In-memory during exercise execution — events, issues, decisions     │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 6: State Changes (TypedDicts)                                │
│  Broadcast over WebSocket — codegen'd to TypeScript                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Data flow:**
```
Scenario JSON seed
       │
       ▼
  [Scenario DB model]  ←─ content column stores ScenarioContent (Layer 3)
       │
       ▼ scenario_loader.py converts ScenarioContent → EngineConfig
       │
  [EngineConfig]  (Layer 4)
       │
       ▼ ExerciseEngine constructor
       │
  [Runtime State]  (Layer 5: ScheduledEvent, TrackedIssue, ActiveDecision)
       │
       ▼ tick loop emits
       │
  [StateChange TypedDicts]  (Layer 6) ──▶ WebSocket ──▶ Frontend
       │
       ▼ also persisted to
       │
  [AuditEntry DB model]  (Layer 1)
```

---

## Part 2: Database Models (Layer 1 — SQLAlchemy)

All models inherit from `Base` (SQLAlchemy `DeclarativeBase`). All tables use `tfc_` prefix.

### 2.1 Exercise

```python
class Exercise(Base):
    __tablename__ = "tfc_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    phase: Mapped[str] = mapped_column(String(50), default="setup")
        # Values: "setup", "briefing", "running", "paused", "completed"
    scenario_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
        # Not a FK — scenario may be deleted while exercise persists
    domain_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("tfc_domain_configs.id"), nullable=True
    )
    time_factor: Mapped[float] = mapped_column(default=1.0)
        # Speed multiplier: 2.0 = 2 play-minutes per 1 real minute
    game_mode: Mapped[str] = mapped_column(String(50), default="classic")
        # Values: "classic", "simple_collaborative"
    practice_mode: Mapped[bool] = mapped_column(Boolean, default=False)
        # Solo-play variant, simple_collaborative only, max 1 player
    session_code: Mapped[str] = mapped_column(
        String(6), default=_generate_session_code, unique=True
    )
        # 6-char alphanumeric, generated on creation, used for joining
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

**Constraints:**
- `session_code` is unique
- `domain_id` references `tfc_domain_configs.id`
- `phase` is one of: `setup`, `briefing`, `running`, `paused`, `completed`
- `game_mode` is one of: `classic`, `simple_collaborative`
- When `practice_mode=True`, `game_mode` must be `simple_collaborative`

**Session code generator:**
```python
def _generate_session_code() -> str:
    """6-character alphanumeric code (uppercase + digits)."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=6))
```

### 2.2 Scenario

```python
class Scenario(Base):
    __tablename__ = "tfc_scenarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    domain_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("tfc_domain_configs.id"), nullable=True
    )
    content: Mapped[dict | None] = mapped_column(JSON, nullable=True)
        # Stores the full ScenarioContent as JSON (see Layer 3)
    version: Mapped[int] = mapped_column(default=1)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

**Notes:**
- `content` is a JSON column that stores the complete `ScenarioContent` Pydantic model — events, issues, decision templates, roles, briefing, objectives, rules, game mode config
- `domain_id` references `tfc_domain_configs.id`
- Seed script (`seed.py`) upserts scenarios by title — existing scenarios are updated on restart

### 2.3 Decision

```python
class Decision(Base):
    __tablename__ = "tfc_decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tfc_exercises.id")
    )
    issue_id: Mapped[str] = mapped_column(String(255))
        # Links to the issue/defect that triggered this decision
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    question_type: Mapped[str] = mapped_column(String(50))
        # Values: "single_choice", "multi_choice", "free_text", "scale"
    options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
        # List of {id, label, score} objects
    completion_mode: Mapped[str] = mapped_column(String(50))
        # Values: "first_response", "all_responses", "manual"
    status: Mapped[str] = mapped_column(String(20), default="open")
        # Values: "open", "closed", "timed_out"
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(nullable=True)
```

### 2.4 DecisionResponseRecord

```python
class DecisionResponseRecord(Base):
    __tablename__ = "tfc_decision_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    decision_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tfc_decisions.id")
    )
    participant_id: Mapped[str] = mapped_column(String(255))
    participant_name: Mapped[str] = mapped_column(String(255))
    selected_options: Mapped[list | None] = mapped_column(JSON, nullable=True)
        # List of selected option IDs
    free_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

### 2.5 AuditEntry

```python
class AuditEntry(Base):
    __tablename__ = "tfc_audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(Integer, index=True)
        # Indexed for efficient filtering by exercise
    entry_type: Mapped[str] = mapped_column(String(50))
        # e.g., "engine", "decision", "event", "issue"
    action: Mapped[str] = mapped_column(String(100))
        # e.g., "started", "paused", "decision_opened", "event_triggered"
    actor_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
        # e.g., "event", "issue", "decision"
    target_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    play_time_ms: Mapped[float] = mapped_column(default=0.0)
    real_time_ms: Mapped[float] = mapped_column(default=0.0)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
        # Arbitrary JSON payload for context
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

**Rules:** Audit entries are append-only — never updated or deleted.

### 2.6 DomainConfig

```python
class DomainConfig(Base):
    __tablename__ = "tfc_domain_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
        # e.g., "default", "military", "cybersecurity", "healthcare"
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    terminology: Mapped[dict] = mapped_column(JSON, nullable=False)
        # Maps generic code terms to domain labels
    theme: Mapped[dict] = mapped_column(JSON, nullable=False)
        # Colors, fonts, density
    roles: Mapped[list] = mapped_column(JSON, nullable=False)
        # Domain-specific role definitions
    severity_levels: Mapped[list] = mapped_column(JSON, nullable=False)
        # Domain-specific severity labels and colors
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

**Constraints:**
- `slug` is unique

### 2.7 Entity Relationship Diagram

```
tfc_domain_configs (1) ◄──── (N) tfc_scenarios
         │                              │
         │                              │ content JSON contains:
         │                              │   ScenarioContent (events, issues,
         │                              │   decision_templates, roles)
         │
         └──── (N) tfc_exercises
                      │
                      ├──── (N) tfc_decisions
                      │            │
                      │            └──── (N) tfc_decision_responses
                      │
                      └──── (N) tfc_audit_log
```

---

## Part 3: Scenario Content Schema (Layer 3 — Nested Pydantic)

This is the structured JSON stored in `tfc_scenarios.content`. It defines the complete scenario template.

### 3.1 Top-Level: ScenarioContent

```python
class ScenarioContent(BaseModel):
    phases: list[ScenarioPhaseDef] = []
    events: list[ScenarioEventDef] = []
    issues: list[ScenarioIssueDef] = []
    decision_templates: list[DecisionTemplateDef] = []
    default_time_factor: float = 1.0
    briefing: str = ""
    objectives: list[str] = []
    rules: list[str] = []
    game_mode: str = "classic"   # "classic" or "simple_collaborative"
    game_mode_config: dict[str, object] = {}
        # For simple_collaborative: {
        #   "base_decision_time_ms": 300000,
        #   "penalty_factor": 0.1,
        #   "min_decision_time_ms": 30000
        # }
    decision_sequence: list[str] = []
        # Ordered list of decision_template IDs for sequential play
    roles: list[RoleDef] = []
```

**Validation rules (enforced by @model_validator):**
1. At least one role must be defined
2. At least one role must have `player_type="decision_maker"`
3. If `game_mode="simple_collaborative"`, at least 2 roles required
4. All `target_roles` references in events and decision templates must reference valid role IDs
5. All `role_descriptions` keys in events must reference valid role IDs
6. `decision_sequence` entries must reference valid decision template IDs

### 3.2 RoleDef

```python
class RoleDef(BaseModel):
    id: str           # e.g., "co", "ops", "pwo", "aawo", "cyop", "nav", "eo"
    label: str        # e.g., "Commanding Officer"
    player_type: str = "advisor"   # "advisor" or "decision_maker"
```

**Rules:**
- Exactly one role should be `decision_maker` (the CO equivalent)
- All other roles are `advisor` (they recommend; CO decides)

### 3.3 ScenarioEventDef (Inject definition)

```python
class ScenarioEventDef(BaseModel):
    id: str                          # Unique within scenario
    title: str                       # e.g., "In Transit", "Hostile Salvo"
    description: str = ""            # Default description (fallback)
    event_type: str                  # "informational", "operational", "decision"
    scheduled_pt_ms: float           # When to trigger (play time milliseconds)
    duration_ms: float | None = None # Auto-complete after this duration (None=manual)
    dependencies: list[str] = []     # Event IDs that must complete first
    triggered_issues: list[str] = [] # Issue IDs activated when this event completes
    target_roles: list[str] = []     # Role IDs that see this event (empty=all)
    role_descriptions: dict[str, str] = {}
        # Per-role description overrides: {"ops": "Transit proceeding...", "nav": "Course steady..."}
        # Players see their role's text; others see the default `description`
```

**Notes:**
- `target_roles` controls visibility — empty means broadcast to all. Non-empty means only those roles + GMs see it.
- `role_descriptions` allows the same event to show different text to different roles. This is how Silent Wake delivers role-specific injects within a single turn event.
- `event_type="decision"` causes the engine to open a linked decision when the event fires.

### 3.4 ScenarioIssueDef (Defect definition)

```python
class ScenarioIssueDef(BaseModel):
    id: str                             # Unique within scenario
    title: str
    description: str = ""
    trigger_mode: str                   # "time-based", "event-based", "manual"
    trigger_time_pt_ms: float | None = None   # For time-based triggers
    trigger_event_id: str | None = None       # For event-based triggers
    auto_resolve_ms: float = 0                # 0 = no auto-resolve
```

### 3.5 DecisionTemplateDef (Blue card selection definition)

```python
class DecisionTemplateDef(BaseModel):
    id: str                              # Unique within scenario
    title: str                           # e.g., "Turn 1 Action Selection"
    description: str = ""
    issue_id: str                        # Linked issue ID
    question_type: str                   # "single_choice" or "multi_choice"
    options: list[DecisionOptionDef] = []
    completion_mode: str = "first_response"
    timeout_ms: float = 0                # 0 = no timeout
    target_roles: list[str] = []         # Who can respond (empty=all)
    forced_option_ids: list[str] = []    # Auto-included with penalty if omitted
    max_selections: int | None = None    # None = unlimited selections
```

**Rules:**
- `target_roles` must reference valid role IDs
- `forced_option_ids` must reference valid option IDs within this template
- `max_selections` caps how many options can be chosen in `multi_choice`

### 3.6 DecisionOptionDef (Blue card definition)

```python
class DecisionOptionDef(BaseModel):
    id: str          # e.g., "swb01", "swb03"
    label: str       # e.g., "Continue Mission (SWB01)"
    score: float = 0.0
        # Positive = good, Zero = neutral, Negative = bad
        # Used for penalty calculation in collaborative mode
```

### 3.7 ScenarioPhaseDef

```python
class ScenarioPhaseDef(BaseModel):
    id: str
    title: str
    description: str = ""
    duration_ms: float | None = None   # Auto-advance after duration
    events: list[str] = []             # Event IDs in this phase
```

---

## Part 4: Engine Config (Layer 4 — Dataclasses)

These are constructed by `scenario_loader.py` from ScenarioContent and passed to ExerciseEngine.

### 4.1 EngineConfig

```python
@dataclass
class EngineConfig:
    exercise_id: int
    title: str
    time_factor: float = 1.0
    events: list[ScheduledEvent] = field(default_factory=list)
    issues: list[TrackedIssue] = field(default_factory=list)
    decision_templates: list[DecisionTemplate] = field(default_factory=list)
    context: ScenarioContext = field(default_factory=ScenarioContext)
    game_mode: GameMode = field(default_factory=ClassicMode)
```

### 4.2 ScenarioContext

```python
@dataclass
class ScenarioContext:
    title: str = ""
    description: str = ""
    briefing: str = ""
    objectives: list[str] = field(default_factory=list)
    rules: list[str] = field(default_factory=list)
    roles: list[RoleInfo] = field(default_factory=list)
```

### 4.3 RoleInfo

```python
@dataclass
class RoleInfo:
    id: str
    label: str
    player_type: str = "advisor"   # "advisor" or "decision_maker"
```

### 4.4 DecisionTemplate (engine-side)

```python
@dataclass
class DecisionTemplate:
    id: str
    title: str
    description: str
    issue_id: str
    question_type: str                             # "single_choice" or "multi_choice"
    options: list[DecisionOptionSnapshot]           # Uses the TypedDict format
    completion_mode: str
    target_roles: list[str] = field(default_factory=list)
    timeout_ms: float = 0.0
    forced_option_ids: list[str] = field(default_factory=list)
    max_selections: int | None = None
```

---

## Part 5: Runtime State (Layer 5 — Dataclasses)

These live in-memory during exercise execution within the engine.

### 5.1 ScheduledEvent (runtime inject)

```python
class EventLifecycle(StrEnum):
    SCHEDULED = "scheduled"    # Not yet triggered
    PENDING = "pending"        # Dependencies met, waiting for time
    RUNNING = "running"        # Active, in progress
    PAUSED = "paused"          # Paused by GM
    COMPLETED = "completed"    # Finished
    CANCELLED = "cancelled"    # Cancelled by GM

class EventType(StrEnum):
    INFORMATIONAL = "informational"
    OPERATIONAL = "operational"
    DECISION = "decision"

@dataclass
class ScheduledEvent:
    id: str
    title: str
    description: str
    event_type: EventType
    scheduled_pt_ms: float                          # Trigger time (play time)
    duration_ms: float | None = None                # Auto-complete duration
    dependencies: list[str] = field(default_factory=list)
    triggered_issues: list[str] = field(default_factory=list)
    lifecycle: EventLifecycle = EventLifecycle.SCHEDULED
    started_at_pt_ms: float | None = None
    completed_at_pt_ms: float | None = None
    target_roles: list[str] = field(default_factory=list)
    role_descriptions: dict[str, str] = field(default_factory=dict)
```

### 5.2 TrackedIssue (runtime defect)

```python
class IssueLifecycle(StrEnum):
    INACTIVE = "inactive"
    ACTIVE = "active"
    MITIGATED = "mitigated"
    RESOLVED = "resolved"

class TriggerMode(StrEnum):
    TIME_BASED = "time-based"
    EVENT_BASED = "event-based"
    MANUAL = "manual"

@dataclass
class TrackedIssue:
    id: str
    title: str
    description: str
    trigger_mode: TriggerMode
    trigger_time_pt_ms: float | None = None
    trigger_event_id: str | None = None
    auto_resolve_ms: float = 0.0                   # 0 = no auto-resolve
    lifecycle: IssueLifecycle = IssueLifecycle.INACTIVE
    activated_at_pt_ms: float | None = None
    resolved_at_pt_ms: float | None = None
    released_to_players: bool = False
```

### 5.3 ActiveDecision (runtime decision)

```python
@dataclass
class ActiveDecision:
    id: str
    event_id: str | None
    issue_id: str | None
    title: str
    description: str
    question_type: str
    options: list[DecisionOptionSnapshot]            # TypedDict
    completion_mode: str
    target_roles: list[str]
    timeout_ms: float = 0.0
    max_selections: int | None = None
    status: str = "open"                             # "open", "closed", "timed_out"
    opened_at_pt_ms: float = 0.0
    opened_at_rt_ms: float = 0.0                     # Wall clock for timeout
    closed_at_pt_ms: float | None = None
    recommendations: dict[str, str] = field(default_factory=dict)
        # {participant_id: option_id} — advisor recommendations
    selected_option_ids: list[str] = field(default_factory=list)
        # Final selection by decision-maker
```

### 5.4 TimeManager (state holder, not dataclass)

```python
class TimeManager:
    _factor: float          # Speed multiplier
    _paused: bool           # Whether time is advancing
    _play_time_ms: float    # Accumulated play time
    _last_tick_real_ms: float
    _start_real_ms: float
```

### 5.5 ExerciseEngine (state holder)

```python
class EnginePhase(StrEnum):
    SETUP = "setup"
    BRIEFING = "briefing"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
```

The engine holds:
- `_config: EngineConfig`
- `_phase: EnginePhase`
- `_time: TimeManager`
- `_events: EventScheduler` (manages list of `ScheduledEvent`)
- `_issues: IssueManager` (manages list of `TrackedIssue`)
- `_decisions: DecisionManager` (manages list of `ActiveDecision`)
- `_state_changes: list[StateChange]` (accumulated during tick, flushed after broadcast)

### 5.6 SessionStore (singleton)

```python
class SessionStore:
    _sessions: dict[int, ExerciseEngine]   # exercise_id → running engine
```

Global singleton. Not persisted — exercises are reconstructed from DB + scenario on restart.

---

## Part 6: State Change TypedDicts (Layer 6 — WebSocket Protocol)

These are emitted by the engine during tick processing and broadcast over WebSocket. They are **codegen'd to TypeScript** via `generate-types.py`.

### 6.1 Snapshot Types (full state for initial sync)

```python
class DecisionOptionSnapshot(TypedDict):
    id: str
    label: str
    score: float
    role: str | None      # Role that owns this option (for display grouping)

class TimeSnapshot(TypedDict):
    play_time_ms: float
    real_time_ms: float
    factor: float
    paused: bool

class EventSnapshot(TypedDict):
    id: str
    title: str
    description: str
    event_type: str
    scheduled_pt_ms: float
    duration_ms: float | None
    dependencies: list[str]
    triggered_issues: list[str]
    lifecycle: str
    started_at_pt_ms: float | None
    completed_at_pt_ms: float | None
    target_roles: list[str]
    role_descriptions: dict[str, str]

class IssueSnapshot(TypedDict):
    id: str
    title: str
    description: str
    trigger_mode: str
    auto_resolve_ms: float
    lifecycle: str
    activated_at_pt_ms: float | None
    resolved_at_pt_ms: float | None
    released: bool

class DecisionSnapshot(TypedDict):
    id: str
    event_id: str | None
    issue_id: str | None
    title: str
    description: str
    question_type: str
    options: list[DecisionOptionSnapshot]
    completion_mode: str
    target_roles: list[str]
    timeout_ms: float
    max_selections: int | None
    status: str
    opened_at_pt_ms: float
    closed_at_pt_ms: float | None
    recommendations: dict[str, str]
    selected_option_ids: list[str]

class EngineSnapshot(TypedDict):
    exercise_id: int
    title: str
    phase: str
    time: TimeSnapshot
    events: list[EventSnapshot]
    issues: list[IssueSnapshot]
    decisions: list[DecisionSnapshot]
    score: dict[str, object] | None
        # For collaborative mode: {
        #   "total_score": float,
        #   "accumulated_penalty_ms": float,
        #   "next_decision_time_ms": int,
        #   "turn_number": int,
        #   "current_index": int
        # }

class PresenceEntry(TypedDict):
    id: str
    display_name: str
    role: str | None
    connected: bool
```

### 6.2 State Change Types (incremental updates)

```python
class PhaseChange(TypedDict):
    type: str           # Literal["phase_change"]
    action: str         # "started" | "paused" | "completed" | "reset"
    phase: str          # Current phase after change
    time: TimeSnapshot

class EventChange(TypedDict):
    type: str           # Literal["event_change"]
    event_id: str
    action: str         # "activated" | "started" | "completed" | "force_triggered" | "cancelled"
    lifecycle: str      # Current lifecycle after change
    title: str
    target_roles: list[str]
    role_descriptions: dict[str, str]

class IssueChange(TypedDict):
    type: str           # Literal["issue_change"]
    issue_id: str
    action: str         # "activated" | "mitigated" | "resolved" | "auto_resolve_expired"
    lifecycle: str
    title: str
    released: bool

class DecisionOpened(TypedDict):
    type: str           # Literal["decision_opened"]
    id: str
    decision_id: str
    event_id: str | None
    issue_id: str | None
    title: str
    description: str
    question_type: str
    options: list[DecisionOptionSnapshot]
    completion_mode: str
    target_roles: list[str]
    timeout_ms: float
    max_selections: int | None
    status: str
    opened_at_pt_ms: float
    closed_at_pt_ms: float | None
    recommendations: dict[str, str]

class DecisionClosed(TypedDict):
    type: str           # Literal["decision_closed"]
    decision_id: str
    title: str
    selected_option_ids: list[str]

class SpeedChange(TypedDict):
    type: str           # Literal["speed_change"]
    factor: float

class ScoreChange(TypedDict):
    type: str           # Literal["score_change"]
    total_score: float
    penalty_ms: float
    next_decision_time_ms: int
    turn_number: int

class RecommendationSubmitted(TypedDict):
    type: str           # Literal["recommendation_submitted"]
    decision_id: str
    participant_id: str
    option_id: str

class ForcedCardApplied(TypedDict):
    type: str           # Literal["forced_card_applied"]
    decision_id: str
    forced_option_id: str
    reason: str

# Discriminated union
StateChange = (
    PhaseChange | EventChange | IssueChange
    | DecisionOpened | DecisionClosed
    | SpeedChange | ScoreChange
    | RecommendationSubmitted | ForcedCardApplied
)
```

**Visibility rules for state changes:**
- `EventChange` and `DecisionOpened` with non-empty `target_roles` are **split-broadcast**: sent only to matching roles + GMs
- All other state changes are broadcast to all connected participants

---

## Part 7: Game Mode Data Structures

### 7.1 GameMode Protocol

```python
class GameMode(Protocol):
    def should_pause_on_decision(self) -> bool: ...
    def on_decision_timeout(self, decision_id: str, options: list[DecisionOptionSnapshot]) -> str | None: ...
    def on_decision_closed_v2(
        self, decision_id: str, selected_options: list[DecisionOptionSnapshot],
        all_options: list[DecisionOptionSnapshot],
        forced_option_ids: list[str] | None = None
    ) -> list[dict]: ...
    def snapshot(self) -> dict | None: ...
    def get_next_decision_id(self, closed_decision_id: str) -> str | None: ...
    def get_decision_time_ms(self, base_time_ms: int) -> int: ...
    def requires_gm(self) -> bool: ...
```

### 7.2 ClassicMode (stateless)

```python
@dataclass
class ClassicMode:
    # No fields — all methods are stateless
    # should_pause_on_decision() → True
    # on_decision_timeout() → None (no auto-submit)
    # on_decision_closed_v2() → [] (no score changes)
    # snapshot() → None
    # get_next_decision_id() → None (manual sequencing)
    # get_decision_time_ms() → base_time_ms (no penalty)
    # requires_gm() → True
```

### 7.3 SimpleCollaborativeMode (stateful)

```python
@dataclass
class SimpleCollaborativeMode:
    # Configuration (set from game_mode_config)
    decision_sequence: list[str] = field(default_factory=list)
        # Ordered list of decision template IDs
    base_decision_time_ms: int = 300_000     # 5 minutes default
    penalty_factor: float = 0.1
    min_decision_time_ms: int = 30_000       # 30 seconds floor

    # Mutable runtime state
    accumulated_penalty_ms: float = 0.0
    total_score: float = 0.0
    turn_number: int = 1
    current_index: int = 0
        # Points into decision_sequence
```

**Scoring mechanics:**
```
Per decision close:
  selected_score = sum(option.score for option in selected_options)
  max_possible = sum(sorted([o.score for o in all_options], reverse=True)[:max_selections or len(all_options)])
  penalty_ms = (max_possible - selected_score) * penalty_factor * 1000
  accumulated_penalty_ms += penalty_ms
  total_score += selected_score

Forced cards:
  If forced_option_ids are specified and any are omitted from selection:
    → auto-include with penalty
    → emit ForcedCardApplied state change

Effective decision time:
  effective_ms = max(min_decision_time_ms, base_decision_time_ms - accumulated_penalty_ms)

Practice mode:
  effective_ms *= 1.5  (solo cognitive load compensation)

Timeout:
  Auto-submit worst option (lowest score)
```

**Snapshot shape (returned by `snapshot()`):**
```python
{
    "total_score": float,
    "accumulated_penalty_ms": float,
    "next_decision_time_ms": int,
    "turn_number": int,
    "current_index": int,
    "base_decision_time_ms": int,
    "penalty_factor": float,
    "min_decision_time_ms": int
}
```

---

## Part 8: HTTP Schemas (Layer 2 — Pydantic)

### 8.1 Exercise Schemas

```python
class CreateExerciseRequest(BaseModel):
    title: str
    description: str = ""
    phase: str = "setup"
    scenario_id: int | None = None
    domain_id: int | None = None
    time_factor: float = 1.0
    game_mode: str = "classic"
    practice_mode: bool = False

class UpdateExerciseRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    phase: str | None = None
    scenario_id: int | None = None
    domain_id: int | None = None
    time_factor: float | None = None
    game_mode: str | None = None
    practice_mode: bool | None = None

class ExerciseResponse(ResponseBase):
    id: int
    title: str
    description: str
    phase: str
    scenario_id: int | None
    domain_id: int | None
    time_factor: float
    game_mode: str
    practice_mode: bool
    session_code: str
    created_at: datetime
    updated_at: datetime
```

### 8.2 Decision Schemas

```python
class SubmitResponseRequest(BaseModel):
    participant_id: str
    participant_name: str
    selected_options: list[str] | None = None
    free_text: str | None = None

class CloseDecisionRequest(BaseModel):
    selected_option_ids: list[str] = Field(default_factory=list)

class RecommendRequest(BaseModel):
    decision_id: str
    option_id: str
    participant_id: str = Field(..., min_length=1)
    role_id: str | None = None
```

### 8.3 Domain Config Schemas

```python
class TerminologyPayload(BaseModel):
    event: str         # e.g., "Inject", "SITREP", "Incident"
    issue: str         # e.g., "Defect", "Operational Issue", "Vulnerability"
    player: str        # e.g., "Player", "Operator", "SOC Analyst"
    gameMaster: str    # e.g., "Game Master", "Exercise Controller"
    exercise: str      # e.g., "Exercise", "Tactical Exercise"
    scenario: str      # e.g., "Scenario", "Operations Order"
    decision: str      # e.g., "Decision", "Command Decision"

class ThemePayload(BaseModel):
    colorPrimary: str       # e.g., "#3b82f6"
    colorSecondary: str
    colorBackground: str
    colorForeground: str
    fontFamily: str
    fontFamilyMono: str
    density: str            # "comfortable" | "compact" | "spacious"

class RolePayload(BaseModel):
    id: str
    label: str
    description: str

class SeverityLevelPayload(BaseModel):
    id: str          # e.g., "low", "medium", "high", "critical"
    label: str
    color: str       # Hex color
    order: int       # Sort order (lower = less severe)
```

### 8.4 Waiting Room Schemas

```python
class JoinRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    role: str = Field(default="player", min_length=1, max_length=50)

class ParticipantResponse(BaseModel):
    id: str
    display_name: str
    role: str
    joined_at: str

class WaitingRoomResponse(BaseModel):
    exercise_id: int
    participants: list[ParticipantResponse]
```

### 8.5 Engine Action Schemas

```python
class SpeedRequest(BaseModel):
    factor: float = Field(..., gt=0)

class DelayRequest(BaseModel):
    delay_ms: float = Field(..., gt=0)
```

---

## Part 9: Domain Config Seed Data

Four presets seeded via migration:

### 9.1 Default (Generic Training)

```json
{
  "slug": "default",
  "name": "Default Training",
  "terminology": {
    "event": "Event", "issue": "Issue", "player": "Player",
    "gameMaster": "Game Master", "exercise": "Exercise",
    "scenario": "Scenario", "decision": "Decision"
  },
  "theme": {
    "colorPrimary": "#3b82f6", "colorSecondary": "#6366f1",
    "colorBackground": "#ffffff", "colorForeground": "#1e293b",
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontFamilyMono": "JetBrains Mono, monospace", "density": "comfortable"
  },
  "roles": [
    {"id": "player", "label": "Player", "description": "Exercise participant"},
    {"id": "observer", "label": "Observer", "description": "Read-only observer"}
  ],
  "severity_levels": [
    {"id": "low", "label": "Low", "color": "#22c55e", "order": 1},
    {"id": "medium", "label": "Medium", "color": "#f59e0b", "order": 2},
    {"id": "high", "label": "High", "color": "#f97316", "order": 3},
    {"id": "critical", "label": "Critical", "color": "#ef4444", "order": 4}
  ]
}
```

### 9.2 Military (Tactical Exercise)

```json
{
  "slug": "military",
  "name": "Tactical Exercise",
  "terminology": {
    "event": "SITREP", "issue": "Operational Issue", "player": "Operator",
    "gameMaster": "Exercise Controller", "exercise": "Tactical Exercise",
    "scenario": "Operations Order", "decision": "Command Decision"
  },
  "theme": {
    "colorPrimary": "#84cc16", "colorSecondary": "#f59e0b",
    "colorBackground": "#1a1a2e", "colorForeground": "#e2e8f0",
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontFamilyMono": "JetBrains Mono, monospace", "density": "compact"
  },
  "roles": [
    {"id": "operator", "label": "Operator", "description": "Field operator"},
    {"id": "commander", "label": "Commander", "description": "Unit commander"},
    {"id": "intelligence", "label": "Intelligence", "description": "Intel analyst"},
    {"id": "observer", "label": "Observer", "description": "Exercise observer"}
  ],
  "severity_levels": [
    {"id": "routine", "label": "Routine", "color": "#22c55e", "order": 1},
    {"id": "priority", "label": "Priority", "color": "#f59e0b", "order": 2},
    {"id": "immediate", "label": "Immediate", "color": "#f97316", "order": 3},
    {"id": "flash", "label": "Flash", "color": "#ef4444", "order": 4}
  ]
}
```

### 9.3 Cybersecurity (Incident Response)

```json
{
  "slug": "cybersecurity",
  "name": "Cyber Incident Response",
  "terminology": {
    "event": "Incident", "issue": "Vulnerability", "player": "SOC Analyst",
    "gameMaster": "Exercise Director", "exercise": "Cyber Exercise",
    "scenario": "Attack Scenario", "decision": "Response Action"
  },
  "theme": {
    "colorPrimary": "#06b6d4", "colorSecondary": "#8b5cf6",
    "colorBackground": "#0f172a", "colorForeground": "#e2e8f0",
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontFamilyMono": "JetBrains Mono, monospace", "density": "compact"
  },
  "roles": [
    {"id": "soc-analyst", "label": "SOC Analyst", "description": "..."},
    {"id": "incident-commander", "label": "Incident Commander", "description": "..."},
    {"id": "forensic-analyst", "label": "Forensic Analyst", "description": "..."},
    {"id": "observer", "label": "Observer", "description": "..."}
  ],
  "severity_levels": [
    {"id": "info", "label": "Informational", "color": "#3b82f6", "order": 0},
    {"id": "low", "label": "Low", "color": "#22c55e", "order": 1},
    {"id": "medium", "label": "Medium", "color": "#f59e0b", "order": 2},
    {"id": "high", "label": "High", "color": "#f97316", "order": 3},
    {"id": "critical", "label": "Critical", "color": "#ef4444", "order": 4}
  ]
}
```

### 9.4 Healthcare (Clinical Simulation)

```json
{
  "slug": "healthcare",
  "name": "Clinical Simulation",
  "terminology": {
    "event": "Case", "issue": "Complication", "player": "Clinician",
    "gameMaster": "Simulation Lead", "exercise": "Simulation",
    "scenario": "Clinical Scenario", "decision": "Clinical Decision"
  },
  "theme": {
    "colorPrimary": "#14b8a6", "colorSecondary": "#06b6d4",
    "colorBackground": "#ffffff", "colorForeground": "#1e293b",
    "fontFamily": "Inter, system-ui, sans-serif",
    "fontFamilyMono": "JetBrains Mono, monospace", "density": "comfortable"
  },
  "roles": [
    {"id": "clinician", "label": "Clinician", "description": "..."},
    {"id": "nurse", "label": "Nurse", "description": "..."},
    {"id": "specialist", "label": "Specialist", "description": "..."},
    {"id": "observer", "label": "Observer", "description": "..."}
  ],
  "severity_levels": [
    {"id": "routine", "label": "Routine", "color": "#22c55e", "order": 1},
    {"id": "urgent", "label": "Urgent", "color": "#f59e0b", "order": 2},
    {"id": "emergent", "label": "Emergent", "color": "#f97316", "order": 3},
    {"id": "critical", "label": "Critical", "color": "#ef4444", "order": 4}
  ]
}
```

---

## Part 10: Migration Sequence

Implement these migrations in order (each must have a working `downgrade()`):

| # | Name | What It Does |
|---|------|-------------|
| 1 | `initial_schema` | Creates: `tfc_exercises` (id, title, description, phase, scenario_id, time_factor, created_at, updated_at), `tfc_scenarios` (id, title, description, content JSON, version, created_at, updated_at), `tfc_decisions` (id, exercise_id FK, issue_id, title, description, question_type, options JSON, completion_mode, status, created_at, closed_at), `tfc_decision_responses` (id, decision_id FK, participant_id, participant_name, selected_options JSON, free_text, score, submitted_at), `tfc_audit_log` (id, exercise_id indexed, entry_type, action, actor_id, actor_name, target_type, target_id, play_time_ms, real_time_ms, details JSON, created_at) |
| 2 | `add_domain_configs` | Creates `tfc_domain_configs` table (id, slug unique, name, description, terminology JSON, theme JSON, roles JSON, severity_levels JSON, created_at, updated_at). Adds `domain_id` FK column to `tfc_scenarios` and `tfc_exercises`. Seeds 4 domain config presets. |
| 3 | `add_game_mode` | Adds `game_mode` varchar(50) column to `tfc_exercises`, default `"classic"` |
| 4 | `add_session_code` | Adds `session_code` varchar(6) unique column to `tfc_exercises`. Backfills existing rows with generated codes. |
| 5 | `update_default_terminology` | Updates default domain config terminology: "Event"→"Inject", "Issue"→"Defect" (data migration) |
| 6 | `add_practice_mode` | Adds `practice_mode` boolean column to `tfc_exercises`, default `false` |

---

## Part 11: Key Invariants

1. **Engine is stateless w.r.t. database.** The engine never reads from or writes to the database. Persistence is handled by the feature layer wrapping the engine.

2. **State changes are the only engine output.** The engine emits `StateChange` TypedDicts. The feature layer decides what to persist (audit log) and what to broadcast (WebSocket).

3. **ScenarioContent is the single source of scenario truth.** The JSON in `tfc_scenarios.content` is validated by Pydantic and converted to `EngineConfig` by `scenario_loader.py`. No scenario data is hardcoded in the engine.

4. **TypedDicts are the WebSocket contract.** Frontend TypeScript interfaces are generated from these TypedDicts. Changing a TypedDict requires regenerating the frontend types.

5. **Domain config is runtime-swappable.** The same exercise can display different terminology without changing any data — only the referenced `domain_id` changes.

6. **Game mode state lives inside the mode object.** `SimpleCollaborativeMode` carries mutable state (`accumulated_penalty_ms`, `total_score`, etc.). This state is serialized in the `score` field of `EngineSnapshot`.

7. **Waiting room is in-memory only.** Participant presence is not persisted to the database — it exists only in the WebSocket connection state.

8. **Session store is a singleton dict.** Running engines are stored in `{exercise_id: ExerciseEngine}`. Not persisted — if the server restarts, exercises must be reconstructed from DB + scenario.
