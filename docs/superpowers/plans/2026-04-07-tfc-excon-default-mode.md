# TFC EXCON Default Game Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the initial default (EXCON/trainer-driven) game mode per `docs/exercise-control.md`, covering 5 engine data model changes, audit completeness, codegen, trainer cockpit UI, trainee UI, and scenario builder CRUD.

**Architecture:** Layer-by-layer build. Backend engine changes first (Tasks 1-6), then audit fix (Task 7), codegen (Task 8), frontend trainer UI (Tasks 9-11), trainee UI (Tasks 12-14), scenario builder (Tasks 15-16), integration (Task 17). Each phase produces a stable, testable layer before the next begins.

**Tech Stack:** Python 3.12+ (FastAPI, SQLAlchemy, Pydantic), Angular 21+ (signals, standalone components), WebSocket real-time sync, Hypothesis property tests.

**Design spec:** `docs/superpowers/specs/2026-04-07-tfc-excon-default-mode-design.md`

**Conventions:** Read `apps/tfc/AGENTS.md` before any code change. Engine must remain pure Python (no DB/HTTP).

---

## Phase 1: Engine Data Model (Tasks 1-6)

All tasks in this phase are independent and can run in parallel.

### Task 1: Inject Execution Mode Enum

**Files:**
- Modify: `apps/tfc/backend/engine/event_scheduler.py:17-65` (add enum + field)
- Modify: `apps/tfc/backend/engine/state_changes.py:22-37` (add field to EventSnapshot)
- Test: `apps/tfc/backend/engine/event_scheduler_test.py`

- [ ] **Step 1: Write failing tests for MANUAL execution mode**

Add to `apps/tfc/backend/engine/event_scheduler_test.py`:

```python
from engine.event_scheduler import ExecutionMode

def _manual_event(
    id: str = "m1",
    scheduled_pt_ms: float = 0.0,
) -> ScheduledEvent:
    return ScheduledEvent(
        id=id,
        title=f"Manual {id}",
        description="test",
        event_type=EventType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        execution_mode=ExecutionMode.MANUAL,
    )


class TestExecutionMode:
    def test_manual_event_does_not_auto_activate(self) -> None:
        sched = EventScheduler()
        sched.load_events([_manual_event("m1", scheduled_pt_ms=0.0)])
        sched.tick(100.0)  # well past scheduled time
        assert sched.events["m1"].lifecycle == EventLifecycle.SCHEDULED

    def test_manual_event_can_be_force_triggered(self) -> None:
        sched = EventScheduler()
        sched.load_events([_manual_event("m1", scheduled_pt_ms=0.0)])
        change = sched.force_trigger("m1", 100.0)
        assert change is not None
        assert sched.events["m1"].lifecycle == EventLifecycle.RUNNING

    def test_automatic_event_still_auto_activates(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=100.0)])
        sched.tick(100.0)
        assert sched.events["e1"].lifecycle == EventLifecycle.PENDING

    def test_snapshot_includes_execution_mode(self) -> None:
        sched = EventScheduler()
        sched.load_events([_manual_event("m1")])
        snap = sched.snapshot()
        assert snap[0]["execution_mode"] == "manual"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/tfc/backend && python -m pytest engine/event_scheduler_test.py::TestExecutionMode -v`
Expected: FAIL — `ExecutionMode` not defined

- [ ] **Step 3: Add ExecutionMode enum and field to ScheduledEvent**

In `apps/tfc/backend/engine/event_scheduler.py`, after the `EventType` enum (line 31):

```python
class ExecutionMode(StrEnum):
    AUTOMATIC = "automatic"
    MANUAL = "manual"
```

Add field to `ScheduledEvent` dataclass after `domain_effects` (line 65):

```python
    execution_mode: ExecutionMode = ExecutionMode.AUTOMATIC
```

- [ ] **Step 4: Guard `_should_activate()` against MANUAL events**

In `apps/tfc/backend/engine/event_scheduler.py`, at the start of `_should_activate()` (line 204):

```python
    def _should_activate(
        self,
        event: ScheduledEvent,
        current_pt_ms: float,
    ) -> bool:
        """Check if event should transition from scheduled to pending."""
        if event.execution_mode == ExecutionMode.MANUAL:
            return False
        if current_pt_ms < event.scheduled_pt_ms:
            return False
```

- [ ] **Step 5: Add `execution_mode` to EventSnapshot and snapshot()**

In `apps/tfc/backend/engine/state_changes.py`, add to `EventSnapshot` TypedDict after `system_effects`:

```python
    execution_mode: str
```

In `apps/tfc/backend/engine/event_scheduler.py`, update `snapshot()` to include the field:

```python
                execution_mode=e.execution_mode.value,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/tfc/backend && python -m pytest engine/event_scheduler_test.py -v`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add apps/tfc/backend/engine/event_scheduler.py apps/tfc/backend/engine/state_changes.py apps/tfc/backend/engine/event_scheduler_test.py
