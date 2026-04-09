# TFC Terminology Alignment & Spec Gap Closure — Design Spec

**Date:** 2026-04-09
**Source spec:** `docs/exercise-control.md`
**Supersedes:** `docs/superpowers/specs/2026-04-07-tfc-excon-default-mode-design.md` (absorbs all its content)
**Scope:** (1) Rename all TFC domain vocabulary to match the spec's fixed terms. (2) Delete the DomainService and all domain-config infrastructure. (3) Close all remaining gaps between the implementation and `exercise-control.md`.

## Part 1: Terminology Rename

### Principle

The spec uses fixed terms: **inject**, **defect**, **decision point**. The codebase currently uses "event" for inject and "issue" for defect. The DomainService that provided flexible per-domain vocabulary is deleted — there is one vocabulary, period.

### Rename Map

| Current | New | Applies to |
|---|---|---|
| `Event` (class prefix) | `Inject` | `EventScheduler` → `InjectScheduler`, `ScheduledEvent` → `ScheduledInject`, `EventLifecycle` → `InjectLifecycle`, `EventType` → `InjectType`, `EventSnapshot` → `InjectSnapshot`, `EventChange` → `InjectChange`, `ScenarioEventDef` → `ScenarioInjectDef` |
| `Issue` (class prefix) | `Defect` | `IssueManager` → `DefectManager`, `TrackedIssue` → `TrackedDefect`, `IssueLifecycle` → `DefectLifecycle`, `IssueSnapshot` → `DefectSnapshot`, `IssueChange` → `DefectChange`, `ScenarioIssueDef` → `ScenarioDefectDef` |
| `event_change` (string) | `inject_change` | WS messages, state changes, audit |
| `issue_change` (string) | `defect_change` | WS messages, state changes, audit |
| `event_id` (TFC field) | `inject_id` | Decision links, API params, audit extraction |
| `issue_id` (TFC field) | `defect_id` | Decision links, DB column, API params, audit |
| `event_type` (field) | `inject_type` | Scenario defs, snapshots |
| `triggered_issues` (field) | `triggered_defects` | Scenario defs, engine |
| `trigger_event_id` (field) | `trigger_inject_id` | Defect trigger config |
| `auto_resolve_ms` (field) | `auto_resolve_pt_ms` | Defect config (also part of ETBOL fix in Part 2) |

**Scope guard:** Only TFC domain terms are renamed. Generic programming uses of "event" (Angular `EventEmitter`, DOM events, `@HostListener`, etc.) are untouched.

### File Renames

| Current | New |
|---|---|
| `engine/event_scheduler.py` | `engine/inject_scheduler.py` |
| `engine/event_scheduler_test.py` | `engine/inject_scheduler_test.py` |
| `engine/event_scheduler_p2_test.py` | `engine/inject_scheduler_p2_test.py` |
| `engine/event_scheduler_prop_test.py` | `engine/inject_scheduler_prop_test.py` |
| `engine/issue_manager.py` | `engine/defect_manager.py` |
| `engine/issue_manager_test.py` | `engine/defect_manager_test.py` |
| `engine/issue_manager_prop_test.py` | `engine/defect_manager_prop_test.py` |
| `frontend/.../event-timeline.component.ts` | `frontend/.../inject-timeline.component.ts` |
| `frontend/.../event-timeline.component.spec.ts` | `frontend/.../inject-timeline.component.spec.ts` |
| `frontend/.../scenario-event-editor.ts` | `frontend/.../scenario-inject-editor.ts` |
| `frontend/.../scenario-issue-editor.ts` | `frontend/.../scenario-defect-editor.ts` |
| `frontend/.../gm-event-actions.ts` (if exists) | `frontend/.../gm-inject-actions.ts` |

### API Path Renames

| Current | New |
|---|---|
| `POST .../injects/{inject_id}/trigger` | (was `/events/{event_id}/trigger`) |
| `POST .../injects/{inject_id}/cancel` | (was `/events/{event_id}/cancel`) |
| `POST .../injects/{inject_id}/complete` | (was `/events/{event_id}/complete`) |
| `POST .../injects/{inject_id}/pause` | (was `/events/{event_id}/pause`) |
| `POST .../injects/{inject_id}/resume` | (was `/events/{event_id}/resume`) |
| `POST .../injects/{inject_id}/delay` | (was `/events/{event_id}/delay`) |
| `POST .../injects/{inject_id}/skip` | (was `/events/{event_id}/skip`) |
| `POST .../defects/{defect_id}/activate` | (was `/issues/{issue_id}/activate`) |
| `POST .../defects/{defect_id}/mitigate` | (was `/issues/{issue_id}/mitigate`) |
| `POST .../defects/{defect_id}/resolve` | (was `/issues/{issue_id}/resolve`) |
| `POST .../defects/{defect_id}/release` | (was `/issues/{issue_id}/release`) |

### Frontend Store Renames

| Current | New |
|---|---|
| `events` signal | `injects` |
| `issues` signal | `defects` |
| `activeEvents` | `activeInjects` |
| `scheduledEvents` | `scheduledInjects` |
| `completedEvents` | `completedInjects` |
| `activeIssues` | `activeDefects` |
| `releasedIssues` | `releasedDefects` |
| `issuesWithCountdown` | `defectsWithCountdown` |
| `updateEvent()` | `updateInject()` |
| `updateIssue()` | `updateDefect()` |

### Frontend Service Method Renames

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

### Scenario Builder Store Renames

