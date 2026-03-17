"""Tests for P2 EventScheduler additions: pause, resume, delay, skip."""
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
) -> ScheduledEvent:
    return ScheduledEvent(
        id=id,
        title=f"Event {id}",
        description="test",
        event_type=EventType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        duration_ms=duration_ms,
    )


class TestPauseEvent:
    def test_pause_running_event(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        result = sched.pause_event("e1")
        assert result is not None
        assert result["action"] == "paused"
        assert sched.events["e1"].lifecycle == EventLifecycle.PAUSED

    def test_pause_non_running_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=9999.0)])
        assert sched.pause_event("e1") is None

    def test_paused_event_does_not_tick(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", duration_ms=100.0)])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        sched.pause_event("e1")
        # Tick past duration — event should stay paused
        changes = sched.tick(200.0)
        assert sched.events["e1"].lifecycle == EventLifecycle.PAUSED
        assert not any(c.get("action") == "completed" for c in changes)


class TestResumeEvent:
    def test_resume_paused_event(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        sched.pause_event("e1")
        result = sched.resume_event("e1", 50.0)
        assert result is not None
        assert result["action"] == "resumed"
        assert sched.events["e1"].lifecycle == EventLifecycle.RUNNING

    def test_resume_non_paused_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        assert sched.resume_event("e1", 0.0) is None

    def test_resume_nonexistent_returns_none(self) -> None:
        sched = EventScheduler()
        assert sched.resume_event("nope", 0.0) is None


class TestDelayEvent:
    def test_delay_scheduled_event(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=1000.0)])
        result = sched.delay_event("e1", 500.0)
        assert result is not None
        assert result["action"] == "delayed"
        assert sched.events["e1"].scheduled_pt_ms == 1500.0

    def test_delay_non_scheduled_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1")])
        sched.tick(0.0)  # -> pending
        assert sched.delay_event("e1", 500.0) is None

    def test_delay_nonexistent_returns_none(self) -> None:
        sched = EventScheduler()
        assert sched.delay_event("nope", 100.0) is None

    def test_delayed_event_activates_at_new_time(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=100.0)])
        sched.delay_event("e1", 200.0)
        # Should not activate at original time
        changes = sched.tick(100.0)
        assert sched.events["e1"].lifecycle == EventLifecycle.SCHEDULED
        assert len(changes) == 0
        # Should activate at new time
        sched.tick(300.0)
        assert sched.events["e1"].lifecycle == EventLifecycle.PENDING


class TestSkipEvent:
    def test_skip_scheduled_event(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=9999.0)])
        result = sched.skip_event("e1")
        assert result is not None
        assert result["action"] == "skipped"
        assert sched.events["e1"].lifecycle == EventLifecycle.CANCELLED

    def test_skip_running_event(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        result = sched.skip_event("e1")
        assert result is not None
        assert sched.events["e1"].lifecycle == EventLifecycle.CANCELLED

    def test_skip_completed_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        sched.complete_event("e1", 0.0)
        assert sched.skip_event("e1") is None

    def test_skip_already_cancelled_returns_none(self) -> None:
        sched = EventScheduler()
        sched.load_events([_event("e1", scheduled_pt_ms=9999.0)])
        sched.cancel_event("e1")
        assert sched.skip_event("e1") is None


class TestSnapshotIncludesTriggeredIssues:
    def test_triggered_issues_in_snapshot(self) -> None:
        sched = EventScheduler()
        evt = ScheduledEvent(
            id="e1", title="E1", description="",
            event_type=EventType.OPERATIONAL, scheduled_pt_ms=0.0,
            triggered_issues=["i1", "i2"],
        )
        sched.load_events([evt])
        snap = sched.snapshot()
        assert snap[0]["triggered_issues"] == ["i1", "i2"]
