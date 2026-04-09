# TFC Terminology Alignment & Spec Gap Closure — Design Spec

**Date:** 2026-04-09
**Source spec:** `docs/exercise-control.md`
**Supersedes:** `docs/superpowers/specs/2026-04-07-tfc-excon-default-mode-design.md` (absorbs all its content)
**Scope:** (1) Rename all TFC domain vocabulary to match the spec's fixed terms. (2) Delete the DomainService and all domain-config infrastructure. (3) Close all remaining gaps between the implementation and `exercise-control.md`.

## Part 1: Terminology Rename

### Principle

The spec uses fixed terms: **inject**, **defect**, **decision point**. The codebase currently uses "event" for inject and "issue" for defect. The DomainService that provided flexible per-domain vocabulary is deleted — there is one vocabulary, period.

**Scope guard:** Only TFC domain terms are renamed. Generic programming uses of "event" (Angular `EventEmitter`, DOM events, `@HostListener`, etc.) are untouched.

### Rename Map

| Current | New | Applies to |
|---|---|---|
| `Event` (class prefix) | `Inject` | `EventScheduler` → `InjectScheduler`, `ScheduledEvent` → `ScheduledInject`, `EventLifecycle` → `InjectLifecycle`, `EventType` → `InjectType`, `EventSnapshot` → `InjectSnapshot`, `EventChange` → `InjectChange`, `ScenarioEventDef` → `ScenarioInjectDef` |
| `Issue` (class prefix) | `Defect` | `IssueManager` → `DefectManager`, `TrackedIssue` → `TrackedDefect`, `IssueLifecycle` → `DefectLifecycle`, `IssueSnapshot` → `DefectSnapshot`, `IssueChange` → `DefectChange`, `ScenarioIssueDef` → `ScenarioDefectDef` |
| `event_change` (string) | `inject_change` | WS messages, state changes, audit |
| `issue_change` (string) | `defect_change` | WS messages, state changes, audit |
| `event_id` (TFC field) | `inject_id` | Decision links, API params, audit extraction, WS handler dict keys |
| `issue_id` (TFC field) | `defect_id` | Decision links, DB column + ORM model + schemas, API params, audit |
| `event_type` (field) | `inject_type` | Scenario defs, snapshots |
| `triggered_issues` (field) | `triggered_defects` | Scenario defs, engine |
| `trigger_event_id` (field) | `trigger_inject_id` | Defect trigger config |
| `auto_resolve_ms` (field) | `auto_resolve_pt_ms` | Defect config (also part of ETBOL fix in Part 2) |
| `domain_id` (field) | **deleted** | Exercise model/schema, scenario model/schema, DB columns |
| `TriggerMode.EVENT_BASED` | `TriggerMode.INJECT_BASED` | Enum value and all references |

### File Renames

**Backend engine:**

| Current | New |
|---|---|
| `engine/event_scheduler.py` | `engine/inject_scheduler.py` |
| `engine/event_scheduler_test.py` | `engine/inject_scheduler_test.py` |
| `engine/event_scheduler_p2_test.py` | `engine/inject_scheduler_p2_test.py` |
| `engine/event_scheduler_prop_test.py` | `engine/inject_scheduler_prop_test.py` |
| `engine/issue_manager.py` | `engine/defect_manager.py` |
| `engine/issue_manager_test.py` | `engine/defect_manager_test.py` |
| `engine/issue_manager_prop_test.py` | `engine/defect_manager_prop_test.py` |

**Frontend:**

| Current | New |
|---|---|
| `game-master/event-timeline.component.ts` | `game-master/inject-timeline.component.ts` |
| `game-master/event-timeline.component.spec.ts` | `game-master/inject-timeline.component.spec.ts` |
| `game-master/gm-engine-actions.ts` | `game-master/gm-inject-actions.ts` |
| `scenario-builder/scenario-event-editor.ts` | `scenario-builder/scenario-inject-editor.ts` |
| `scenario-builder/scenario-issue-editor.ts` | `scenario-builder/scenario-defect-editor.ts` |