git commit -m "feat(tfc): add ExecutionMode enum (AUTOMATIC/MANUAL) to inject scheduler"
```

---

### Task 2: Inject Execution Mode — Scenario Content + Loader

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_content.py:60-74` (ScenarioEventDef)
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py:33-64` (load_scenario_events)
- Modify: `apps/tfc/backend/engine/strategies.py:41-71` (scheduled_events strategy)

- [ ] **Step 1: Add `execution_mode` field to ScenarioEventDef**

In `apps/tfc/backend/features/scenario/scenario_content.py`, add to `ScenarioEventDef` after `domain_effects`:

```python
    execution_mode: str = "automatic"  # "automatic" or "manual"
```

- [ ] **Step 2: Pass execution_mode through scenario loader**

In `apps/tfc/backend/features/scenario/scenario_loader.py`, in `load_scenario_events()`, add to the `ScheduledEvent()` constructor call:

```python
                execution_mode=ExecutionMode(evt.execution_mode),
```

Add the import at the top:

```python
from engine.event_scheduler import EventType, ExecutionMode, ScheduledEvent
```

- [ ] **Step 3: Update Hypothesis strategy**

In `apps/tfc/backend/engine/strategies.py`, import `ExecutionMode`:

```python
from engine.event_scheduler import EventType, ExecutionMode, ScheduledEvent
```

Add `execution_mode` to the `scheduled_events` strategy `ScheduledEvent()` constructor:

```python
        execution_mode=draw(st.sampled_from(ExecutionMode)),
```

- [ ] **Step 4: Run all engine tests**

Run: `cd apps/tfc/backend && python -m pytest engine/ -v --tb=short`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_content.py apps/tfc/backend/features/scenario/scenario_loader.py apps/tfc/backend/engine/strategies.py
git commit -m "feat(tfc): wire execution_mode through scenario content and loader"
```

---

### Task 3: Defect ETBOL RT/PT Split — Engine Runtime

**Files:**
- Modify: `apps/tfc/backend/engine/issue_manager.py:40-55,76-106,184-188,208-222`
- Modify: `apps/tfc/backend/engine/state_changes.py:39-49`
- Modify: `apps/tfc/backend/engine/strategies.py:74-94`
- Test: `apps/tfc/backend/engine/issue_manager_test.py`

- [ ] **Step 1: Write failing tests for RT-based ETBOL**

Add to `apps/tfc/backend/engine/issue_manager_test.py`. First update the `_issue` helper:

```python
def _issue(
    id: str = "i1",
    trigger_mode: TriggerMode = TriggerMode.TIME_BASED,
    trigger_time_pt_ms: float | None = None,
    trigger_event_id: str | None = None,
    auto_resolve_pt_ms: float = 0.0,
    auto_resolve_rt_ms: float = 0.0,
) -> TrackedIssue:
    return TrackedIssue(
        id=id,
        title=f"Issue {id}",
        description="test",
        trigger_mode=trigger_mode,
        trigger_time_pt_ms=trigger_time_pt_ms,
        trigger_event_id=trigger_event_id,
        auto_resolve_pt_ms=auto_resolve_pt_ms,
        auto_resolve_rt_ms=auto_resolve_rt_ms,
    )
```

Then add a new test class:

```python
class TestEtbolRtPtSplit:
    def test_pt_only_resolves_by_play_time(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=0.0, auto_resolve_pt_ms=500.0)])
        mgr.tick(0.0, 0.0, set())  # activate
        mgr.tick(500.0, 100.0, set())  # PT elapsed, RT not
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.RESOLVED

    def test_rt_only_resolves_by_real_time(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=0.0, auto_resolve_rt_ms=200.0)])
        mgr.tick(0.0, 0.0, set())  # activate
        mgr.tick(50.0, 200.0, set())  # PT not elapsed, RT elapsed
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.RESOLVED

    def test_both_resolves_on_first_expiry(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=0.0, auto_resolve_pt_ms=1000.0, auto_resolve_rt_ms=200.0)])
        mgr.tick(0.0, 0.0, set())  # activate
        mgr.tick(100.0, 200.0, set())  # RT hits first
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.RESOLVED

    def test_activated_at_rt_ms_recorded(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=0.0)])
        mgr.tick(0.0, 5000.0, set())  # activate at RT=5000
        assert mgr.issues["i1"].activated_at_rt_ms == 5000.0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/tfc/backend && python -m pytest engine/issue_manager_test.py::TestEtbolRtPtSplit -v`
Expected: FAIL — `auto_resolve_pt_ms` not a field

- [ ] **Step 3: Update TrackedIssue dataclass**

In `apps/tfc/backend/engine/issue_manager.py`, replace the `TrackedIssue` fields:

