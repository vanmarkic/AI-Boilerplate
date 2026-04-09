# TFC Terminology Alignment & Spec Gap Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename all TFC domain vocabulary (event→inject, issue→defect), delete the DomainService, and close all remaining gaps against `docs/exercise-control.md`.

**Architecture:** Backend-first rename (engine → features → API), then DB migration, then frontend rename, then feature changes (execution mode, ETBOL split, all_respond fix, audit completeness), then UI rework (trainer cockpit, trainee view, scenario builder).

**Tech Stack:** Python 3.12+ (FastAPI, SQLAlchemy, Alembic, Pydantic), Angular 21 (signals, standalone components, zoneless), PostgreSQL 17.

**Spec:** `docs/superpowers/specs/2026-04-09-tfc-terminology-alignment-and-gap-closure-design.md`

---

## Phase A: Backend Engine Rename

These tasks rename the pure-Python engine layer. No DB, no HTTP. Each task is a single file rename + internal content rename. Tasks A1-A4 are independent and parallelizable.

### Task A1: Rename `event_scheduler.py` → `inject_scheduler.py`

**Files:**
- Rename: `apps/tfc/backend/engine/event_scheduler.py` → `apps/tfc/backend/engine/inject_scheduler.py`
- Rename: `apps/tfc/backend/engine/event_scheduler_test.py` → `apps/tfc/backend/engine/inject_scheduler_test.py`
- Rename: `apps/tfc/backend/engine/event_scheduler_p2_test.py` → `apps/tfc/backend/engine/inject_scheduler_p2_test.py`
- Rename: `apps/tfc/backend/engine/event_scheduler_prop_test.py` → `apps/tfc/backend/engine/inject_scheduler_prop_test.py`

- [ ] **Step 1: Rename file and update all internal names**

In `inject_scheduler.py` (after git mv):
- Module docstring: "events" → "injects", "event lifecycle" → "inject lifecycle"
- `EventLifecycle` → `InjectLifecycle`
- `EventType` → `InjectType`
- `EventChange` import → `InjectChange` (after A3 renames state_changes.py)
- `ScheduledEvent` → `ScheduledInject`
- `EventScheduler` → `InjectScheduler`
- Field `event_type` → `inject_type`
- Field `triggered_issues` → `triggered_defects`
- Method `load_events()` → `load_injects()`
- Method `cancel_event()` → `cancel_inject()`
- Method `complete_event()` → `complete_inject()`
- Method `pause_event()` → `pause_inject()`
- Method `resume_event()` → `resume_inject()`
- Method `delay_event()` → `delay_inject()`
- Method `skip_event()` → `skip_inject()`
- Method `get_triggered_issues()` → `get_triggered_defects()`
- Property `.events` → `.injects`
- All internal `_events` dict → `_injects`
- All local vars `event`/`event_id` in TFC context → `inject`/`inject_id`

- [ ] **Step 2: Rename test files and update all references**

In each test file (after git mv):
- Update imports to `from engine.inject_scheduler import InjectScheduler, ScheduledInject, InjectLifecycle, InjectType`
- Rename test classes: `TestPauseEvent` → `TestPauseInject`, `TestEventBasedActivation` → `TestInjectBasedActivation`, etc.
- Rename fixtures: `def _event(...)` → `def _inject(...)`
- Update all assertions and method calls

- [ ] **Step 3: Run tests**

```bash
cd apps/tfc/backend && python -m pytest engine/inject_scheduler_test.py -v
```
Expected: tests may fail until A3 (state_changes) is also done — that's OK, we'll validate after A3.

- [ ] **Step 4: Commit**

```bash
git add -A apps/tfc/backend/engine/inject_scheduler*.py apps/tfc/backend/engine/event_scheduler*.py
git commit -m "refactor(tfc): rename EventScheduler → InjectScheduler"
```

### Task A2: Rename `issue_manager.py` → `defect_manager.py`

**Files:**
- Rename: `apps/tfc/backend/engine/issue_manager.py` → `apps/tfc/backend/engine/defect_manager.py`
- Rename: `apps/tfc/backend/engine/issue_manager_test.py` → `apps/tfc/backend/engine/defect_manager_test.py`
- Rename: `apps/tfc/backend/engine/issue_manager_prop_test.py` → `apps/tfc/backend/engine/defect_manager_prop_test.py`

- [ ] **Step 1: Rename file and update all internal names**

In `defect_manager.py`:
- Module docstring: "issue" → "defect"
- `IssueLifecycle` → `DefectLifecycle`
- `TriggerMode.EVENT_BASED` → `TriggerMode.INJECT_BASED`
- `IssueChange` import → `DefectChange` (after A3)
- `TrackedIssue` → `TrackedDefect`
- `IssueManager` → `DefectManager`
- Field `trigger_event_id` → `trigger_inject_id`
- Method `load_issues()` → `load_defects()`
- Method `activate_by_event()` → `activate_by_inject()`
- Property `.issues` → `.defects`
- All internal `_issues` → `_defects`
- VALID_TRANSITIONS keys/comments: "issue" → "defect"

- [ ] **Step 2: Rename test files and update all references**

Same pattern as A1 — update imports, test class names, fixtures, assertions.

- [ ] **Step 3: Commit**

```bash
git add -A apps/tfc/backend/engine/defect_manager*.py apps/tfc/backend/engine/issue_manager*.py
git commit -m "refactor(tfc): rename IssueManager → DefectManager"
```

### Task A3: Rename `state_changes.py` types

**Files:**
- Modify: `apps/tfc/backend/engine/state_changes.py`