### ExerciseEngine Internal Renames

| Current | New | Location |
|---|---|---|
| `self._events` | `self._injects` | `exercise_engine.py:37` |
| `self._issues` | `self._defects` | `exercise_engine.py:38` |
| `event_scheduler` property | `inject_scheduler` property | `exercise_engine.py:56` |
| `issue_manager` property | `defect_manager` property | `exercise_engine.py:59` |
| `_handle_decision_events()` | `_handle_decision_injects()` | `exercise_engine.py:151` |
| Snapshot keys `"events"`, `"issues"` | `"injects"`, `"defects"` | `exercise_engine.py:146-147` |
| `self._events.load_events(config.events)` | `self._injects.load_injects(config.injects)` | `exercise_engine.py:44` |
| `self._issues.load_issues(config.issues)` | `self._defects.load_defects(config.defects)` | `exercise_engine.py:45` |
| All `event_id` local vars/params | `inject_id` | Throughout |
| All `issue_id` local vars/params | `defect_id` | Throughout |

### EngineConfig Field Renames

| Current | New | Location |
|---|---|---|
| `events: list[ScheduledEvent]` | `injects: list[ScheduledInject]` | `engine_config.py` |
| `issues: list[TrackedIssue]` | `defects: list[TrackedDefect]` | `engine_config.py` |

### DecisionManager Field Renames

| Current | New | Location |
|---|---|---|
| `ActiveDecision.event_id` | `ActiveDecision.inject_id` | `decision_manager.py:18` |
| `ActiveDecision.issue_id` | `ActiveDecision.defect_id` | `decision_manager.py:19` |
| `open_decision(event_id=, issue_id=)` | `open_decision(inject_id=, defect_id=)` | `decision_manager.py:43-44` |
| Snapshot dict keys `"event_id"`, `"issue_id"` | `"inject_id"`, `"defect_id"` | `decision_manager.py:122-123` |

### ScenarioContent Field Renames

| Current | New | Location |
|---|---|---|
| `ScenarioContent.events` | `ScenarioContent.injects` | `scenario_content.py:70` |
| `ScenarioContent.issues` | `ScenarioContent.defects` | `scenario_content.py:71` |
| `ScenarioPhaseDef.events` | `ScenarioPhaseDef.injects` | `scenario_content.py:59` |

### Scenario Loader Function Renames

| Current | New |
|---|---|
| `load_scenario_events()` | `load_scenario_injects()` |
| `load_scenario_issues()` | `load_scenario_defects()` |

### Decision Feature Renames (DB layer)

| Current | New | Location |
|---|---|---|
| `Decision.issue_id` (ORM) | `Decision.defect_id` | `decision_model.py:17` |
| `CreateDecisionRequest.issue_id` | `.defect_id` | `decision_schema.py:13` |
| `DecisionResponse.issue_id` | `.defect_id` | `decision_schema.py:39` |
| `DecisionDetailResponse.issue_id` | `.defect_id` | `decision_schema.py:51` |
| `decision_service.py` — all `issue_id` refs | `defect_id` | `decision_service.py:40,63,171` |

### Exercise Feature — `domain_id` Removal

Remove `domain_id` from:
- `exercise_model.py:25` — drop `domain_id` column mapping
- `exercise_schema.py` — remove from `CreateExerciseRequest`, `UpdateExerciseRequest`, `ExerciseResponse`
- `exercise_service.py` / `exercise_repository.py` — remove any `domain_id` references
- `scenario_model.py` — drop `domain_id` column mapping
- `scenario_schema.py` — remove from request/response schemas

### Audit Service Renames

| Current | New | Location |
|---|---|---|
| `change.get("event_id")` | `change.get("inject_id")` | `audit_service.py:50` |
| `change.get("issue_id")` | `change.get("defect_id")` | `audit_service.py:50` |

