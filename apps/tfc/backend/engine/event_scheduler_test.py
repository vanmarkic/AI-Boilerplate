"""Tests for EventScheduler lifecycle transitions."""
import pytest

from engine.event_scheduler import (
    EventLifecycle,
    EventScheduler,
    EventType,
    ScheduledEvent,
)


def _event(
    id: str = "e1",
    scheduled_pt_ms: float = 0.0,
    duration_ms: float | None = None,
    dependencies: list[str] | None = None,
    triggered_issues: list[str] | None = None,
) -> ScheduledEvent:
    return ScheduledEvent(
        id=id,
        title=f"Event {id}",
        description="test",
        event_type=EventType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        duration_ms=duration_ms,
        dependencies=dependencies or [],
        triggered_issues=triggered_issues or [],
    )


class TestLifecycleTransitions:
    def test_scheduled_to_pending_to_running(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=100.0)])
        changes = sched.tick(100.0)
        ev = sched.events["e1"]
        assert ev.lifecycle == EventLifecycle.RUNNING
        actions = [c["action"] for c in changes]
        assert "activated" in actions
        assert "started" in actions

    def test_full_lifecycle_to_completed(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=0.0, duration_ms=500.0)])
        sched.tick(0.0)  # -> running
        assert sched.events["e1"].lifecycle == EventLifecycle.RUNNING
        changes = sched.tick(500.0)  # -> completed
        assert sched.events["e1"].lifecycle == EventLifecycle.COMPLETED
        actions = [c["action"] for c in changes]
        assert "completed" in actions


class TestTimeBasedActivation:
    def test_not_activated_before_time(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=1000.0)])
        changes = sched.tick(999.0)
        assert len(changes) == 0
        assert sched.events["e1"].lifecycle == EventLifecycle.SCHEDULED

    def test_activated_at_scheduled_time(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=500.0)])
        sched.tick(500.0)
        assert sched.events["e1"].lifecycle == EventLifecycle.RUNNING


class TestDependencyResolution:
    def test_event_waits_for_dep(self) -> None:
        dep = _event("dep", scheduled_pt_ms=0.0, duration_ms=100.0)
        child = _event("child", scheduled_pt_ms=0.0, dependencies=["dep"])
        sched = EventScheduler()
        sched.load_events([dep, child])

        sched.tick(0.0)
        assert sched.events["child"].lifecycle == EventLifecycle.SCHEDULED

        sched.tick(100.0)  # dep completes
        assert sched.events["dep"].lifecycle == EventLifecycle.COMPLETED
        assert sched.events["child"].lifecycle == EventLifecycle.RUNNING


class TestForceTrigger:
    def test_force_trigger_bypasses_schedule(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=99999.0)])
        result = sched.force_trigger("e1", 0.0)
        assert result is not None
        assert sched.events["e1"].lifecycle == EventLifecycle.RUNNING

    def test_force_trigger_completed_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=0.0)])
        sched.tick(0.0)
        sched.complete_event("e1", 0.0)
        assert sched.force_trigger("e1", 0.0) is None

    def test_force_trigger_cancelled_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=9999.0)])
        sched.cancel_event("e1")
        assert sched.force_trigger("e1", 0.0) is None


class TestCancelEvent:
    def test_cancel_scheduled_event(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=9999.0)])
        result = sched.cancel_event("e1")
        assert result is not None
        assert sched.events["e1"].lifecycle == EventLifecycle.CANCELLED

    def test_cancel_completed_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=0.0)])
        sched.tick(0.0)
        sched.complete_event("e1", 0.0)
        assert sched.cancel_event("e1") is None


class TestCompleteEvent:
    def test_complete_running_event(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=0.0)])
        sched.tick(0.0)
        result = sched.complete_event("e1", 50.0)
        assert result is not None
        assert sched.events["e1"].lifecycle == EventLifecycle.COMPLETED
        assert sched.events["e1"].completed_at_pt_ms == 50.0

    def test_complete_non_running_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=9999.0)])
        assert sched.complete_event("e1", 0.0) is None


class TestDurationAutoComplete:
    def test_auto_completes_after_duration(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=0.0, duration_ms=200.0)])
        sched.tick(0.0)  # -> running at pt=0
        assert sched.events["e1"].lifecycle == EventLifecycle.RUNNING
        changes = sched.tick(200.0)
        assert sched.events["e1"].lifecycle == EventLifecycle.COMPLETED
        assert any(c["action"] == "completed" for c in changes)