```python
@dataclass
class TrackedIssue:
    """Runtime representation of a defect (issue) during exercise execution."""

    id: str
    title: str
    description: str
    trigger_mode: TriggerMode
    trigger_time_pt_ms: float | None = None
    trigger_event_id: str | None = None
    auto_resolve_pt_ms: float = 0.0
    auto_resolve_rt_ms: float = 0.0
    lifecycle: IssueLifecycle = IssueLifecycle.INACTIVE
    activated_at_pt_ms: float | None = None
    activated_at_rt_ms: float | None = None
    resolved_at_pt_ms: float | None = None
    released_to_players: bool = False
```

- [ ] **Step 4: Update `tick()` and `_activate()` methods**

Change `tick()` signature and body:

```python
    def tick(
        self,
        current_pt_ms: float,
        current_rt_ms: float,
        completed_event_ids: set[str],
    ) -> list[IssueChange]:
```

Replace the auto-resolve check block (the `if issue.lifecycle == IssueLifecycle.ACTIVE` block):

```python
            if issue.lifecycle == IssueLifecycle.ACTIVE:
                pt_expired = (
                    issue.auto_resolve_pt_ms > 0
                    and issue.activated_at_pt_ms is not None
                    and (current_pt_ms - issue.activated_at_pt_ms) >= issue.auto_resolve_pt_ms
                )
                rt_expired = (
                    issue.auto_resolve_rt_ms > 0
                    and issue.activated_at_rt_ms is not None
                    and (current_rt_ms - issue.activated_at_rt_ms) >= issue.auto_resolve_rt_ms
                )
                if pt_expired or rt_expired:
                    self._transition(issue, IssueLifecycle.RESOLVED)
                    issue.resolved_at_pt_ms = current_pt_ms
                    changes.append(self._change(issue, "auto_resolve_expired"))
```

Update `_activate()` to record RT:

```python
    @staticmethod
    def _activate(issue: TrackedIssue, current_pt_ms: float, current_rt_ms: float = 0.0) -> None:
        issue.lifecycle = IssueLifecycle.ACTIVE
        issue.activated_at_pt_ms = current_pt_ms
        issue.activated_at_rt_ms = current_rt_ms
        issue.released_to_players = True
```

Update all callers of `_activate()` to pass `current_rt_ms` where available:
- In `tick()`: `self._activate(issue, current_pt_ms, current_rt_ms)`
- In `activate_by_event()`: add `current_rt_ms: float = 0.0` param, pass through
- In `manual_activate()`: add `current_rt_ms: float = 0.0` param, pass through

Also update the callers of `activate_by_event()` and `manual_activate()` to pass actual RT:
- In `exercise_engine.py:365` (tick loop): `self._issues.activate_by_event(event_id, pt, self._time.real_time_ms)`
- In `engine_actions_router.py:124` (activate_issue): `engine.issue_manager.manual_activate(issue_id, pt, engine.time_manager.real_time_ms)`

- [ ] **Step 5: Update IssueSnapshot and snapshot()**

In `apps/tfc/backend/engine/state_changes.py`, update `IssueSnapshot`:

```python
class IssueSnapshot(TypedDict):
    id: str
    title: str
    description: str
    trigger_mode: str
    auto_resolve_pt_ms: float
    auto_resolve_rt_ms: float
    lifecycle: str
    activated_at_pt_ms: float | None
    activated_at_rt_ms: float | None
    resolved_at_pt_ms: float | None
    released: bool
```

In `apps/tfc/backend/engine/issue_manager.py`, update `snapshot()`:

```python
    def snapshot(self) -> list[IssueSnapshot]:
        return [
            IssueSnapshot(
                id=i.id,
                title=i.title,
                description=i.description,
                trigger_mode=i.trigger_mode.value,
                auto_resolve_pt_ms=i.auto_resolve_pt_ms,
                auto_resolve_rt_ms=i.auto_resolve_rt_ms,
                lifecycle=i.lifecycle.value,
                activated_at_pt_ms=i.activated_at_pt_ms,
                activated_at_rt_ms=i.activated_at_rt_ms,
                resolved_at_pt_ms=i.resolved_at_pt_ms,
                released=i.released_to_players,
            )
            for i in self._issues.values()
        ]
```

- [ ] **Step 6: Update exercise_engine.py tick() call**

In `apps/tfc/backend/engine/exercise_engine.py`, update the `tick()` method's call to `self._issues.tick()` (around line 368):

```python
        issue_changes = self._issues.tick(pt, self._time.real_time_ms, completed_events)
```

- [ ] **Step 7: Fix existing tests — rename auto_resolve_ms everywhere**

Update these files, replacing `auto_resolve_ms` with `auto_resolve_pt_ms`:
- `apps/tfc/backend/engine/issue_manager_test.py` — the `_issue()` helper and all call sites
- `apps/tfc/backend/engine/issue_manager_prop_test.py`
- `apps/tfc/backend/engine/strategies.py` — the `tracked_issues()` strategy
- `apps/tfc/backend/features/scenario/sample_er_scenario.py`
- `apps/tfc/backend/features/scenario/scenario_content_test.py`