### Hypothesis Strategies File Renames

`engine/strategies.py` — used by property-based tests:

| Current | New |
|---|---|
| `event_ids()` | `inject_ids()` |
| `issue_ids()` | `defect_ids()` |
| `scheduled_events()` | `scheduled_injects()` |
| `tracked_issues()` | `tracked_defects()` |
| All imports (`ScheduledEvent`, `EventType`, etc.) | Updated to new names |
| `triggered_issues=[]` | `triggered_defects=[]` |
| `trigger_event_id=` | `trigger_inject_id=` |
| `TriggerMode.EVENT_BASED` | `TriggerMode.INJECT_BASED` |

### API Path Renames

| Current | New |
|---|---|
| `POST .../events/{event_id}/trigger` | `POST .../injects/{inject_id}/trigger` |
| `POST .../events/{event_id}/cancel` | `POST .../injects/{inject_id}/cancel` |
| `POST .../events/{event_id}/complete` | `POST .../injects/{inject_id}/complete` |
| `POST .../events/{event_id}/pause` | `POST .../injects/{inject_id}/pause` |
| `POST .../events/{event_id}/resume` | `POST .../injects/{inject_id}/resume` |
| `POST .../events/{event_id}/delay` | `POST .../injects/{inject_id}/delay` |
| `POST .../events/{event_id}/skip` | `POST .../injects/{inject_id}/skip` |
| `POST .../issues/{issue_id}/activate` | `POST .../defects/{defect_id}/activate` |
| `POST .../issues/{issue_id}/mitigate` | `POST .../defects/{defect_id}/mitigate` |
| `POST .../issues/{issue_id}/resolve` | `POST .../defects/{defect_id}/resolve` |
| `POST .../issues/{issue_id}/release` | `POST .../defects/{defect_id}/release` |

Operation IDs: `triggerEvent` → `triggerInject`, `cancelEvent` → `cancelInject`, etc. Same pattern for all.

### Frontend TypeScript Interface Renames

**engine-api.service.ts:**

| Current | New |
|---|---|
| `EventSnapshot` interface | `InjectSnapshot` |
| `IssueSnapshot` interface | `DefectSnapshot` |
| `EngineSnapshot.events` field | `EngineSnapshot.injects` |
| `EngineSnapshot.issues` field | `EngineSnapshot.defects` |
| `EventSnapshot.event_type` | `InjectSnapshot.inject_type` |
| `IssueSnapshot.auto_resolve_ms` | `DefectSnapshot.auto_resolve_pt_ms` |

**scenario-api.service.ts:**

| Current | New |
|---|---|
| `ScenarioEventDef` interface | `ScenarioInjectDef` |
| `ScenarioIssueDef` interface | `ScenarioDefectDef` |
| `.event_type` field | `.inject_type` |
| `.triggered_issues` field | `.triggered_defects` |
| `.trigger_event_id` field | `.trigger_inject_id` |
| `ScenarioContent.events` | `ScenarioContent.injects` |
| `ScenarioContent.issues` | `ScenarioContent.defects` |

**decision-api.service.ts:**

| Current | New |
|---|---|
| `ActiveDecision.event_id` | `ActiveDecision.inject_id` |
| `ActiveDecision.issue_id` | `ActiveDecision.defect_id` |
| `DecisionDetail.issue_id` | `DecisionDetail.defect_id` |

### Frontend Store Renames

**exercise.store.ts** — state shape, signals, computed, methods:

