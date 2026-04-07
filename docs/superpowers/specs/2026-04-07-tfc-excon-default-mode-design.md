# TFC EXCON Default Game Mode — Design Spec

**Date:** 2026-04-07
**Source spec:** `docs/exercise-control.md`
**Scope:** Complete the initial default (EXCON/trainer-driven) game mode per the exercise-control spec. Covers engine gaps, audit completeness, trainer cockpit UI, trainee UI, and scenario builder CRUD.

## Approach

Layer-by-layer build optimized for LLM context management. Backend first (stable API contract), codegen once, then frontend. Parallelizable within each phase.

## Data Model Changes (5 passes verified)

### Change 1: Inject Execution Mode

**Spec ref:** Line 77 — "Execution mode: automatic, manual, conditional"

Add a two-value enum to prevent MANUAL events from auto-activating. Conditional mode is **deferred post-MVP** (spec doesn't define predicate semantics; existing `dependencies` field covers "depends on other injects").

| Layer | File | Change |
|-------|------|--------|
| Engine enum | `event_scheduler.py` | New `ExecutionMode(StrEnum)`: `AUTOMATIC`, `MANUAL` |
| Engine runtime | `event_scheduler.py:ScheduledEvent` | Add `execution_mode: ExecutionMode = ExecutionMode.AUTOMATIC` |
| Engine logic | `event_scheduler.py:_should_activate()` | Return `False` if `execution_mode == MANUAL` |
| Scenario content | `scenario_content.py:ScenarioEventDef` | Add `execution_mode: str = "automatic"` |
| Loader | `scenario_loader.py:load_scenario_events()` | Pass `execution_mode` through via `ExecutionMode(evt.execution_mode)` |
| State changes | `state_changes.py:EventSnapshot` | Add `execution_mode: str` |
| Snapshot | `event_scheduler.py:snapshot()` | Include `execution_mode=e.execution_mode.value` |

**Deferred:** `CONDITIONAL` mode with predicate system. Document in AGENTS.md.

### Change 2: Defect ETBOL RT/PT Split

**Spec ref:** Line 124 — "ETBOL expressed in real and/or play time"

Current `auto_resolve_ms` is PT-only. Spec requires RT-based ETBOL support.

| Layer | File | Change |
|-------|------|--------|
| Scenario content | `scenario_content.py:ScenarioIssueDef` | Rename `auto_resolve_ms` → `auto_resolve_pt_ms`. Add `auto_resolve_rt_ms: float = 0` |
| Loader | `scenario_loader.py:load_scenario_issues()` | Map both fields to `TrackedIssue` |
| Engine runtime | `issue_manager.py:TrackedIssue` | Rename `auto_resolve_ms` → `auto_resolve_pt_ms`. Add `auto_resolve_rt_ms: float = 0.0`. Add `activated_at_rt_ms: float \| None = None` |
| Engine logic | `issue_manager.py:tick()` | New param `current_rt_ms: float`. Check both countdowns; resolve on whichever expires first. `_activate()` records `activated_at_rt_ms` |
| Engine caller | `exercise_engine.py:tick()` | Pass `self._time.real_time_ms` to `self._issues.tick()` |
| State changes | `state_changes.py:IssueSnapshot` | Rename `auto_resolve_ms` → `auto_resolve_pt_ms`. Add `auto_resolve_rt_ms: float` |
| Snapshot | `issue_manager.py:snapshot()` | Include both fields |
| Seed data | `seeds/*.json` | Rename all `auto_resolve_ms` → `auto_resolve_pt_ms` (30 occurrences across 3 files) |
| Tests | `issue_manager_test.py`, `issue_manager_prop_test.py`, `scenario_content_test.py`, `sample_er_scenario.py` | Update field names |

### Change 3: Fix `all_respond` Completion Mode

**Spec ref:** Line 91 — "All required responses received"

The engine accepts `all_respond` as a valid completion mode but has **zero logic** to enforce it. Decisions with this mode never auto-close — a latent deadlock.

| Layer | File | Change |
|-------|------|--------|
| Engine | `decision_manager.py` | New method: `all_target_roles_responded(decision_id) -> bool` — checks if every role in `target_roles` has at least one entry in `recommendations` |
| HTTP handler | `engine_router.py:submit_recommendation()` | After recording recommendation, check if `completion_mode == "all_respond"` and `all_target_roles_responded()`. If yes, call `engine.close_decision()` |
| Tests | New test case | Verify: when all target_roles submit, decision auto-closes |

**Semantics:** "All respond" = all `target_roles` have at least one recommendation. Not all participants — all *roles*.

### Change 4: Scoring Visibility Fix

**Spec ref:** Lines 211-221 — "Scoring is optional and invisible during exercise execution. It is computed continuously but revealed only after exercise completion."

Current code exposes live scores in `EngineSnapshot` during RUNNING phase. This violates the spec.

| Layer | File | Change |
|-------|------|--------|
| Engine | `exercise_engine.py:snapshot()` | Return `score=self._config.game_mode.snapshot() if self._phase == EnginePhase.COMPLETED else None` |

One-line change. Score is still computed continuously by the game mode; it's just hidden from the snapshot until the exercise completes.

### Change 5: DecisionTemplate.issue_id Optional

**Spec ref:** Line 96 — "Decision points are special injects"

The spec defines decisions as special injects, not as entities necessarily linked to issues. Making `issue_id` required is an over-constraint.

| Layer | File | Change |
|-------|------|--------|
| Engine config | `engine_config.py:DecisionTemplate` | Change `issue_id: str` → `issue_id: str \| None = None` |
| Scenario content | `scenario_content.py:DecisionTemplateDef` | Change `issue_id: str` → `issue_id: str \| None = None` |
| State changes | `state_changes.py:DecisionSnapshot` | Already `issue_id: str \| None` — no change needed |

## What Is Already Complete (Verified)

| Spec concept | Implementation | Verified in |
|---|---|---|
| Inject lifecycle (6 states) | `EventLifecycle` enum | `event_scheduler.py:18-24` |
| Inject dependencies | `ScheduledEvent.dependencies` + `_should_activate()` | `event_scheduler.py:57,199-212` |
| Inject duration (instantaneous or timed) | `ScheduledEvent.duration_ms` (None = instantaneous) | `event_scheduler.py:56,109-115` |
| Inject types (informational, operational, decision) | `EventType` enum | `event_scheduler.py:27-31` |
| Inject role targeting | `target_roles` + `role_descriptions` | `event_scheduler.py:62-63` |
| Inject GM controls (7 actions) | trigger, cancel, complete, pause, resume, delay, skip | `engine_actions_router.py:42-113` |
| Defect lifecycle (4 states) | `IssueLifecycle` enum | `issue_manager.py:19-23` |
| Defect trigger modes (3) | `TriggerMode`: TIME_BASED, EVENT_BASED, MANUAL | `issue_manager.py:26-29` |
| Defect visibility on activation | `released_to_players = True` on activate | `issue_manager.py:188` |
| Defect GM controls (4 actions) | activate, mitigate, resolve, release | `engine_actions_router.py:119-152` |
| Decision question types | `question_type` field (single_choice, multi_choice, free_text) | `decision_manager.py:30` |
| Decision target roles | `target_roles` field | `decision_manager.py:33` |
| Decision timeout | `timeout_ms` + `_timeout_loop()` | `exercise_engine.py:508-524` |
| Completion: first_response | Implemented in decision_service | `decision_service.py:112` |
| Completion: gm_closes (trainer validation) | GM calls `close_decision()` manually | `engine_router.py:241` |
| Dual time (RT + PT) | `TimeManager` with factor, pause/resume safe | `time_manager.py` |
| Time factor runtime adjustment | `set_speed()` endpoint | `engine_router.py:225` |
| System power + operational states | `SystemManager` | `system_manager.py` |
| Warfare domains (code-only, not in spec) | `WarfareDomainManager` | `warfare_domain_manager.py` |
| Audit trail with RT/PT timestamps | `AuditEntry` model, `log_engine_changes()` | `audit_service.py:37-72` |

## Phase 2: Audit Completeness

**Problem:** Entity action endpoints in `engine_actions_router.py` do not call `_log_to_audit()`. Only `engine_router.py` endpoints log. This means trainer overrides on individual injects/defects are not captured in the audit trail.

**Spec ref:** Lines 203-210 — "All state transitions and actions are logged... Trainer overrides"

**Fix:** After each entity action endpoint returns a change, broadcast it via `_on_state_change` (which already calls `_log_to_audit`). The pattern: call `engine._on_state_change([change])` instead of returning the raw change.

Affected endpoints (8 total):
- `cancel_event`, `complete_event`, `pause_event`, `resume_event`, `delay_event`, `skip_event`
- `activate_issue`, `mitigate_issue`, `resolve_issue`, `release_issue`

`trigger_event` already broadcasts via `engine._on_state_change`. The other 8 bypass it.

## Phase 3: Codegen

After all backend changes are complete:

```bash
python apps/tfc/codegen/generate-types.py
```

Regenerates `state-changes.types.ts` with:
- `EventSnapshot.execution_mode: string`
- `IssueSnapshot.auto_resolve_pt_ms: number`
- `IssueSnapshot.auto_resolve_rt_ms: number`

Then run `make generate` for the full OpenAPI → TypeScript client regeneration.

## Phase 4: Trainer Cockpit UI

Layout: **Enhanced 4-Row + Trainee Monitor** (selected during brainstorming).

```
Row 1 — Header:
  Exercise title | RT clock | PT clock | Phase badge | Connected trainees

Row 2 — Overview (split):
  Left (flex:2): Inject timeline with parallel lanes (existing event-timeline.component.ts)
  Right (flex:1): Defect list with lifecycle state indicators + ETBOL countdown

Row 3 — Trainee Monitor (new):
  Per-trainee cards showing: name, role, decision status (pending/submitted/timed_out)
  Live recommendation feed
  "Validate & Close" button (for gm_closes completion mode)

Row 4 — Details (collapsible, new):
  Full metadata for selected inject or defect
  Manual controls: Pause/Cancel/Complete (injects), Activate/Mitigate/Resolve (defects)
  Inject properties: type, execution mode, start time, duration, dependencies, triggered issues

Row 5 — Controls (footer):
  Start/Pause/Resume/Reset/Stop buttons
  Speed slider with factor display
  Connected trainee count
```

### Tasks (parallelizable):

**4A. Layout refactor** — Restructure `game-master-view.ts` into the 5-row layout. Move existing components into rows.

**4B. Details panel** — New component. Click an inject/defect in overview → opens full detail view with action buttons in Row 4.

**4C. Trainee monitor** — New component. Shows connected trainees, their current decision status, live recommendations. Needs WS data from `RecommendationSubmitted` changes.

## Phase 5: Trainee UI

Layout: **Feed-Centric** (selected during brainstorming).

```
Header:
  Exercise title | Stress bar | PT clock | Phase badge

Main (3-column):
  Left (flex:2): Inject feed — chronological list of released injects (newest on top)
    Each entry: PT timestamp, title, description, role-specific intel
    Running inject highlighted, completed injects dimmed

  Center (flex:1): Defect panel
    Active defects: title, lifecycle badge, ETBOL countdown, severity color
    Resolved defects: collapsed, dimmed

  Right (sidebar): Systems + Threats
    System status chips (power + operational traffic light)
    Warfare domain chips (threat level)

Decision overlay (blocking modal):
  Appears when decision opens (in classic mode, exercise pauses)
  Question text, options, role-specific intel
  Submission controls per question type

Footer:
  Role label | Context button (non-blocking side panel) | Decision History button (drawer)
```

### Tasks (parallelizable):

**5A. Inject feed** — New component. Scrollable chronological list of all released injects. Not just current turn — all past injects visible.

**5B. Defect panel** — New component. Active + resolved defects with lifecycle indicators and ETBOL countdown.

**5C. Decision overlay** — Refactor existing role-card decision UI into a blocking modal/overlay that appears on top of the feed layout.

## Phase 6: Scenario Builder CRUD

### 6A. Backend

Complete scenario content API for authoring injects, defects, and decision points:

- `POST/PUT/DELETE .../scenarios/{id}/events` — CRUD for injects within a scenario
- `POST/PUT/DELETE .../scenarios/{id}/issues` — CRUD for defects
- `POST/PUT/DELETE .../scenarios/{id}/decisions` — CRUD for decision templates
- Validation: enforce referential integrity (dependencies exist, triggered_issues exist, target_roles exist)
- New fields: `execution_mode` on events, `auto_resolve_pt_ms` / `auto_resolve_rt_ms` on issues

### 6B. Frontend

Complete the scenario builder UI:

- Inject editor: execution mode selector (automatic/manual), dependencies picker, duration, role targeting, system/domain effects
- Defect editor: trigger mode selector, ETBOL (PT and/or RT), linked events
- Decision editor: completion mode selector (first_response, all_respond, gm_closes), target roles, timeout, options with scores/effects
- Scenario preview/validation: dry-run validation before saving

## Phase 7: Integration & E2E

End-to-end smoke test flow:

1. Load scenario via builder or seed
2. Create exercise from scenario
3. Trainer starts exercise → briefing phase
4. Trainer begins exercise → running phase
5. Injects fire by schedule (AUTOMATIC) or trainer trigger (MANUAL)
6. Defects activate by time/event/manual
7. Decision opens → exercise pauses (classic mode)
8. Trainees respond → completion condition met → decision closes
9. System/domain effects applied
10. Trainer completes exercise → COMPLETED phase
11. Score revealed in snapshot
12. Audit trail verified: all events, decisions, trainer overrides logged with RT/PT

## Explicitly Deferred (Not in This Delivery)

| Item | Reason |
|------|--------|
| Conditional execution mode | Spec line 77 lists it but doesn't define predicate semantics. Existing `dependencies` covers "depends on other injects". |
| Trainee defect acknowledgment | Spec says "visible to trainees once active" — observation is passive, not an action requiring tracking. |
| `closed_by` attribution on decisions | `gm_closes` completion mode already covers "trainer validation". Audit trail captures who called the endpoint. |
| Role-based inject/defect visibility filtering | Snapshot is currently unfiltered. HTTP layer can filter per-role later. |
| Session state persistence across server restart | Engine is in-memory. Audit trail persists. Acceptable for demonstrator. |
| Branching/consequence logic for decisions | Spec says decisions "influence what happens next" but defines no branching syntax. Linear sequence assumed. |
| Time sync ±250ms accuracy | Runtime QoS, not data model. |
| Post-exercise replay from audit log | Audit is exportable via GET endpoint. Actual replay UI deferred. |

## Codegen Checklist

```
After all backend changes:
[ ] Run: python apps/tfc/codegen/generate-types.py
[ ] Run: make generate
[ ] Verify: state-changes.types.ts includes new fields
[ ] Verify: frontend compiles with regenerated types
[ ] Verify: all backend tests pass (make validate)
```

## Test Impact

| Change | Files to update | New tests needed |
|--------|----------------|-----------------|
| Change 1 (execution mode) | 0 existing | 2-3 tests for MANUAL skip in _should_activate() |
| Change 2 (ETBOL RT/PT) | 4 files (rename auto_resolve_ms) | 3 property tests (PT-only, RT-only, both) |
| Change 3 (all_respond) | 0 existing | 1-2 integration tests for auto-close |
| Change 4 (scoring visibility) | 0 existing | 1 test verifying score=None during RUNNING |
| Change 5 (issue_id optional) | 0 existing | 0 (relaxing a constraint) |
| Phase 2 (audit) | 0 existing | 1 integration test verifying entity actions are logged |