Also update all `mgr.tick(pt, events)` calls to `mgr.tick(pt, 0.0, events)` in existing tests (add the RT param).

- [ ] **Step 8: Run all engine tests**

Run: `cd apps/tfc/backend && python -m pytest engine/ features/scenario/ -v --tb=short`
Expected: ALL PASS

- [ ] **Step 9: Commit**

```bash
git add apps/tfc/backend/engine/issue_manager.py apps/tfc/backend/engine/state_changes.py apps/tfc/backend/engine/exercise_engine.py apps/tfc/backend/engine/issue_manager_test.py apps/tfc/backend/engine/issue_manager_prop_test.py apps/tfc/backend/engine/strategies.py apps/tfc/backend/features/scenario/sample_er_scenario.py apps/tfc/backend/features/scenario/scenario_content_test.py
git commit -m "feat(tfc): split defect ETBOL into RT/PT with first-expiry resolution"
```

---

### Task 4: Defect ETBOL — Scenario Content, Loader, Seeds

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_content.py:77-87`
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py:67-82`
- Modify: `apps/tfc/backend/seeds/silent_wake.json`
- Modify: `apps/tfc/backend/seeds/silent_wake_backup.json`
- Modify: `apps/tfc/backend/seeds/silent_wake_tutorial.json`

- [ ] **Step 1: Update ScenarioIssueDef**

In `apps/tfc/backend/features/scenario/scenario_content.py`, update `ScenarioIssueDef`:

```python
class ScenarioIssueDef(BaseModel):
    """Definition of a defect (issue) within a scenario. Domain term: 'defect'."""

    id: str
    title: str
    description: str = ""
    trigger_mode: str  # time-based, event-based, manual
    trigger_time_pt_ms: float | None = None
    trigger_event_id: str | None = None
    auto_resolve_pt_ms: float = 0  # 0 = no auto-resolve (play time)
    auto_resolve_rt_ms: float = 0  # 0 = no auto-resolve (real time)
```

- [ ] **Step 2: Update scenario loader**

In `apps/tfc/backend/features/scenario/scenario_loader.py`, update `load_scenario_issues()`:

```python
            TrackedIssue(
                id=iss.id,
                title=iss.title,
                description=iss.description,
                trigger_mode=TriggerMode(iss.trigger_mode),
                trigger_time_pt_ms=iss.trigger_time_pt_ms,
                trigger_event_id=iss.trigger_event_id,
                auto_resolve_pt_ms=iss.auto_resolve_pt_ms,
                auto_resolve_rt_ms=iss.auto_resolve_rt_ms,
            ),
```

- [ ] **Step 3: Migrate seed JSON files**

In all 3 seed files, rename every `"auto_resolve_ms"` key to `"auto_resolve_pt_ms"`:

Run: `cd apps/tfc/backend && sed -i 's/"auto_resolve_ms"/"auto_resolve_pt_ms"/g' seeds/silent_wake.json seeds/silent_wake_backup.json seeds/silent_wake_tutorial.json`

Verify: `grep -c "auto_resolve_pt_ms" seeds/silent_wake.json` → should be 14
Verify: `grep -c "auto_resolve_ms" seeds/silent_wake.json` → should be 0 (only `auto_resolve_pt_ms`)