| Current | New |
|---|---|
| State `events: EventSnapshot[]` | `injects: InjectSnapshot[]` |
| State `issues: IssueSnapshot[]` | `defects: DefectSnapshot[]` |
| `events` signal | `injects` |
| `issues` signal | `defects` |
| `activeEvents` computed | `activeInjects` |
| `scheduledEvents` computed | `scheduledInjects` |
| `completedEvents` computed | `completedInjects` |
| `activeIssues` computed | `activeDefects` |
| `releasedIssues` computed | `releasedDefects` |
| `issuesWithCountdown` computed | `defectsWithCountdown` |
| `updateEvent()` method | `updateInject()` |
| `updateIssue()` method | `updateDefect()` |
| `applySnapshot()` — `snapshot.events` | `snapshot.injects` |
| `applySnapshot()` — `snapshot.issues` | `snapshot.defects` |

**scenario-builder.store.ts:**

| Current | New |
|---|---|
| `addEvent()` / `removeEvent()` / `updateEvent()` | `addInject()` / `removeInject()` / `updateInject()` |
| `addIssue()` / `removeIssue()` / `updateIssue()` | `addDefect()` / `removeDefect()` / `updateDefect()` |
| `content().events` | `content().injects` |
| `content().issues` | `content().defects` |

### Frontend Service Method Renames

**engine-api.service.ts:**

| Current | New |
|---|---|
| `triggerEvent()` | `triggerInject()` |
| `cancelEvent()` | `cancelInject()` |
| `completeEvent()` | `completeInject()` |
| `pauseEvent()` | `pauseInject()` |
| `resumeEvent()` | `resumeInject()` |
| `delayEvent()` | `delayInject()` |
| `skipEvent()` | `skipInject()` |
| `activateIssue()` | `activateDefect()` |
| `mitigateIssue()` | `mitigateDefect()` |
| `resolveIssue()` | `resolveDefect()` |
| `releaseIssue()` | `releaseDefect()` |

### WS Handler String Literal Renames

**gm-ws-handler.ts:**

| Current | New |
|---|---|
| `'event_change'` | `'inject_change'` |
| `change['event_id']` | `change['inject_id']` |
| `'issue_change'` | `'defect_change'` |
| `change['issue_id']` | `change['defect_id']` |
| `store.updateEvent()` | `store.updateInject()` |
| `store.updateIssue()` | `store.updateDefect()` |

**player-view.ts** (inline WS handler):

Same pattern as above — `'event_change'` → `'inject_change'`, `change['event_id']` → `change['inject_id']`, etc.

### GM Action Helper Renames

**gm-inject-actions.ts** (renamed from `gm-engine-actions.ts`):

| Current | New |
|---|---|
| `createEventActions()` | `createInjectActions()` |
| `createIssueActions()` | `createDefectActions()` |
| Internal calls `api.triggerEvent()` etc. | `api.triggerInject()` etc. |

### Timeline Utility Renames

**timeline-utils.ts:**

| Current | New |
|---|---|
| Parameter `events: EventSnapshot[]` | `injects: InjectSnapshot[]` |
| Parameter `issues: IssueSnapshot[]` | `defects: DefectSnapshot[]` |
| Return `.eventItems` | `.injectItems` |
| Return `.issueItems` | `.defectItems` |

### Review View Renames

**review-view.ts:**

| Current | New |
|---|---|
| Filter `e.entry_type === 'event_change'` | `e.entry_type === 'inject_change'` |
| Card title "Event Summary" | "Inject Summary" |

### DomainService Deletion

**Delete entirely:**
- `apps/tfc/frontend/src/app/core/domain.service.ts`
- `apps/tfc/frontend/src/app/shared/domain-selector.component.ts`
- `apps/tfc/frontend/src/app/shared/domain-selector.component.spec.ts`

**Remove from consumers (10 files):**
All `domain.term('event')` → hardcoded `'Inject'`. All `domain.term('issue')` → hardcoded `'Defect'`. All `domain.term('decision')` → hardcoded `'Decision'`. All `domain.term('exercise')` → hardcoded `'Exercise'`. All `domain.term('participant')` → hardcoded `'Participant'`. All `domain.term('gameMaster')` → hardcoded `'Game Master'`.

Remove `DomainSelectorComponent` from game-master-view template and imports.

### Database Migration (002)