- [ ] **Step 1: Rename TypedDicts and their fields**

```python
# Before:
class EventChange(TypedDict):
    type: str          # "event_change"
    event_id: str

class IssueChange(TypedDict):
    type: str          # "issue_change"
    issue_id: str

StateChange = PhaseChange | EventChange | IssueChange | DecisionOpened | DecisionClosed | SpeedChange

# After:
class InjectChange(TypedDict):
    type: str          # "inject_change"
    inject_id: str
    action: str
    lifecycle: str
    title: str

class DefectChange(TypedDict):
    type: str          # "defect_change"
    defect_id: str
    action: str
    lifecycle: str
    title: str
    released: bool

StateChange = PhaseChange | InjectChange | DefectChange | DecisionOpened | DecisionClosed | SpeedChange
```

- [ ] **Step 2: Commit**

```bash
git add apps/tfc/backend/engine/state_changes.py
git commit -m "refactor(tfc): rename EventChange/IssueChange → InjectChange/DefectChange"
```

### Task A4: Rename `engine_config.py`, `decision_manager.py`, `strategies.py`

**Files:**
- Modify: `apps/tfc/backend/engine/engine_config.py`
- Modify: `apps/tfc/backend/engine/decision_manager.py`
- Modify: `apps/tfc/backend/engine/strategies.py`

- [ ] **Step 1: Update engine_config.py**

```python
# Before:
from engine.event_scheduler import ScheduledEvent
from engine.issue_manager import TrackedIssue

class DecisionTemplate:
    issue_id: str  # → defect_id: str

class EngineConfig:
    events: list[ScheduledEvent]  # → injects: list[ScheduledInject]
    issues: list[TrackedIssue]    # → defects: list[TrackedDefect]

# After:
from engine.inject_scheduler import ScheduledInject
from engine.defect_manager import TrackedDefect

class DecisionTemplate:
    defect_id: str

class EngineConfig:
    injects: list[ScheduledInject] = field(default_factory=list)
    defects: list[TrackedDefect] = field(default_factory=list)
```

- [ ] **Step 2: Update decision_manager.py**

- `ActiveDecision.event_id` → `.inject_id`
- `ActiveDecision.issue_id` → `.defect_id`
- `open_decision()` params: `event_id=` → `inject_id=`, `issue_id=` → `defect_id=`
- Snapshot dict keys: `"event_id"` → `"inject_id"`, `"issue_id"` → `"defect_id"`

- [ ] **Step 3: Update strategies.py**

- `event_ids()` → `inject_ids()`
- `issue_ids()` → `defect_ids()`
- `scheduled_events()` → `scheduled_injects()`
- `tracked_issues()` → `tracked_defects()`
- Update all imports and field names (`triggered_issues` → `triggered_defects`, `trigger_event_id` → `trigger_inject_id`, `TriggerMode.EVENT_BASED` → `TriggerMode.INJECT_BASED`)

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/backend/engine/engine_config.py apps/tfc/backend/engine/decision_manager.py apps/tfc/backend/engine/strategies.py
git commit -m "refactor(tfc): rename engine_config, decision_manager, strategies terminology"
```

### Task A5: Rename `exercise_engine.py` and its tests

**Files:**
- Modify: `apps/tfc/backend/engine/exercise_engine.py`
- Modify: `apps/tfc/backend/engine/exercise_engine_test.py`
- Modify: `apps/tfc/backend/engine/exercise_engine_p2_test.py`

- [ ] **Step 1: Update exercise_engine.py**

Imports:
```python
from engine.inject_scheduler import InjectScheduler, InjectLifecycle, InjectType
from engine.defect_manager import DefectManager
```

Properties:
```python
self._injects = InjectScheduler()
self._defects = DefectManager()
self._injects.load_injects(config.injects)
self._defects.load_defects(config.defects)

@property
def inject_scheduler(self) -> InjectScheduler:
    return self._injects

@property
def defect_manager(self) -> DefectManager:
    return self._defects
```

`tick()`:
- `event_changes` → `inject_changes`
- `self._events.tick(pt)` → `self._injects.tick(pt)`
- `self._events.events` → `self._injects.injects`
- `EventLifecycle.COMPLETED` → `InjectLifecycle.COMPLETED`
- `self._issues.activate_by_event()` → `self._defects.activate_by_inject()`
- `self._issues.tick()` → `self._defects.tick()`

`snapshot()`:
```python
"injects": self._injects.snapshot(),
"defects": self._defects.snapshot(),
```

`_handle_decision_events()` → `_handle_decision_injects()`:
- `change["event_id"]` → `change["inject_id"]`
- `event.event_type` → `inject.inject_type`
- `EventType.DECISION` → `InjectType.DECISION`
- `issue_id=t.issue_id` → `defect_id=t.defect_id`

`reset()`:
```python
self._injects.load_injects(self._config.injects)
self._defects.load_defects(self._config.defects)
```

- [ ] **Step 2: Update test files**

Update all imports, mock names, assertion keys, fixture data.

- [ ] **Step 3: Run all engine tests**

```bash
cd apps/tfc/backend && python -m pytest engine/ -v
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/backend/engine/
git commit -m "refactor(tfc): rename exercise_engine and tests to inject/defect terminology"
```

---

## Phase B: Backend Features Rename

These tasks rename the HTTP/DB layer. Tasks B1-B5 are parallelizable after Phase A completes.

### Task B1: Rename scenario content, loader, and seed data

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_content.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py`
- Modify: `apps/tfc/backend/features/scenario/sample_er_scenario.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_content_test.py` (if exists)
- Modify: `apps/tfc/backend/features/scenario/scenario_content_p2_test.py` (if exists)
- Modify: `apps/tfc/backend/features/scenario/scenario_loader_test.py` (if exists)
- Modify: `apps/tfc/backend/features/scenario/sample_er_scenario_test.py` (if exists)