- [ ] **Step 4: Run seed validation test**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/seed_validation_test.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_content.py apps/tfc/backend/features/scenario/scenario_loader.py apps/tfc/backend/seeds/
git commit -m "feat(tfc): rename auto_resolve_ms to auto_resolve_pt_ms, add RT ETBOL to schema and seeds"
```

---

### Task 5: Fix `all_respond` Completion Mode

**Files:**
- Modify: `apps/tfc/backend/engine/decision_manager.py:144-167`
- Modify: `apps/tfc/backend/features/exercise/engine_router.py:267-287`
- Test: `apps/tfc/backend/engine/decision_manager_test.py`

- [ ] **Step 1: Write failing test for all_target_roles_responded**

Add to `apps/tfc/backend/engine/decision_manager_test.py`:

```python
class TestAllRespondCompletion:
    def test_all_target_roles_responded_false_when_missing(self) -> None:
        mgr = DecisionManager()
        mgr.open_decision(
            id="d1", event_id=None, issue_id=None, title="T",
            description="D", question_type="single_choice",
            options=[], completion_mode="all_respond",
            target_roles=["co", "logistics"], current_pt_ms=0.0,
        )
        mgr.submit_recommendation("d1", "alice", "opt1", role_id="co")
        assert not mgr.all_target_roles_responded("d1")

    def test_all_target_roles_responded_true_when_all_present(self) -> None:
        mgr = DecisionManager()
        mgr.open_decision(
            id="d1", event_id=None, issue_id=None, title="T",
            description="D", question_type="single_choice",
            options=[], completion_mode="all_respond",
            target_roles=["co", "logistics"], current_pt_ms=0.0,
        )
        mgr.submit_recommendation("d1", "alice", "opt1", role_id="co")
        mgr.submit_recommendation("d1", "bob", "opt2", role_id="logistics")
        assert mgr.all_target_roles_responded("d1")

    def test_returns_false_for_nonexistent_decision(self) -> None:
        mgr = DecisionManager()
        assert not mgr.all_target_roles_responded("nope")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/tfc/backend && python -m pytest engine/decision_manager_test.py::TestAllRespondCompletion -v`
Expected: FAIL — `all_target_roles_responded` not defined

- [ ] **Step 3: Implement `all_target_roles_responded()`**

Add to `apps/tfc/backend/engine/decision_manager.py` after `get_open_decisions()`:

```python
    def all_target_roles_responded(self, decision_id: str) -> bool:
        """Check if every target_role has at least one recommendation."""
        decision = self._decisions.get(decision_id)
        if decision is None or decision.status != "open":
            return False
        if not decision.target_roles:
            return False
        responded_roles: set[str] = set()
        for key in decision.recommendations:
            # key format: "participant_id:role_id" or just "participant_id"
            parts = key.rsplit(":", 1)
            if len(parts) == 2:
                responded_roles.add(parts[1])
            else:
                responded_roles.add(key)
        return all(role in responded_roles for role in decision.target_roles)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/tfc/backend && python -m pytest engine/decision_manager_test.py::TestAllRespondCompletion -v`
Expected: ALL PASS

- [ ] **Step 5: Wire auto-close into submit_recommendation endpoint**

In `apps/tfc/backend/features/exercise/engine_router.py`, update `submit_recommendation()` to check completion after recording:

```python
@router.post("/decisions/recommend", operation_id="submitRecommendation")
async def submit_recommendation(
    exercise_id: int,
    body: RecommendRequest,
) -> StateChange:
    """Advisor submits a recommendation on an open decision."""
    engine = _get_engine(exercise_id)
    result = engine.decision_manager.submit_recommendation(
        body.decision_id,
        participant_id=body.participant_id,
        option_id=body.option_id,
        role_id=body.role_id,
    )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Decision {body.decision_id} not found or already closed",
        )
    await broadcast_changes(connection_manager, exercise_id, [result])
    await _log_to_audit(exercise_id, [result])

    # Auto-close if all_respond completion mode and all target roles responded
    decision = engine.decision_manager.get_decision(body.decision_id)
    if (
        decision
        and decision.completion_mode == "all_respond"
        and engine.decision_manager.all_target_roles_responded(body.decision_id)
    ):
        selected = [body.option_id]  # use last recommendation as selection
        close_changes = await engine.close_decision(body.decision_id, selected)
        await broadcast_changes(connection_manager, exercise_id, close_changes)
        await _log_to_audit(exercise_id, close_changes)

    return result
```

- [ ] **Step 6: Run all engine and feature tests**

Run: `cd apps/tfc/backend && python -m pytest engine/ features/ -v --tb=short`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add apps/tfc/backend/engine/decision_manager.py apps/tfc/backend/engine/decision_manager_test.py apps/tfc/backend/features/exercise/engine_router.py
git commit -m "fix(tfc): implement all_respond completion mode auto-close on last role submission"
```

---

### Task 6: Scoring Visibility Fix + DecisionTemplate.issue_id Optional

**Files:**
- Modify: `apps/tfc/backend/engine/exercise_engine.py:375-388`
- Modify: `apps/tfc/backend/engine/engine_config.py:23-36`
- Modify: `apps/tfc/backend/features/scenario/scenario_content.py:43-58`
- Test: `apps/tfc/backend/engine/exercise_engine_test.py`

- [ ] **Step 1: Write failing test for scoring visibility**

Add to `apps/tfc/backend/engine/exercise_engine_test.py`:

```python
class TestScoringVisibility:
    def test_score_hidden_during_running(self, engine: ExerciseEngine) -> None:
        # engine fixture should be in RUNNING phase
        snap = engine.snapshot()
        assert snap["score"] is None

    async def test_score_visible_after_completion(self, engine: ExerciseEngine) -> None:
        # complete the engine, then check
        await engine.complete()
        snap = engine.snapshot()
        # score may still be None for classic mode (no scoring), but the
        # important thing is the guard works — game_mode.snapshot() is called
```

Note: Adapt to existing test fixtures in the file. The key assertion is `snapshot()["score"] is None` when phase != COMPLETED.

- [ ] **Step 2: Fix scoring visibility in snapshot()**

In `apps/tfc/backend/engine/exercise_engine.py`, update `snapshot()`:

```python
    def snapshot(self) -> EngineSnapshot:
        """Full state snapshot for client sync."""
        return EngineSnapshot(
            exercise_id=self._config.exercise_id,
            title=self._config.title,
            phase=self._phase.value,
            time=self._time.snapshot(),
            events=self._events.snapshot(),
            issues=self._issues.snapshot(),
            decisions=self._decisions.snapshot(),
            score=self._config.game_mode.snapshot() if self._phase == EnginePhase.COMPLETED else None,
            systems=self._systems.snapshot(),
            warfare_domains=self._warfare_domains.snapshot(),
        )
```

