"""Unit tests for EventScheduler lifecycle management."""
import pytest

from engine.event_scheduler import (
    EventLifecycle,
    EventScheduler,
    EventType,
    ScheduledEvent,
)


def _event(
    eid: str = "e1",
    scheduled_pt_ms: float = 0.0,
    duration_ms: float | None = None,
    dependencies: list[str] | None = None,
    triggered_issues: list[str] | None = None,
) -> ScheduledEvent:
    return ScheduledEvent(
        id=eid,
        title=f"Event {eid}",
        description=f"Desc {eid}",
        event_type=EventType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        duration_ms=duration_ms,
        dependencies=dependencies or [],
        triggered_issues=triggered_issues or [],
    )


class TestLoadEvents:
    def test_load_stores_events(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1"), _event("e2")])
        assert len(sched.events) == 2
        assert "e1" in sched.events
        assert "e2" in sched.events


class TestTickActivation:
    def test_activates_when_pt_passes_scheduled(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=100)])
        changes = sched.tick(200)
        assert sched.events["e1"].lifecycle == EventLifecycle.RUNNING
        assert any(c["event_id"] == "e1" for c in changes)

    def test_no_activation_before_scheduled(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=100)])
        sched.tick(50)
        assert sched.events["e1"].lifecycle == EventLifecycle.SCHEDULED

    def test_no_activation_when_dependency_unmet(self) -> None:
        sched = EventScheduler()
        sched.load_events([
            _event("dep1", scheduled_pt_ms=500),
            _event("e2", scheduled_pt_ms=0, dependencies=["dep1"]),
        ])
        sched.tick(100)
        assert sched.events["e2"].lifecycle == EventLifecycle.SCHEDULED

    def test_activates_when_dependency_met(self) -> None:
        sched = EventScheduler()
        dep = _event("dep1", scheduled_pt_ms=0, duration_ms=10)
        e2 = _event("e2", scheduled_pt_ms=0, dependencies=["dep1"])
        sched.load_events([dep, e2])

        # First tick: dep1 starts and runs
        sched.tick(0)
        assert sched.events["dep1"].lifecycle == EventLifecycle.RUNNING

        # Tick past duration: dep1 completes, e2 can activate
        sched.tick(20)
        assert sched.events["dep1"].lifecycle == EventLifecycle.COMPLETED
        assert sched.events["e2"].lifecycle == EventLifecycle.RUNNING


class TestTickAutoComplete:
    def test_auto_complete_after_duration(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=0, duration_ms=100)])
        sched.tick(0)   # starts running
        sched.tick(150)  # past duration
        assert sched.events["e1"].lifecycle == EventLifecycle.COMPLETED
        assert sched.events["e1"].completed_at_pt_ms == 150


class TestForceTrigger:
    def test_force_trigger_pending_event(self) -> None:
        """Force trigger works on PENDING events (transition to RUNNING)."""
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=0)])
        # Tick to move to PENDING -> RUNNING automatically, so test with
        # a manually set PENDING event instead.
        e = _event("e2", scheduled_pt_ms=9999)
        sched.load_events([e])
        # Manually set to PENDING to test force_trigger
        e.lifecycle = EventLifecycle.PENDING
        result = sched.force_trigger("e2", 10)
        assert result is not None
        assert result["action"] == "force_triggered"
        assert sched.events["e2"].lifecycle == EventLifecycle.RUNNING

    def test_force_trigger_scheduled_stays_scheduled(self) -> None:
        """SCHEDULED -> RUNNING is not a valid transition, so stays SCHEDULED."""
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=9999)])
        result = sched.force_trigger("e1", 10)
        assert result is not None
        # Transition silently fails per VALID_TRANSITIONS
        assert sched.events["e1"].lifecycle == EventLifecycle.SCHEDULED

    def test_force_trigger_completed_returns_none(self) -> None:
        sched = EventScheduler()
        e = _event("e1", scheduled_pt_ms=0, duration_ms=10)
        sched.load_events([e])
        sched.tick(0)
        sched.tick(20)
        assert sched.force_trigger("e1", 30) is None

    def test_force_trigger_unknown_returns_none(self) -> None:
        sched = EventScheduler()
        assert sched.force_trigger("nope", 0) is None


class TestCancelEvent:
    def test_cancel_scheduled(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=9999)])
        result = sched.cancel_event("e1")
        assert result is not None
        assert sched.events["e1"].lifecycle == EventLifecycle.CANCELLED

    def test_cancel_completed_returns_none(self) -> None:
        sched = EventScheduler()
        e = _event("e1", scheduled_pt_ms=0, duration_ms=1)
        sched.load_events([e])
        sched.tick(0)
        sched.tick(10)
        assert sched.cancel_event("e1") is None


class TestCompleteEvent:
    def test_complete_running_event(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=0)])
        sched.tick(0)  # starts running
        result = sched.complete_event("e1", 50)
        assert result is not None
        assert sched.events["e1"].lifecycle == EventLifecycle.COMPLETED
        assert sched.events["e1"].completed_at_pt_ms == 50

    def test_complete_non_running_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=9999)])
        assert sched.complete_event("e1", 0) is None


class TestGetTriggeredIssues:
    def test_returns_issue_ids(self) -> None:
        sched = EventScheduler()
        sched.load_events([
            _event("e1", triggered_issues=["i1", "i2"]),
        ])
        assert sched.get_triggered_issues("e1") == ["i1", "i2"]

    def test_unknown_event_returns_empty(self) -> None:
        sched = EventScheduler()
        assert sched.get_triggered_issues("nope") == []


class TestClear:
    def test_clear_removes_all(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1"), _event("e2")])
        sched.clear()
        assert len(sched.events) == 0


class TestSnapshot:
    def test_snapshot_serializable(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=100)])
        snap = sched.snapshot()
        assert len(snap) == 1
        assert snap[0]["id"] == "e1"
        assert snap[0]["lifecycle"] == "scheduled"
        assert "scheduled_pt_ms" in snap[0]
        assert "duration_ms" in snap[0]