- [ ] **Step 1: Update scenario_content.py**

- `ScenarioEventDef` → `ScenarioInjectDef`
- `ScenarioIssueDef` → `ScenarioDefectDef`
- Field `event_type` → `inject_type`
- Field `triggered_issues` → `triggered_defects`
- Field `trigger_event_id` → `trigger_inject_id`
- `ScenarioContent.events` → `.injects`
- `ScenarioContent.issues` → `.defects`
- `ScenarioPhaseDef.events` → `.injects`
- `DecisionTemplateDef.issue_id` → `.defect_id`

- [ ] **Step 2: Update scenario_loader.py**

- `load_scenario_events()` → `load_scenario_injects()`
- `load_scenario_issues()` → `load_scenario_defects()`
- `content.events` → `content.injects`
- `content.issues` → `content.defects`
- `triggered_issues=` → `triggered_defects=`
- `trigger_event_id=` → `trigger_inject_id=`
- `event_type=` → `inject_type=`
- All imports updated to new names

- [ ] **Step 3: Update sample_er_scenario.py**

All dict keys:
- `"events"` → `"injects"` (top-level and inside phases)
- `"issues"` → `"defects"`
- `"event_type"` → `"inject_type"`
- `"triggered_issues"` → `"triggered_defects"`
- `"trigger_event_id"` → `"trigger_inject_id"`
- `"issue_id"` → `"defect_id"` in decision templates

- [ ] **Step 4: Update all scenario test files**

- [ ] **Step 5: Run scenario tests**

```bash
cd apps/tfc/backend && python -m pytest features/scenario/ -v
```

- [ ] **Step 6: Commit**

```bash
git add apps/tfc/backend/features/scenario/
git commit -m "refactor(tfc): rename scenario content/loader/seed to inject/defect"
```

### Task B2: Rename engine_actions_router.py

**Files:**
- Modify: `apps/tfc/backend/features/exercise/engine_actions_router.py`
- Modify: `apps/tfc/backend/features/exercise/engine_actions_router_test.py` (if exists)

- [ ] **Step 1: Rename all API paths, operation IDs, params, and function names**

Paths:
- `/events/{event_id}/trigger` → `/injects/{inject_id}/trigger`
- `/events/{event_id}/cancel` → `/injects/{inject_id}/cancel`
- (same for complete, pause, resume, delay, skip)
- `/issues/{issue_id}/activate` → `/defects/{defect_id}/activate`
- (same for mitigate, resolve, release)

Operation IDs:
- `triggerEvent` → `triggerInject`, etc.
- `activateIssue` → `activateDefect`, etc.

Function names and params:
- `trigger_event(event_id)` → `trigger_inject(inject_id)`
- Engine access: `engine.event_scheduler` → `engine.inject_scheduler`
- `engine.issue_manager` → `engine.defect_manager`
- Method calls: `.cancel_event()` → `.cancel_inject()`, `.manual_activate()` stays same, etc.

Router docstring: "events, issues" → "injects, defects"

- [ ] **Step 2: Update test file**

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/backend/features/exercise/engine_actions_router*
git commit -m "refactor(tfc): rename engine_actions_router paths to /injects/ and /defects/"
```

### Task B3: Rename engine_router.py and ws_router.py

**Files:**
- Modify: `apps/tfc/backend/features/exercise/engine_router.py`
- Modify: `apps/tfc/backend/features/exercise/ws_router.py`

- [ ] **Step 1: Update engine_router.py**

- `engine.event_scheduler` → `engine.inject_scheduler`
- `engine.issue_manager` → `engine.defect_manager`
- Any `event_id`/`issue_id` references → `inject_id`/`defect_id`
- Update `_build_config` if it references old field names

- [ ] **Step 2: Update ws_router.py**

Check for any `event_change`/`issue_change` string literals — update to `inject_change`/`defect_change`.

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/backend/features/exercise/engine_router.py apps/tfc/backend/features/exercise/ws_router.py
git commit -m "refactor(tfc): rename engine_router and ws_router terminology"
```

### Task B4: Rename decision feature (model, schema, service, router)

**Files:**
- Modify: `apps/tfc/backend/features/decision/decision_model.py`
- Modify: `apps/tfc/backend/features/decision/decision_schema.py`
- Modify: `apps/tfc/backend/features/decision/decision_service.py`
- Modify: `apps/tfc/backend/features/decision/decision_router.py`
- Modify: `apps/tfc/backend/features/decision/decision_test.py`

- [ ] **Step 1: Update decision_model.py**

`issue_id: Mapped[str]` → `defect_id: Mapped[str]`

- [ ] **Step 2: Update decision_schema.py**

All `issue_id` fields → `defect_id` in `CreateDecisionRequest`, `DecisionResponse`, `DecisionDetailResponse`.

- [ ] **Step 3: Update decision_service.py**

All `issue_id` references → `defect_id` (assignment, query, etc.)

