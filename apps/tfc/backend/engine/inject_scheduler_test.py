"""Tests for InjectScheduler lifecycle transitions."""
import pytest

from engine.inject_scheduler import (
    InjectLifecycle,
    InjectScheduler,
    InjectType,
    ScheduledInject,
)


def _inject(
    id: str = "e1",
    scheduled_pt_ms: float = 0.0,
    duration_ms: float | None = None,
    dependencies: list[str] | None = None,
    triggered_defects: list[str] | None = None,
) -> ScheduledInject:
    return ScheduledInject(
        id=id,
        title=f"Inject {id}",
        description="test",
        inject_type=InjectType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        duration_ms=duration_ms,
        dependencies=dependencies or [],
        triggered_defects=triggered_defects or [],
    )


class TestLifecycleTransitions:
    def test_scheduled_to_pending_to_running(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=100.0)])
        changes1 = sched.tick(100.0)  # -> pending
        ev = sched.injects["e1"]
        assert ev.lifecycle == InjectLifecycle.PENDING
        assert any(c["action"] == "activated" for c in changes1)

        changes2 = sched.tick(100.0)  # -> running
        assert ev.lifecycle == InjectLifecycle.RUNNING
        assert any(c["action"] == "started" for c in changes2)

    def test_full_lifecycle_to_completed(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=0.0, duration_ms=500.0)])
        sched.tick(0.0)  # -> pending
        assert sched.injects["e1"].lifecycle == InjectLifecycle.PENDING
        sched.tick(0.0)  # -> running
        assert sched.injects["e1"].lifecycle == InjectLifecycle.RUNNING
        changes = sched.tick(500.0)  # -> completed
        assert sched.injects["e1"].lifecycle == InjectLifecycle.COMPLETED
        actions = [c["action"] for c in changes]
        assert "completed" in actions


    def test_pending_to_running_fires_only_once(self) -> None:
        """An inject that becomes RUNNING should not re-emit 'started' on subsequent ticks."""
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=0.0)])
        sched.tick(0.0)  # -> pending
        assert sched.injects["e1"].lifecycle == InjectLifecycle.PENDING

        started_changes = sched.tick(0.0)  # -> running
        assert sched.injects["e1"].lifecycle == InjectLifecycle.RUNNING
        started_count = sum(1 for c in started_changes if c["action"] == "started")
        assert started_count == 1

        # Subsequent ticks must NOT re-trigger 'started'
        second_changes = sched.tick(1.0)
        assert all(c["action"] != "started" for c in second_changes)
        third_changes = sched.tick(2.0)
        assert all(c["action"] != "started" for c in third_changes)


class TestTimeBasedActivation:
    def test_not_activated_before_time(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=1000.0)])
        changes = sched.tick(999.0)
        assert len(changes) == 0
        assert sched.injects["e1"].lifecycle == InjectLifecycle.SCHEDULED

    def test_activated_at_scheduled_time(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=500.0)])
        sched.tick(500.0)  # -> pending
        assert sched.injects["e1"].lifecycle == InjectLifecycle.PENDING
        sched.tick(500.0)  # -> running
        assert sched.injects["e1"].lifecycle == InjectLifecycle.RUNNING


class TestDependencyResolution:
    def test_inject_waits_for_dep(self) -> None:
        dep = _inject("dep", scheduled_pt_ms=0.0, duration_ms=100.0)
        child = _inject("child", scheduled_pt_ms=0.0, dependencies=["dep"])
        sched = InjectScheduler()
        sched.load_injects([dep, child])

        sched.tick(0.0)  # dep -> pending, child still scheduled (dep not completed)
        sched.tick(0.0)  # dep -> running, child still scheduled
        assert sched.injects["child"].lifecycle == InjectLifecycle.SCHEDULED

        sched.tick(100.0)  # dep completes, child -> pending
        assert sched.injects["dep"].lifecycle == InjectLifecycle.COMPLETED
        assert sched.injects["child"].lifecycle == InjectLifecycle.PENDING
        sched.tick(100.0)  # child -> running
        assert sched.injects["child"].lifecycle == InjectLifecycle.RUNNING


class TestForceTrigger:
    def test_force_trigger_bypasses_schedule(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=99999.0)])
        result = sched.force_trigger("e1", 0.0)
        assert result is not None
        assert sched.injects["e1"].lifecycle == InjectLifecycle.RUNNING

    def test_force_trigger_completed_returns_none(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=0.0)])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        sched.complete_inject("e1", 0.0)
        assert sched.force_trigger("e1", 0.0) is None

    def test_force_trigger_cancelled_returns_none(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=9999.0)])
        sched.cancel_inject("e1")
        assert sched.force_trigger("e1", 0.0) is None


class TestCancelInject:
    def test_cancel_scheduled_inject(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=9999.0)])
        result = sched.cancel_inject("e1")
        assert result is not None
        assert sched.injects["e1"].lifecycle == InjectLifecycle.CANCELLED

    def test_cancel_completed_returns_none(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=0.0)])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        sched.complete_inject("e1", 0.0)
        assert sched.cancel_inject("e1") is None


class TestCompleteInject:
    def test_complete_running_inject(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=0.0)])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        result = sched.complete_inject("e1", 50.0)
        assert result is not None
        assert sched.injects["e1"].lifecycle == InjectLifecycle.COMPLETED
        assert sched.injects["e1"].completed_at_pt_ms == 50.0

    def test_complete_non_running_returns_none(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=9999.0)])
        assert sched.complete_inject("e1", 0.0) is None


class TestDurationAutoComplete:
    def test_auto_completes_after_duration(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=0.0, duration_ms=200.0)])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running at pt=0
        assert sched.injects["e1"].lifecycle == InjectLifecycle.RUNNING
        changes = sched.tick(200.0)
        assert sched.injects["e1"].lifecycle == InjectLifecycle.COMPLETED
        assert any(c["action"] == "completed" for c in changes)


class TestSnapshotIncludesTriggeredDefects:
    def test_triggered_defects_in_snapshot(self) -> None:
        sched = InjectScheduler()
        inj = ScheduledInject(
            id="e1", title="E1", description="",
            inject_type=InjectType.OPERATIONAL, scheduled_pt_ms=0.0,
            triggered_defects=["i1", "i2"],
        )
        sched.load_injects([inj])
        snap = sched.snapshot()
        assert snap[0]["triggered_defects"] == ["i1", "i2"]