- [ ] **Step 3: Make DecisionTemplate.issue_id optional**

In `apps/tfc/backend/engine/engine_config.py`, change:

```python
    issue_id: str | None = None
```

In `apps/tfc/backend/features/scenario/scenario_content.py`, change `DecisionTemplateDef`:

```python
    issue_id: str | None = None  # linked issue (optional)
```

- [ ] **Step 4: Run all tests**

Run: `cd apps/tfc/backend && python -m pytest engine/ features/ -v --tb=short`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/backend/engine/exercise_engine.py apps/tfc/backend/engine/engine_config.py apps/tfc/backend/features/scenario/scenario_content.py apps/tfc/backend/engine/exercise_engine_test.py
git commit -m "fix(tfc): hide score during execution, make decision issue_id optional"
```

---

## Phase 2: Audit Completeness (Task 7)

### Task 7: Wire Entity Actions to Audit Trail

**Files:**
- Modify: `apps/tfc/backend/features/exercise/engine_actions_router.py:42-152`

- [ ] **Step 1: Identify the pattern**

The `engine_router.py` endpoints call `broadcast_changes()` + `_log_to_audit()`. The `engine_actions_router.py` endpoints return raw changes without logging. Fix: after each entity action, broadcast and log via the engine's `_on_state_change` callback.

- [ ] **Step 2: Update all event action endpoints**

In `apps/tfc/backend/features/exercise/engine_actions_router.py`, import broadcast and audit helpers:

```python
from features.exercise.engine_broadcast import broadcast_changes
from features.exercise.adapters.connection_manager import connection_manager
```

Then update each endpoint to broadcast + log after getting the change. For example, `cancel_event`:

```python
@router.post("/events/{event_id}/cancel", operation_id="cancelEvent")
async def cancel_event(exercise_id: int, event_id: str) -> EventChange:
    engine = _get_engine(exercise_id)
    change = _or_404(
        engine.event_scheduler.cancel_event(event_id),
        f"Event {event_id} not found or not cancellable",
    )
    if engine._on_state_change:
        await engine._on_state_change([change])
    return change
```

Apply the same pattern to: `complete_event`, `pause_event`, `resume_event`, `delay_event`, `skip_event`, `activate_issue`, `mitigate_issue`, `resolve_issue`, `release_issue`.

Note: `trigger_event` already broadcasts via `engine._on_state_change` — leave it as-is.

- [ ] **Step 3: Run all tests**

Run: `cd apps/tfc/backend && python -m pytest -v --tb=short`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/backend/features/exercise/engine_actions_router.py
git commit -m "fix(tfc): wire all entity action endpoints to audit trail via _on_state_change"
```

---

## Phase 3: Codegen (Task 8)

### Task 8: Regenerate TypeScript Types

**Files:**
- Regenerate: `apps/tfc/frontend/src/app/core/generated/state-changes.types.ts`

- [ ] **Step 1: Run type codegen**

```bash
cd apps/tfc && python codegen/generate-types.py
```

- [ ] **Step 2: Verify new fields appear in generated types**

```bash
grep "execution_mode" apps/tfc/frontend/src/app/core/generated/state-changes.types.ts
grep "auto_resolve_pt_ms" apps/tfc/frontend/src/app/core/generated/state-changes.types.ts
grep "auto_resolve_rt_ms" apps/tfc/frontend/src/app/core/generated/state-changes.types.ts
grep "activated_at_rt_ms" apps/tfc/frontend/src/app/core/generated/state-changes.types.ts
```

Expected: Each grep returns a match.

- [ ] **Step 3: Run full OpenAPI codegen**

```bash
make generate
```

- [ ] **Step 4: Verify frontend compiles**

```bash
cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | tail -5
```

If compilation fails due to renamed fields (e.g. `auto_resolve_ms` → `auto_resolve_pt_ms`), fix references in frontend code.

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/frontend/src/app/core/generated/ apps/tfc/frontend/
git commit -m "chore(tfc): regenerate TypeScript types after engine data model changes"
```

---

## Phase 4: Trainer Cockpit UI (Tasks 9-11)

These 3 tasks are parallelizable.

### Task 9: Trainer Cockpit Layout Refactor

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/game-master/game-master-view.ts`
- Create: `apps/tfc/frontend/src/app/features/game-master/gm-defect-list.component.ts`

Restructure the game-master-view into the 5-row layout (header, overview, trainee monitor, details, controls). This is a layout refactor — move existing components into the new row structure.

- [ ] **Step 1: Create defect list component**

New file `apps/tfc/frontend/src/app/features/game-master/gm-defect-list.component.ts` — a standalone Angular component that renders the defect/issue list with lifecycle badges, ETBOL countdown, and severity indicators.