- [ ] **Step 4: Update decision_router.py and test**

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/backend/features/decision/
git commit -m "refactor(tfc): rename decision feature issue_id → defect_id"
```

### Task B5: Rename audit service and remove domain_id

**Files:**
- Modify: `apps/tfc/backend/features/audit/audit_service.py`
- Modify: `apps/tfc/backend/features/audit/audit_test.py`
- Modify: `apps/tfc/backend/features/exercise/exercise_model.py`
- Modify: `apps/tfc/backend/features/exercise/exercise_schema.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_model.py`

- [ ] **Step 1: Update audit_service.py**

```python
# Before:
target_id=change.get("event_id") or change.get("issue_id"),
# After:
target_id=change.get("inject_id") or change.get("defect_id"),
```

Also update `target_type` extraction logic if it parses `"event_change"` / `"issue_change"`.

- [ ] **Step 2: Update audit_test.py**

Update test data strings: `"event_change"` → `"inject_change"`, `{"event_id": "e1"}` → `{"inject_id": "e1"}`, etc.

- [ ] **Step 3: Remove domain_id from exercise_model.py**

Delete `domain_id = Column(Integer, nullable=True)` line.

- [ ] **Step 4: Remove domain_id from exercise_schema.py**

Remove `domain_id` from `CreateExerciseRequest`, `UpdateExerciseRequest`, `ExerciseResponse`.

- [ ] **Step 5: Remove domain_id from scenario_model.py**

Delete `domain_id` column.

- [ ] **Step 6: Run all backend tests**

```bash
cd apps/tfc/backend && python -m pytest -v
```

- [ ] **Step 7: Commit**

```bash
git add apps/tfc/backend/features/
git commit -m "refactor(tfc): rename audit terminology, remove domain_id from models"
```

### Task B6: Database migration

**Files:**
- Create: `apps/tfc/backend/alembic/versions/002_terminology_alignment.py`

- [ ] **Step 1: Create migration**

```python
"""Align terminology: issue_id → defect_id, drop domain_id columns.

Revision ID: 002_terminology
Revises: 001_initial
Create Date: 2026-04-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_terminology"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("tfc_decisions", "issue_id", new_column_name="defect_id")
    op.drop_column("tfc_exercises", "domain_id")
    op.drop_column("tfc_scenarios", "domain_id")


def downgrade() -> None:
    op.add_column("tfc_scenarios", sa.Column("domain_id", sa.Integer, nullable=True))
    op.add_column("tfc_exercises", sa.Column("domain_id", sa.Integer, nullable=True))
    op.alter_column("tfc_decisions", "defect_id", new_column_name="issue_id")
```

- [ ] **Step 2: Run migration**

```bash
make migrate-tfc
```

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/backend/alembic/
git commit -m "migrate(tfc): rename issue_id → defect_id, drop domain_id"
```

---

## Phase C: Frontend Rename

Tasks C1-C5 are parallelizable. They depend on Phase B being complete (API paths changed).

### Task C1: Rename core services and interfaces

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/engine-api.service.ts`
- Modify: `apps/tfc/frontend/src/app/core/decision-api.service.ts`
- Modify: `apps/tfc/frontend/src/app/core/scenario-api.service.ts`
- Modify: `apps/tfc/frontend/src/app/core/exercise-ws.service.ts`

- [ ] **Step 1: Update engine-api.service.ts**

Interfaces:
- `EventSnapshot` → `InjectSnapshot`, field `event_type` → `inject_type`
- `IssueSnapshot` → `DefectSnapshot`, field `auto_resolve_ms` → `auto_resolve_pt_ms`
- `EngineSnapshot.events` → `.injects`, `.issues` → `.defects`

Methods:
- `triggerEvent()` → `triggerInject()` (URL: `/injects/${injectId}/trigger`)
- Same for cancel, complete, pause, resume, delay, skip
- `activateIssue()` → `activateDefect()` (URL: `/defects/${defectId}/activate`)
- Same for mitigate, resolve, release

- [ ] **Step 2: Update decision-api.service.ts**

- `ActiveDecision.event_id` → `.inject_id`
- `ActiveDecision.issue_id` → `.defect_id`
- `DecisionDetail.issue_id` → `.defect_id`

- [ ] **Step 3: Update scenario-api.service.ts**

- `ScenarioEventDef` → `ScenarioInjectDef`, field `.event_type` → `.inject_type`, `.triggered_issues` → `.triggered_defects`
- `ScenarioIssueDef` → `ScenarioDefectDef`, field `.trigger_event_id` → `.trigger_inject_id`
- `ScenarioContent.events` → `.injects`, `.issues` → `.defects`

- [ ] **Step 4: Check exercise-ws.service.ts**

Update any `event_change`/`issue_change` type strings if present.

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/frontend/src/app/core/
git commit -m "refactor(tfc): rename frontend core services to inject/defect"
```

### Task C2: Rename exercise store

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/exercise.store.ts`
- Modify: `apps/tfc/frontend/src/app/core/exercise.store.spec.ts`

- [ ] **Step 1: Update exercise.store.ts**

State shape:
- `events: EventSnapshot[]` → `injects: InjectSnapshot[]`
- `issues: IssueSnapshot[]` → `defects: DefectSnapshot[]`

Computed signals:
- `activeEvents` → `activeInjects`
- `scheduledEvents` → `scheduledInjects`
- `completedEvents` → `completedInjects`
- `activeIssues` → `activeDefects`
- `releasedIssues` → `releasedDefects`
- `issuesWithCountdown` → `defectsWithCountdown`

Methods:
- `updateEvent()` → `updateInject()`
- `updateIssue()` → `updateDefect()`

`applySnapshot()`:
- `snapshot.events` → `snapshot.injects`
- `snapshot.issues` → `snapshot.defects`

- [ ] **Step 2: Update spec file**

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/core/exercise.store*
git commit -m "refactor(tfc): rename exercise store signals to inject/defect"
```

### Task C3: Rename game-master feature files

**Files:**
- Rename: `apps/tfc/frontend/src/app/features/game-master/event-timeline.component.ts` → `inject-timeline.component.ts`
- Rename: `apps/tfc/frontend/src/app/features/game-master/event-timeline.component.spec.ts` → `inject-timeline.component.spec.ts`
- Rename: `apps/tfc/frontend/src/app/features/game-master/gm-event-actions.ts` → `gm-inject-actions.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/game-master-view.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/gm-ws-handler.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/gm-item-actions.component.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/gm-item-actions.component.spec.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/timeline-utils.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/timeline-utils.spec.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/timeline-lane.component.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/scenario-picker.ts`

- [ ] **Step 1: Rename files (git mv)**

```bash
cd apps/tfc/frontend/src/app/features/game-master
git mv event-timeline.component.ts inject-timeline.component.ts
git mv event-timeline.component.spec.ts inject-timeline.component.spec.ts
git mv gm-event-actions.ts gm-inject-actions.ts
```

- [ ] **Step 2: Update inject-timeline.component.ts**

- Component selector: if it includes "event", rename
- Input `events` → `injects`, `issues` → `defects`
- All `EventSnapshot` → `InjectSnapshot`, `IssueSnapshot` → `DefectSnapshot`
- Template references
- `domain.term()` calls → hardcoded strings

- [ ] **Step 3: Update gm-inject-actions.ts**

- `createEventActions()` → `createInjectActions()`
- `createIssueActions()` → `createDefectActions()`
- Internal API calls: `api.triggerEvent()` → `api.triggerInject()`, etc.

- [ ] **Step 4: Update gm-ws-handler.ts**

- `'event_change'` → `'inject_change'`
- `change['event_id']` → `change['inject_id']`
- `'issue_change'` → `'defect_change'`
- `change['issue_id']` → `change['defect_id']`
- `store.updateEvent()` → `store.updateInject()`
- `store.updateIssue()` → `store.updateDefect()`

- [ ] **Step 5: Update gm-item-actions.component.ts**

- Input `events` → `injects`, `issues` → `defects`
- Template: "Event"/"Issue" labels → "Inject"/"Defect"
- `domain.term()` calls → hardcoded strings

- [ ] **Step 6: Update timeline-utils.ts**

- Params: `events: EventSnapshot[]` → `injects: InjectSnapshot[]`
- `issues: IssueSnapshot[]` → `defects: DefectSnapshot[]`
- Return: `.eventItems` → `.injectItems`, `.issueItems` → `.defectItems`
- `eventToItem()` → `injectToItem()`, `issueToItem()` → `defectToItem()`

- [ ] **Step 7: Update game-master-view.ts**

- Remove `DomainService` and `DomainSelectorComponent` imports
- Remove domain selector from template
- All `domain.term()` → hardcoded strings
- `store.events()` → `store.injects()`, `store.issues()` → `store.defects()`
- `store.activeEvents()` → `store.activeInjects()`, etc.
- Import paths updated for renamed files

- [ ] **Step 8: Update scenario-picker.ts**

- Remove `DomainService` import/injection
- Replace `domain.term()` calls

- [ ] **Step 9: Update all spec files**

- [ ] **Step 10: Commit**

```bash
git add apps/tfc/frontend/src/app/features/game-master/
git commit -m "refactor(tfc): rename game-master feature to inject/defect, delete DomainService usage"
```

### Task C4: Rename player feature, scenario builder, review view

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.ts`
- Modify: `apps/tfc/frontend/src/app/features/player/player-ws-handler.ts`
- Rename: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-event-editor.ts` → `scenario-inject-editor.ts`
- Rename: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-issue-editor.ts` → `scenario-defect-editor.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts`
- Modify: `apps/tfc/frontend/src/app/features/review/review-view.ts`

- [ ] **Step 1: Update player-view.ts**

- WS strings: `'event_change'` → `'inject_change'`, `'issue_change'` → `'defect_change'`
- Dict keys: `change['event_id']` → `change['inject_id']`, etc.
- Store calls: `store.updateEvent()` → `store.updateInject()`, etc.
- `store.releasedIssues()` → `store.releasedDefects()`
- `store.issuesWithCountdown()` → `store.defectsWithCountdown()`
- Remove `DomainService`, replace `domain.term()` with hardcoded strings
- Template text: "No events released yet" → "No injects released yet", etc.

- [ ] **Step 2: Update player-ws-handler.ts**

Same WS string updates.

- [ ] **Step 3: Rename and update scenario editor files**

```bash
git mv scenario-event-editor.ts scenario-inject-editor.ts
git mv scenario-issue-editor.ts scenario-defect-editor.ts
```

Update internal references, field names, labels.

- [ ] **Step 4: Update scenario-builder-view.ts**

- Import paths for renamed editors
- Remove `DomainService`
- `store.content().events` → `store.content().injects`
- `store.content().issues` → `store.content().defects`

- [ ] **Step 5: Update scenario-builder.store.ts**

- `addEvent/removeEvent/updateEvent` → `addInject/removeInject/updateInject`
- `addIssue/removeIssue/updateIssue` → `addDefect/removeDefect/updateDefect`
- `content().events` → `content().injects`
- `content().issues` → `content().defects`

- [ ] **Step 6: Update review-view.ts**

- Filter: `e.entry_type === 'event_change'` → `'inject_change'`
- Card title: "Event Summary" → "Inject Summary"

- [ ] **Step 7: Commit**

```bash
git add apps/tfc/frontend/src/app/features/
git commit -m "refactor(tfc): rename player, scenario-builder, review to inject/defect"
```

### Task C5: Delete DomainService and update e2e fixtures

**Files:**
- Delete: `apps/tfc/frontend/src/app/core/domain.service.ts`
- Delete: `apps/tfc/frontend/src/app/shared/domain-selector.component.ts`
- Delete: `apps/tfc/frontend/src/app/shared/domain-selector.component.spec.ts`
- Modify: `apps/tfc/frontend/e2e/fixtures/base.fixture.ts`

- [ ] **Step 1: Delete DomainService files**

```bash
git rm apps/tfc/frontend/src/app/core/domain.service.ts
git rm apps/tfc/frontend/src/app/shared/domain-selector.component.ts
git rm apps/tfc/frontend/src/app/shared/domain-selector.component.spec.ts
```

- [ ] **Step 2: Update e2e fixtures**

Remove `domain_id: null` from mock exercise responses in `base.fixture.ts`.

- [ ] **Step 3: Build frontend to verify**

```bash
cd apps/tfc/frontend && npx ng build --configuration=development
```
Expected: NO ERRORS

- [ ] **Step 4: Run frontend tests**

```bash
make test-tfc-frontend
```

- [ ] **Step 5: Commit**

```bash
git add -A apps/tfc/frontend/
git commit -m "refactor(tfc): delete DomainService, update e2e fixtures"
```

---

## Phase D: Documentation Rename

### Task D1: Update AGENTS.md and README.md

**Files:**
- Modify: `apps/tfc/AGENTS.md`
- Modify: `apps/tfc/README.md` (if exists)

- [ ] **Step 1: Update AGENTS.md**

- Architecture diagram: `EventScheduler` → `InjectScheduler`, `IssueManager` → `DefectManager`
- Engine concepts: "Events" → "Injects", "Issues" → "Defects"
- `event_scheduler.py` → `inject_scheduler.py`, `issue_manager.py` → `defect_manager.py`
- Remove stale `@aspect/tfc-shared` references (`ExerciseEvent`, `Issue`, `EVENT_TRANSITIONS`, `ISSUE_TRANSITIONS`, `DomainConfig`)
- Remove `domain` from shared services list
- Update all code references in rules section

- [ ] **Step 2: Update README.md** (if it exists)

Same terminology updates.

- [ ] **Step 3: Commit**

```bash
git add apps/tfc/AGENTS.md apps/tfc/README.md
git commit -m "docs(tfc): update AGENTS.md and README.md with inject/defect terminology"
```

---

## Phase E: Spec Gap Closure — Backend Changes

These implement the 5 data model changes + audit fix from the design spec. Depend on Phases A-B being complete. Tasks E1-E5 are parallelizable.

### Task E1: Inject execution mode (AUTOMATIC/MANUAL)

**Files:**
- Modify: `apps/tfc/backend/engine/inject_scheduler.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_content.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py`
- Modify: `apps/tfc/backend/engine/state_changes.py`
- Create test in: `apps/tfc/backend/engine/inject_scheduler_test.py`

- [ ] **Step 1: Write failing test**

```python
def test_manual_inject_does_not_auto_activate(self):
    """MANUAL injects skip auto-activation in _should_activate()."""
    scheduler = InjectScheduler()
    scheduler.load_injects([
        ScheduledInject(
            id="m1", title="Manual", description="",
            inject_type=InjectType.INFORMATIONAL,
            scheduled_pt_ms=0, execution_mode=ExecutionMode.MANUAL,
        ),
    ])
    changes = scheduler.tick(1000)
    assert len(changes) == 0
    assert scheduler.injects["m1"].lifecycle == InjectLifecycle.SCHEDULED
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
cd apps/tfc/backend && python -m pytest engine/inject_scheduler_test.py::TestManualInjectDoesNotAutoActivate -v
```

- [ ] **Step 3: Implement**

In `inject_scheduler.py`:

```python
class ExecutionMode(StrEnum):
    AUTOMATIC = "automatic"
    MANUAL = "manual"
```

Add to `ScheduledInject`:
```python
execution_mode: ExecutionMode = ExecutionMode.AUTOMATIC
```

In `_should_activate()`:
```python
if inject.execution_mode == ExecutionMode.MANUAL:
    return False
```

In snapshot: include `"execution_mode": e.execution_mode.value`

In `state_changes.py:InjectSnapshot`: add `execution_mode: str`

In `scenario_content.py:ScenarioInjectDef`: add `execution_mode: str = "automatic"`

In `scenario_loader.py`: pass `execution_mode=ExecutionMode(inj.execution_mode)`

- [ ] **Step 4: Run test — verify PASS**

- [ ] **Step 5: Write second test — AUTOMATIC still works**

```python
def test_automatic_inject_activates_normally(self):
    scheduler = InjectScheduler()
    scheduler.load_injects([
        ScheduledInject(
            id="a1", title="Auto", description="",
            inject_type=InjectType.INFORMATIONAL,
            scheduled_pt_ms=0, execution_mode=ExecutionMode.AUTOMATIC,
        ),
    ])
    changes = scheduler.tick(1000)
    assert len(changes) > 0
```

- [ ] **Step 6: Run all inject_scheduler tests — verify PASS**

- [ ] **Step 7: Commit**

```bash
git add apps/tfc/backend/
git commit -m "feat(tfc): add ExecutionMode enum — MANUAL injects skip auto-activation"
```

### Task E2: Defect ETBOL RT/PT split

**Files:**
- Modify: `apps/tfc/backend/engine/defect_manager.py`
- Modify: `apps/tfc/backend/engine/exercise_engine.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_content.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py`
- Modify: `apps/tfc/backend/engine/state_changes.py`
- Create tests in: `apps/tfc/backend/engine/defect_manager_test.py`

- [ ] **Step 1: Write failing test — RT-based auto-resolve**

```python
def test_defect_resolves_by_rt_countdown(self):
    """Defect with auto_resolve_rt_ms resolves when RT elapsed."""
    manager = DefectManager()
    manager.load_defects([
        TrackedDefect(
            id="d1", title="RT defect", description="",
            trigger_mode=TriggerMode.MANUAL,
            auto_resolve_pt_ms=0,  # no PT resolve
            auto_resolve_rt_ms=5000,  # resolves after 5s RT
        ),
    ])
    manager.manual_activate("d1", current_pt_ms=0)
    # Simulate: activated_at_rt_ms = 0, now RT = 6000
    manager.defects["d1"].activated_at_rt_ms = 0
    changes = manager.tick(1000, set(), current_rt_ms=6000)
    assert any(c["defect_id"] == "d1" and c["lifecycle"] == "resolved" for c in changes)
```

- [ ] **Step 2: Run test — verify FAIL**

- [ ] **Step 3: Implement**

In `TrackedDefect`:
- Rename `auto_resolve_ms` → `auto_resolve_pt_ms`
- Add `auto_resolve_rt_ms: float = 0.0`
- Add `activated_at_rt_ms: float | None = None`

In `_activate()`: record `activated_at_rt_ms = current_rt_ms` (new param)

In `tick()`: new param `current_rt_ms: float`. Check RT countdown:
```python
if defect.auto_resolve_rt_ms > 0 and defect.activated_at_rt_ms is not None:
    if (current_rt_ms - defect.activated_at_rt_ms) >= defect.auto_resolve_rt_ms:
        # resolve
```

In `exercise_engine.py:tick()`: pass `self._time.real_time_ms` to `self._defects.tick()`.

Update snapshot and state_changes to include both fields.

- [ ] **Step 4: Run test — verify PASS**

- [ ] **Step 5: Write PT-only and both-countdown tests**

- [ ] **Step 6: Run all defect_manager tests**

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(tfc): add RT-based ETBOL countdown for defects"
```

### Task E3: Fix `all_respond` completion mode

**Files:**
- Modify: `apps/tfc/backend/engine/decision_manager.py`
- Modify: `apps/tfc/backend/features/exercise/engine_router.py`
- Create test

- [ ] **Step 1: Write failing test**

Test that when completion_mode is `all_respond` and all target_roles have submitted, the decision auto-closes.

- [ ] **Step 2: Run test — verify FAIL**

- [ ] **Step 3: Implement**

In `decision_manager.py`:
```python
def all_target_roles_responded(self, decision_id: str) -> bool:
    decision = self._active.get(decision_id)
    if not decision or not decision.target_roles:
        return False
    responded_roles = {r.role for r in decision.recommendations}
    return all(role in responded_roles for role in decision.target_roles)
```

In `engine_router.py:submit_recommendation()`: after recording, check and auto-close.

- [ ] **Step 4: Run test — verify PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(tfc): enforce all_respond completion mode auto-close"
```

### Task E4: Verify scoring is hidden (add test)

**Files:**
- Create test in engine test file

- [ ] **Step 1: Write test**

```python
def test_snapshot_has_no_score_key_during_running(self):
    engine = ExerciseEngine(config)
    await engine.start()
    snap = engine.snapshot()
    assert "score" not in snap
```

- [ ] **Step 2: Run test — verify PASS** (already correct behavior)

- [ ] **Step 3: Commit**

```bash
git commit -m "test(tfc): verify snapshot excludes score during execution"
```

### Task E5: Make DecisionTemplate.defect_id optional

**Files:**
- Modify: `apps/tfc/backend/engine/engine_config.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_content.py`

- [ ] **Step 1: Change field**

```python
# engine_config.py
@dataclass
class DecisionTemplate:
    defect_id: str | None = None  # was required str

# scenario_content.py
class DecisionTemplateDef(BaseModel):
    defect_id: str | None = None
```

- [ ] **Step 2: Run tests**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(tfc): make DecisionTemplate.defect_id optional"
```

### Task E6: Audit completeness — route entity actions through _on_state_change

**Files:**
- Modify: `apps/tfc/backend/features/exercise/engine_actions_router.py`
- Create test

- [ ] **Step 1: Write failing test**

Test that calling `cancel_inject` endpoint results in an audit log entry.

- [ ] **Step 2: Implement**

For each of the 10 entity action endpoints, after getting the change dict from the engine method, call `engine._on_state_change([change])` if the engine has a state change callback, instead of just returning the change. This ensures the WS broadcast + audit logging happens.

Pattern:
```python
@router.post("/injects/{inject_id}/cancel")
async def cancel_inject(inject_id: str, exercise_id: int, ...):
    engine = session_store.get(exercise_id)
    change = engine.inject_scheduler.cancel_inject(inject_id)
    if engine._on_state_change:
        await engine._on_state_change([change])
    return change
```

- [ ] **Step 3: Run test — verify PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "fix(tfc): route entity action endpoints through _on_state_change for audit"
```

---

## Phase F: Codegen & Integration Verification

### Task F1: Regenerate types and verify

- [ ] **Step 1: Run codegen**

```bash
make generate
```

- [ ] **Step 2: Verify frontend compiles**

```bash
cd apps/tfc/frontend && npx ng build --configuration=development
```

- [ ] **Step 3: Run all backend tests**

```bash
make test-tfc-backend
```

- [ ] **Step 4: Run all frontend tests**

```bash
make test-tfc-frontend
```

- [ ] **Step 5: Commit any codegen output changes**

```bash
git add -A && git commit -m "chore(tfc): regenerate types after terminology alignment"
```

---

## Phase G: Trainer Cockpit UI (Phase 4 from spec)

### Task G1: Layout refactor — 5-row trainer cockpit

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/game-master/game-master-view.ts`

- [ ] **Step 1: Restructure template into 5-row layout**

```
Row 1: Header — exercise title, RT/PT clocks, phase badge, connected trainees count
Row 2: Overview — left: inject timeline (flex:2), right: defect list with ETBOL (flex:1)
Row 3: Trainee monitor placeholder (new section, initially empty)
Row 4: Details panel (collapsible, shows selected inject/defect metadata + actions)
Row 5: Controls footer — start/pause/resume/reset/stop, speed slider
```

- [ ] **Step 2: Run frontend build**
- [ ] **Step 3: Commit**

### Task G2: Details panel component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/game-master/detail-panel.component.ts`

- [ ] **Step 1: Write test for detail panel**
- [ ] **Step 2: Implement detail panel**

Shows full metadata for selected inject or defect. Action buttons: Pause/Cancel/Complete (injects), Activate/Mitigate/Resolve (defects).

- [ ] **Step 3: Wire into game-master-view Row 4**
- [ ] **Step 4: Commit**

### Task G3: Trainee monitor component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/game-master/trainee-monitor.component.ts`

- [ ] **Step 1: Write test**
- [ ] **Step 2: Implement**

Per-trainee cards showing: name, role, decision status (pending/submitted/timed_out). "Validate & Close" button for gm_closes decisions.

- [ ] **Step 3: Wire into game-master-view Row 3**
- [ ] **Step 4: Commit**

---

## Phase H: Trainee UI (Phase 5 from spec)

### Task H1: Inject feed component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/player/inject-feed.component.ts`

- [ ] **Step 1: Write test**
- [ ] **Step 2: Implement**

Scrollable chronological list of released injects (newest on top). PT timestamp, title, description. Running highlighted, completed dimmed.

- [ ] **Step 3: Commit**

### Task H2: Defect panel component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/player/defect-panel.component.ts`

- [ ] **Step 1: Write test**
- [ ] **Step 2: Implement**

Active defects with lifecycle badge, ETBOL countdown. Resolved defects collapsed and dimmed.

- [ ] **Step 3: Commit**

### Task H3: Rework player-view layout

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.ts`

- [ ] **Step 1: Restructure to feed-centric 3-column layout**

```
Header: title | PT clock | phase badge
Main: inject feed (flex:2) | defect panel (flex:1) | context sidebar
Decision overlay: blocking modal
Footer: role label | decision history drawer button
```

- [ ] **Step 2: Integrate inject-feed and defect-panel components**
- [ ] **Step 3: Refactor existing decision UI into blocking modal overlay**
- [ ] **Step 4: Commit**

---

## Phase I: Scenario Builder Completeness (Phase 6 from spec)

### Task I1: Backend scenario item CRUD endpoints

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_router.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_service.py`

- [ ] **Step 1: Write failing tests for inject CRUD**
- [ ] **Step 2: Implement POST/PUT/DELETE for injects within a scenario**
- [ ] **Step 3: Write failing tests for defect CRUD**
- [ ] **Step 4: Implement POST/PUT/DELETE for defects**
- [ ] **Step 5: Write failing tests for decision template CRUD**
- [ ] **Step 6: Implement POST/PUT/DELETE for decision templates**
- [ ] **Step 7: Add referential integrity validation**
- [ ] **Step 8: Commit**

### Task I2: Frontend scenario builder enhancements

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-inject-editor.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-defect-editor.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder-view.ts`

- [ ] **Step 1: Add execution mode selector to inject editor**
- [ ] **Step 2: Add ETBOL RT/PT fields to defect editor**
- [ ] **Step 3: Add completion mode selector to decision editor**
- [ ] **Step 4: Add scenario validation before save**
- [ ] **Step 5: Commit**

---

## Phase J: Integration & E2E (Phase 7 from spec)

### Task J1: End-to-end smoke test

**Files:**
- Create: `apps/tfc/frontend/e2e/tests/exercise-flow.spec.ts`

- [ ] **Step 1: Write e2e test covering full flow**

1. Load scenario
2. Create exercise
3. Trainer starts → running
4. Inject fires (AUTOMATIC)
5. Defect activates
6. Decision opens → pause
7. Trainee responds → close
8. Trainer completes → COMPLETED
9. Audit trail has entries

- [ ] **Step 2: Run e2e tests**

```bash
cd apps/tfc/frontend && npx playwright test
```

- [ ] **Step 3: Commit**

```bash
git commit -m "test(tfc): add end-to-end exercise flow smoke test"
```

---

## Execution Order Summary

```
Phase A (engine rename)     ← independent tasks, parallelizable
    ↓
Phase B (features rename)   ← depends on A, tasks parallelizable
    ↓
Phase C (frontend rename)   ← depends on B, tasks parallelizable
Phase D (docs rename)       ← depends on A+B, parallelizable with C
    ↓
Phase E (gap closure)       ← depends on A+B, parallelizable with C
    ↓
Phase F (codegen + verify)  ← depends on B+C+E
    ↓
Phase G (trainer UI)    ┐
Phase H (trainee UI)    ├── parallelizable, depend on F
Phase I (scenario CRUD) ┘
    ↓
Phase J (e2e)               ← depends on G+H+I
```