New migration `002_terminology_alignment.py`:

```python
def upgrade():
    # Rename issue_id → defect_id on decisions table
    op.alter_column('tfc_decisions', 'issue_id', new_column_name='defect_id')
    # Drop domain_id columns (DomainService removed)
    op.drop_column('tfc_exercises', 'domain_id')
    op.drop_column('tfc_scenarios', 'domain_id')

def downgrade():
    op.add_column('tfc_scenarios', sa.Column('domain_id', sa.Integer, nullable=True))
    op.add_column('tfc_exercises', sa.Column('domain_id', sa.Integer, nullable=True))
    op.alter_column('tfc_decisions', 'defect_id', new_column_name='issue_id')
```

### Seed Data

`sample_er_scenario.py` dict keys:
- `"events"` → `"injects"` (top-level and inside phase definitions)
- `"issues"` → `"defects"`
- `"event_type"` → `"inject_type"`
- `"triggered_issues"` → `"triggered_defects"`
- `"trigger_event_id"` → `"trigger_inject_id"`

ID values (`evt-*`, `iss-*`) remain unchanged — they are opaque identifiers.

### E2E Fixtures

`apps/tfc/frontend/e2e/fixtures/base.fixture.ts` — remove `domain_id: null` from mock exercise responses.

### Documentation Updates

- `apps/tfc/AGENTS.md` — rename all domain model references (`EventScheduler` → `InjectScheduler`, `IssueManager` → `DefectManager`, etc.), update architecture diagram, update engine concepts section, remove stale `@aspect/tfc-shared` references (`ExerciseEvent`, `Issue`, `EVENT_TRANSITIONS`, `ISSUE_TRANSITIONS`, `DomainConfig`), remove `domain` from shared services list
- `apps/tfc/README.md` — rename all "events"/"issues" references to "injects"/"defects"
- `docs/plans/*.md` — leave as-is (historical records)
- `docs/exercise-control.md` — already uses correct terms, no changes needed

### Full File Inventory

Every file requiring internal terminology changes (beyond the file renames listed above):

**Backend engine (internal renames):**
- `engine/exercise_engine.py` — properties, methods, snapshot keys, imports
- `engine/exercise_engine_test.py` — test classes, fixtures, assertions
- `engine/exercise_engine_p2_test.py` — same
- `engine/engine_config.py` — field names, imports
- `engine/state_changes.py` — TypedDict names, type strings, field names
- `engine/decision_manager.py` — field names, method params, snapshot keys
- `engine/decision_manager_test.py` — test data, assertions
- `engine/decision_manager_p2_test.py` — same
- `engine/decision_manager_prop_test.py` — same
- `engine/strategies.py` — strategy functions, imports, field names
- `engine/conftest.py` — fixture names if applicable

**Backend features (internal renames):**
- `features/exercise/engine_actions_router.py` — paths, params, operation IDs, function names
- `features/exercise/engine_actions_router_test.py` — test data, assertions
- `features/exercise/engine_router.py` — engine property access
- `features/exercise/ws_router.py` — state change type strings if present
- `features/exercise/exercise_model.py` — remove `domain_id`
- `features/exercise/exercise_schema.py` — remove `domain_id`
- `features/exercise/exercise_service.py` — remove `domain_id` references
- `features/decision/decision_model.py` — `issue_id` → `defect_id`
- `features/decision/decision_schema.py` — `issue_id` → `defect_id`
- `features/decision/decision_service.py` — `issue_id` → `defect_id`
- `features/decision/decision_router.py` — if references `issue_id`
- `features/decision/decision_test.py` — test data
- `features/scenario/scenario_content.py` — model names, field names
- `features/scenario/scenario_content_test.py` — test data
- `features/scenario/scenario_content_p2_test.py` — test data
- `features/scenario/scenario_loader.py` — function names, field access
- `features/scenario/scenario_loader_test.py` — test data
- `features/scenario/scenario_model.py` — remove `domain_id`
- `features/scenario/scenario_schema.py` — remove `domain_id` if present
- `features/scenario/sample_er_scenario.py` — dict keys
- `features/scenario/sample_er_scenario_test.py` — test data
- `features/audit/audit_service.py` — dict key extraction
- `features/audit/audit_test.py` — test data strings