| Current | New |
|---|---|
| `addEvent()` / `removeEvent()` / `updateEvent()` | `addInject()` / `removeInject()` / `updateInject()` |
| `addIssue()` / `removeIssue()` / `updateIssue()` | `addDefect()` / `removeDefect()` / `updateDefect()` |

### DomainService Deletion

**Delete entirely:**
- `apps/tfc/frontend/src/app/core/domain.service.ts`
- `apps/tfc/frontend/src/app/shared/domain-selector.component.ts`
- `apps/tfc/frontend/src/app/shared/domain-selector.component.spec.ts`

**Remove from consumers (10 files):**
All `domain.term('event')` calls → hardcoded `'Inject'`. All `domain.term('issue')` calls → hardcoded `'Defect'`. All `domain.term('decision')` calls → hardcoded `'Decision'`. All `domain.term('exercise')` calls → hardcoded `'Exercise'`. All `domain.term('participant')` calls → hardcoded `'Participant'`. All `domain.term('gameMaster')` calls → hardcoded `'Game Master'`.

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
- `"events"` → `"injects"`
- `"issues"` → `"defects"`
- `"event_type"` → `"inject_type"`
- `"triggered_issues"` → `"triggered_defects"`
- `"trigger_event_id"` → `"trigger_inject_id"`

ID values (`evt-*`, `iss-*`) remain unchanged — they are opaque identifiers.

### Documentation Updates

- `apps/tfc/AGENTS.md` — rename all domain model references, update architecture diagrams, update engine concepts section
- `docs/plans/*.md` — leave as-is (historical records)
- `docs/exercise-control.md` — already uses correct terms, no changes needed

### TriggerMode Rename

`TriggerMode.EVENT_BASED` → `TriggerMode.INJECT_BASED` (enum value and all references).

---

## Part 2: Spec Gap Closure

All changes below use the new terminology from Part 1. These are absorbed from the prior EXCON default mode design spec with no semantic changes.

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
| Scenario content | `scenario_content.py:ScenarioDefectDef` | Rename `auto_resolve_ms` → `auto_resolve_pt_ms`. Add `auto_resolve_rt_ms: float = 0` |
| Loader | `scenario_loader.py` | Map both fields to `TrackedDefect` |
| Engine runtime | `defect_manager.py:TrackedDefect` | Rename `auto_resolve_ms` → `auto_resolve_pt_ms`. Add `auto_resolve_rt_ms: float = 0.0`. Add `activated_at_rt_ms: float | None = None` |
| Engine logic | `defect_manager.py:tick()` | New param `current_rt_ms: float`. Check both countdowns; resolve on whichever expires first. `_activate()` records `activated_at_rt_ms` |
| Engine caller | `exercise_engine.py:tick()` | Pass `self._time.real_time_ms` to `self._defects.tick()` |
| State changes | `state_changes.py:DefectSnapshot` | Rename `auto_resolve_ms` → `auto_resolve_pt_ms`. Add `auto_resolve_rt_ms: float` |
| Snapshot | `defect_manager.py:snapshot()` | Include both fields |

### Change 3: Fix `all_respond` Completion Mode

**Spec ref:** Line 91 — "All required responses received"

| Layer | File (post-rename) | Change |
|---|---|---|
| Engine | `decision_manager.py` | New method: `all_target_roles_responded(decision_id) -> bool` |
| HTTP handler | `engine_router.py:submit_recommendation()` | After recording, check `all_respond` + `all_target_roles_responded()`. If yes, call `engine.close_decision()` |

### Change 4: Scoring Hidden During Execution

**Spec ref:** Lines 211-221 — "Scoring is optional and invisible during exercise execution"

| Layer | File (post-rename) | Change |
|---|---|---|
| Engine | `exercise_engine.py:snapshot()` | Return `score=self._config.game_mode.snapshot() if self._phase == EnginePhase.COMPLETED else None` |

### Change 5: DecisionTemplate.defect_id Optional

**Spec ref:** Line 96 — "Decision points are special injects"

| Layer | File (post-rename) | Change |
|---|---|---|
| Engine config | `engine_config.py:DecisionTemplate` | `defect_id: str | None = None` |
| Scenario content | `scenario_content.py:DecisionTemplateDef` | `defect_id: str | None = None` |

### Phase 2: Audit Completeness

**Spec ref:** Lines 203-210 — "All state transitions and actions are logged... Trainer overrides"

8 entity action endpoints in `engine_actions_router.py` bypass `_on_state_change()` and therefore bypass audit logging. Fix: route all changes through `engine._on_state_change([change])`.

Affected endpoints (post-rename):
- `cancel_inject`, `complete_inject`, `pause_inject`, `resume_inject`, `delay_inject`, `skip_inject`
- `activate_defect`, `mitigate_defect`, `resolve_defect`, `release_defect`

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
9. Score revealed in snapshot
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

## Test Impact

| Change | Existing files to update | New tests |
|---|---|---|
| Terminology rename | All existing test files (rename classes, methods, fixture names) | 0 new (same coverage, new names) |
| Execution mode | 0 existing | 2-3 unit tests for MANUAL skip |
| ETBOL RT/PT | 4 files (rename field) | 3 property tests (PT-only, RT-only, both) |
| `all_respond` | 0 existing | 1-2 integration tests |
| Scoring visibility | 0 existing | 1 test for score=None during RUNNING |
| `defect_id` optional | 0 existing | 0 |
| Audit completeness | 0 existing | 1 integration test |