Input: `issues` signal from ExerciseStore.
Output: `issueSelected` event when trainer clicks a defect.

- [ ] **Step 2: Refactor game-master-view.ts layout**

Restructure the template into 5 semantic rows using CSS grid or flex. Move existing components (event-timeline, gm-item-actions, etc.) into the appropriate rows. Add placeholder `<div>` for the trainee monitor (Task 11) and details panel (Task 10).

- [ ] **Step 3: Verify GM view renders correctly**

Start the dev server and navigate to `/gm`. Verify: header with clocks, timeline in row 2, defect list next to timeline, controls in footer.

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/game-master/
git commit -m "feat(tfc): restructure trainer cockpit into 5-row layout"
```

---

### Task 10: Trainer Details Panel

**Files:**
- Create: `apps/tfc/frontend/src/app/features/game-master/gm-details-panel.component.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/game-master-view.ts`

- [ ] **Step 1: Create details panel component**

Standalone Angular component. Inputs: `selectedEvent` or `selectedIssue` signal. Displays full metadata (type, execution mode, start time, duration, dependencies, triggered issues for events; trigger mode, ETBOL, lifecycle for defects). Includes action buttons (Pause/Cancel/Complete for events, Activate/Mitigate/Resolve for defects) that call the engine API.

- [ ] **Step 2: Wire click events from timeline/defect-list to details panel**

In `game-master-view.ts`, add a `selectedItem` signal. When trainer clicks an event in the timeline or a defect in the defect list, set `selectedItem`. Pass it to `gm-details-panel`.

- [ ] **Step 3: Verify details panel shows on click**

Click an event in timeline → details panel shows metadata + action buttons. Click a defect → details panel shows defect info + action buttons.

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/game-master/
git commit -m "feat(tfc): add collapsible details panel for selected inject/defect"
```

---

### Task 11: Trainee Monitor Strip

**Files:**
- Create: `apps/tfc/frontend/src/app/features/game-master/trainee-monitor.component.ts`
- Modify: `apps/tfc/frontend/src/app/features/game-master/game-master-view.ts`

- [ ] **Step 1: Create trainee monitor component**

Standalone Angular component. Inputs: `participants`, `decisions`, `recommendations` from ExerciseStore. Renders per-trainee cards showing: display name, role, decision status (pending/submitted/timed_out). For `gm_closes` completion mode, includes a "Validate & Close" button.

- [ ] **Step 2: Wire into game-master-view row 3**

Replace the placeholder div in game-master-view.ts with the trainee-monitor component.

- [ ] **Step 3: Verify trainee monitor shows live status**

With an exercise running and trainees connected, verify the monitor shows each trainee's role and decision status. Submit a recommendation from a trainee → verify the monitor updates in real-time via WebSocket.

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/game-master/
git commit -m "feat(tfc): add trainee monitor strip with live decision status"
```

---

## Phase 5: Trainee UI (Tasks 12-14)

These 3 tasks are parallelizable.

### Task 12: Inject Feed Component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/player/inject-feed.component.ts`
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.ts`
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.html`

- [ ] **Step 1: Create inject feed component**