**Frontend (internal renames):**
- `core/engine-api.service.ts` — interfaces, methods
- `core/decision-api.service.ts` — interface fields
- `core/scenario-api.service.ts` — interfaces, fields
- `core/exercise-ws.service.ts` — WS message type strings
- `core/exercise.store.ts` — state shape, signals, computed, methods
- `core/exercise.store.spec.ts` — test data
- `features/game-master/game-master-view.ts` — template bindings, imports, DomainService removal
- `features/game-master/game-master-view.spec.ts` — test data
- `features/game-master/gm-ws-handler.ts` — string literals, store calls
- `features/game-master/gm-item-actions.component.ts` — input names
- `features/game-master/gm-item-actions.component.spec.ts` — test data
- `features/game-master/timeline-lane.component.ts` — if references event/issue types
- `features/game-master/timeline-lane.component.spec.ts` — test data
- `features/game-master/timeline-utils.ts` — params, return properties
- `features/game-master/timeline-utils.spec.ts` — test data
- `features/game-master/scenario-picker.ts` — DomainService removal
- `features/game-master/scenario-picker.spec.ts` — test data
- `features/player/player-view.ts` — WS strings, store calls, template text, DomainService removal
- `features/player/player-ws-handler.ts` — string literals, store calls
- `features/scenario-builder/scenario-builder-view.ts` — store calls, DomainService removal
- `features/scenario-builder/scenario-builder.store.ts` — methods, field access
- `features/review/review-view.ts` — filter strings, card titles
- `e2e/fixtures/base.fixture.ts` — remove `domain_id`
- `e2e/tests/*.spec.ts` — if references old terminology

---

## Part 2: Spec Gap Closure

All changes below use the new terminology from Part 1. Absorbed from the prior EXCON default mode design spec.

### Change 1: Inject Execution Mode

**Spec ref:** Line 77 — "Execution mode: automatic, manual, conditional"

| Layer | File (post-rename) | Change |
|---|---|---|
| Engine enum | `inject_scheduler.py` | New `ExecutionMode(StrEnum)`: `AUTOMATIC`, `MANUAL` |
| Engine runtime | `inject_scheduler.py:ScheduledInject` | Add `execution_mode: ExecutionMode = ExecutionMode.AUTOMATIC` |
| Engine logic | `inject_scheduler.py:_should_activate()` | Return `False` if `execution_mode == MANUAL` |
| Scenario content | `scenario_content.py:ScenarioInjectDef` | Add `execution_mode: str = "automatic"` |
| Loader | `scenario_loader.py` | Pass `execution_mode` through via `ExecutionMode(inj.execution_mode)` |
| State changes | `state_changes.py:InjectSnapshot` | Add `execution_mode: str` |
| Snapshot | `inject_scheduler.py:snapshot()` | Include `execution_mode=e.execution_mode.value` |

**Deferred:** `CONDITIONAL` mode — spec doesn't define predicate semantics.

### Change 2: Defect ETBOL RT/PT Split

**Spec ref:** Line 124 — "ETBOL expressed in real and/or play time"

| Layer | File (post-rename) | Change |
|---|---|---|
| Scenario content | `scenario_content.py:ScenarioDefectDef` | `auto_resolve_pt_ms` (renamed from `auto_resolve_ms`). Add `auto_resolve_rt_ms: float = 0` |
| Loader | `scenario_loader.py` | Map both fields to `TrackedDefect` |
| Engine runtime | `defect_manager.py:TrackedDefect` | `auto_resolve_pt_ms` (renamed). Add `auto_resolve_rt_ms: float = 0.0`. Add `activated_at_rt_ms: float | None = None` |
| Engine logic | `defect_manager.py:tick()` | New param `current_rt_ms: float`. Check both countdowns; resolve on whichever expires first. `_activate()` records `activated_at_rt_ms` |
| Engine caller | `exercise_engine.py:tick()` | Pass `self._time.real_time_ms` to `self._defects.tick()` |
| State changes | `state_changes.py:DefectSnapshot` | `auto_resolve_pt_ms` (renamed). Add `auto_resolve_rt_ms: float` |
| Snapshot | `defect_manager.py:snapshot()` | Include both fields |

### Change 3: Fix `all_respond` Completion Mode

**Spec ref:** Line 91 — "All required responses received"

| Layer | File (post-rename) | Change |
|---|---|---|
| Engine | `decision_manager.py` | New method: `all_target_roles_responded(decision_id) -> bool` — checks every role in `target_roles` has at least one recommendation |
| HTTP handler | `engine_router.py:submit_recommendation()` | After recording, check `completion_mode == "all_respond"` and `all_target_roles_responded()`. If yes, call `engine.close_decision()` |

**Semantics:** "All respond" = all `target_roles` have at least one recommendation. Not all participants — all *roles*.

### Change 4: Scoring Hidden During Execution

**Spec ref:** Lines 211-221 — "Scoring is optional and invisible during exercise execution"

**Current state:** The engine snapshot (`exercise_engine.py:snapshot()`) has no `score` key. There is no `GameMode` class in the codebase — scoring lives only in `DecisionService._calculate_score()` at the DB layer.

**Action:** No engine change needed. Scoring is already invisible during execution because it's never been exposed in the snapshot. The spec requirement is satisfied by the current architecture. If a `score` summary is needed post-exercise, it comes from `DecisionService.list_decisions()` which queries the DB — this is already a debrief-only path.

**Verify with test:** Add one test asserting `snapshot()` does not contain a `"score"` key during any phase.

### Change 5: DecisionTemplate.defect_id Optional

**Spec ref:** Line 96 — "Decision points are special injects"

| Layer | File (post-rename) | Change |
|---|---|---|
| Engine config | `engine_config.py:DecisionTemplate` | `defect_id: str | None = None` |
| Scenario content | `scenario_content.py:DecisionTemplateDef` | `defect_id: str | None = None` |

### Phase 2: Audit Completeness

**Spec ref:** Lines 203-210 — "All state transitions and actions are logged... Trainer overrides"

10 entity action endpoints in `engine_actions_router.py` bypass `_on_state_change()` and therefore bypass audit logging. Fix: route all changes through `engine._on_state_change([change])`.

Affected endpoints (post-rename, 10 total):
- `cancel_inject`, `complete_inject`, `pause_inject`, `resume_inject`, `delay_inject`, `skip_inject` (6 inject actions)
- `activate_defect`, `mitigate_defect`, `resolve_defect`, `release_defect` (4 defect actions)

(`trigger_inject` already broadcasts correctly.)

### Phase 3: Codegen

After all backend changes:
1. Run `make generate` for OpenAPI → TypeScript client regeneration
2. Verify frontend compiles with regenerated types
3. Verify all backend tests pass

### Phase 4: Trainer Cockpit UI

5-row layout:

```
Row 1 — Header:
  Exercise title | RT clock | PT clock | Phase badge | Connected trainees

Row 2 — Overview (split):
  Left (flex:2): Inject timeline with parallel lanes (existing, renamed)
  Right (flex:1): Defect list with lifecycle state indicators + ETBOL countdown

Row 3 — Trainee Monitor (new):
  Per-trainee cards: name, role, decision status (pending/submitted/timed_out)
  Live recommendation feed
  "Validate & Close" button (for gm_closes completion mode)

Row 4 — Details (collapsible, new):
  Full metadata for selected inject or defect
  Manual controls: Pause/Cancel/Complete (injects), Activate/Mitigate/Resolve (defects)
  Inject properties: type, execution mode, start time, duration, dependencies, triggered defects

Row 5 — Controls (footer):
  Start/Pause/Resume/Reset/Stop buttons
  Speed slider with factor display
  Connected trainee count
```