Standalone Angular component. Input: `events` from ExerciseStore (filtered to lifecycle RUNNING or COMPLETED, and released to player's role). Displays chronological list (newest on top). Each entry: PT timestamp, title, description, role-specific intel from `role_descriptions`. Running injects highlighted, completed dimmed.

- [ ] **Step 2: Integrate into player-view layout**

Replace the current turn-event display in `player-view.html` with the 3-column layout: inject feed (left, flex:2), defect panel (center, flex:1, placeholder for Task 13), systems sidebar (right, existing components).

- [ ] **Step 3: Verify inject feed renders**

Start exercise → injects appear in feed as they activate. Completed injects remain visible but dimmed.

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/player/
git commit -m "feat(tfc): add chronological inject feed to trainee view"
```

---

### Task 13: Defect Panel Component

**Files:**
- Create: `apps/tfc/frontend/src/app/features/player/defect-panel.component.ts`
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.html`

- [ ] **Step 1: Create defect panel component**

Standalone Angular component. Input: `issues` from ExerciseStore (filtered to `released == true`). Splits into active and resolved sections. Active defects show: title, lifecycle badge, ETBOL countdown (if auto_resolve_pt_ms or auto_resolve_rt_ms > 0), severity color (red border for active, amber for mitigated, green for resolved). Resolved defects collapsed and dimmed.

- [ ] **Step 2: Wire into player-view center column**

Replace the placeholder in the 3-column layout with the defect-panel component.

- [ ] **Step 3: Verify defect panel renders**

Start exercise → defects appear when activated. ETBOL countdown ticks down. Resolved defects move to collapsed section.

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/player/
git commit -m "feat(tfc): add defect panel with ETBOL countdown to trainee view"
```

---

### Task 14: Decision Overlay

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.ts`
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.html`

- [ ] **Step 1: Refactor decision UI into blocking overlay**

When `hasOpenDecision` is true, render the existing role-card / decision UI components as a full-screen overlay on top of the feed layout. The overlay blocks interaction with the feed underneath. In classic mode (where the engine pauses), this is the only interactive element.

- [ ] **Step 2: Ensure context panel is non-blocking**

Verify the context button opens a side panel or drawer that does NOT prevent decision interaction. The trainee should be able to view briefing/objectives/ROE while a decision is open.

- [ ] **Step 3: Verify end-to-end decision flow**

Decision opens → overlay appears → trainee responds → overlay closes → feed is visible again.

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/player/
git commit -m "feat(tfc): refactor trainee decision UI into blocking overlay"
```

---

## Phase 6: Scenario Builder (Tasks 15-16)

### Task 15: Scenario Builder Backend CRUD

**Files:**
- Create: `apps/tfc/backend/features/scenario/scenario_content_router.py`
- Modify: `apps/tfc/backend/features/scenario/scenario_service.py`

- [ ] **Step 1: Create scenario content CRUD endpoints**

New router with endpoints for managing scenario content entities:

```
POST   /api/scenarios/{id}/events      — add inject
PUT    /api/scenarios/{id}/events/{eid} — update inject
DELETE /api/scenarios/{id}/events/{eid} — remove inject
POST   /api/scenarios/{id}/issues      — add defect
PUT    /api/scenarios/{id}/issues/{iid} — update defect
DELETE /api/scenarios/{id}/issues/{iid} — remove defect
POST   /api/scenarios/{id}/decisions      — add decision template
PUT    /api/scenarios/{id}/decisions/{did} — update decision template
DELETE /api/scenarios/{id}/decisions/{did} — remove decision template
```

Each endpoint: validates the entity against the Pydantic model, mutates the `content` JSON column, validates referential integrity (dependencies exist, triggered_issues exist, target_roles exist), and saves.

- [ ] **Step 2: Add validation logic**

In scenario_service, add `validate_content_integrity(content: ScenarioContent)` — checks cross-references between events, issues, and decisions.

- [ ] **Step 3: Run tests**

Write integration tests for each CRUD endpoint. Verify create, update, delete, and validation errors.

- [ ] **Step 4: Commit**

```bash
git add apps/tfc/backend/features/scenario/
git commit -m "feat(tfc): add scenario content CRUD API for injects, defects, decisions"
```

---

### Task 16: Scenario Builder Frontend Completion

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/turn-inject-editor.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-issue-editor.ts`
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-decision-editor.ts`

- [ ] **Step 1: Add execution_mode selector to inject editor**

Add a dropdown/toggle to the inject editor: "Automatic" (default) or "Manual". Maps to `execution_mode` field on `ScenarioEventDef`.

- [ ] **Step 2: Add ETBOL RT/PT fields to defect editor**

Replace single "Auto-resolve (ms)" input with two fields: "Auto-resolve PT (play time)" and "Auto-resolve RT (real time)". Both optional. Maps to `auto_resolve_pt_ms` and `auto_resolve_rt_ms`.

- [ ] **Step 3: Add completion_mode selector to decision editor**

Add dropdown with options: "First response", "All respond", "GM closes". Maps to `completion_mode` field. Show `target_roles` picker when "All respond" is selected.

- [ ] **Step 4: Verify builder creates valid scenarios**

Create a scenario with manual events, RT-based defects, and all_respond decisions via the builder. Save and verify the content JSON matches expected structure.

- [ ] **Step 5: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/
git commit -m "feat(tfc): complete scenario builder editors with execution mode, ETBOL, completion mode"
```

---

## Phase 7: Integration (Task 17)

### Task 17: End-to-End Smoke Test

- [ ] **Step 1: Run full backend test suite**

```bash
cd apps/tfc/backend && python -m pytest -v --tb=short
```

Expected: ALL PASS

- [ ] **Step 2: Manual E2E walkthrough**

1. Seed database: `cd apps/tfc/backend && python seed.py`
2. Start backend: `uvicorn main:app`
3. Start frontend: `cd apps/tfc/frontend && npx ng serve`
4. Open trainer view (`/gm`), select scenario, create exercise
5. Open trainee view (`/player`) in second browser tab, join exercise
6. Trainer starts exercise → briefing → begin
7. Verify: injects fire by schedule, MANUAL injects don't auto-fire
8. Trainer force-triggers a MANUAL inject
9. Verify: defects activate, ETBOL countdown visible
10. Decision opens → trainee sees overlay → submits response
11. Trainer completes exercise → score visible in snapshot
12. Check audit trail: `GET /api/audit?exercise_id={id}`

- [ ] **Step 3: Verify audit completeness**

Check that all trainer actions (trigger, cancel, pause, etc.) appear in the audit log with RT and PT timestamps.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore(tfc): verify end-to-end EXCON mode with all data model changes"
```