### Phase 5: Trainee UI

Feed-centric 3-column layout:

```
Header:
  Exercise title | PT clock | Phase badge

Main (3-column):
  Left (flex:2): Inject feed — chronological (newest on top)
    PT timestamp, title, description, role-specific intel
    Running highlighted, completed dimmed

  Center (flex:1): Defect panel
    Active: title, lifecycle badge, ETBOL countdown
    Resolved: collapsed, dimmed

  Right (sidebar): Context
    Mission briefing, objectives, ROE (read-only)

Decision overlay (blocking modal):
  Appears when decision opens
  Question text, options, role-specific intel
  Submission controls per question type

Footer:
  Role label | Decision History button (drawer)
```

### Phase 6: Scenario Builder Completeness

**6A. Backend:**
- `POST/PUT/DELETE .../scenarios/{id}/injects` — CRUD for injects
- `POST/PUT/DELETE .../scenarios/{id}/defects` — CRUD for defects
- `POST/PUT/DELETE .../scenarios/{id}/decisions` — CRUD for decision templates
- Validation: referential integrity (dependencies, triggered_defects, target_roles all exist)
- New fields: `execution_mode` on injects, `auto_resolve_pt_ms` / `auto_resolve_rt_ms` on defects

**6B. Frontend:**
- Inject editor: execution mode selector, dependencies picker, duration, role targeting
- Defect editor: trigger mode selector, ETBOL (PT and/or RT), linked injects
- Decision editor: completion mode (first_response, all_respond, gm_closes), target roles, timeout, options with scores
- Scenario validation before save

### Phase 7: Integration & E2E

Smoke test flow:
1. Load scenario via builder or seed
2. Create exercise from scenario
3. Trainer starts → running phase
4. Injects fire by schedule (AUTOMATIC) or trainer trigger (MANUAL)
5. Defects activate by time/inject/manual
6. Decision opens → exercise pauses
7. Trainees respond → completion condition met → decision closes
8. Trainer completes exercise → COMPLETED phase
9. Score revealed via decision detail API (debrief path)
10. Audit trail verified: all injects, decisions, trainer overrides logged with RT/PT

---

## Explicitly Deferred

| Item | Reason |
|---|---|
| Conditional execution mode | Spec lists it but defines no predicate semantics |
| Branching/consequence logic | Spec says decisions "influence what happens next" but defines no branching syntax |
| Session state persistence | Engine is in-memory; acceptable for demonstrator |
| Time sync <=250ms | Runtime QoS, not data model |
| Full replay from audit log | Audit exportable; replay UI deferred |
| Parallel trainee groups | Spec mentions as future |
| Stress dimension | Waiting on PM formula |
| `max_selections` on decisions | No server validation yet; not blocking |
| Systems + warfare domains in trainee sidebar | Not in exercise-control.md spec; deferred |
| Defect "control mode" (auto/manual/hybrid for resolution) | Spec line 125 mentions it but current `TriggerMode` + manual override covers the use cases |

## Test Impact

| Change | Existing files to update | New tests |
|---|---|---|
| Terminology rename | All existing test files (rename classes, methods, fixture names) | 0 new (same coverage, new names) |
| Execution mode | 0 existing | 2-3 unit tests for MANUAL skip |
| ETBOL RT/PT | 4 files (rename field) | 3 property tests (PT-only, RT-only, both) |
| `all_respond` | 0 existing | 1-2 integration tests |
| Scoring visibility | 0 existing | 1 test asserting no score key in snapshot |
| `defect_id` optional | 0 existing | 0 |
| Audit completeness | 0 existing | 1 integration test |
