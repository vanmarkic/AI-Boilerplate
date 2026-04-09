"""Tests for P2 InjectScheduler additions: pause, resume, delay, skip."""
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
) -> ScheduledInject:
    return ScheduledInject(
        id=id,
        title=f"Inject {id}",
        description="test",
        inject_type=InjectType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        duration_ms=duration_ms,
    )


class TestPauseInject:
    def test_pause_running_inject(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        result = sched.pause_inject("e1")
        assert result is not None
        assert result["action"] == "paused"
        assert sched.injects["e1"].lifecycle == InjectLifecycle.PAUSED

    def test_pause_non_running_returns_none(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=9999.0)])
        assert sched.pause_inject("e1") is None

    def test_paused_inject_does_not_tick(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", duration_ms=100.0)])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        sched.pause_inject("e1")
        # Tick past duration — inject should stay paused
        changes = sched.tick(200.0)
        assert sched.injects["e1"].lifecycle == InjectLifecycle.PAUSED
        assert not any(c.get("action") == "completed" for c in changes)


class TestResumeInject:
    def test_resume_paused_inject(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        sched.pause_inject("e1")
        result = sched.resume_inject("e1", 50.0)
        assert result is not None
        assert result["action"] == "resumed"
        assert sched.injects["e1"].lifecycle == InjectLifecycle.RUNNING

    def test_resume_non_paused_returns_none(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        assert sched.resume_inject("e1", 0.0) is None

    def test_resume_nonexistent_returns_none(self) -> None:
        sched = InjectScheduler()
        assert sched.resume_inject("nope", 0.0) is None


class TestDelayInject:
    def test_delay_scheduled_inject(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=1000.0)])
        result = sched.delay_inject("e1", 500.0)
        assert result is not None
        assert result["action"] == "delayed"
        assert sched.injects["e1"].scheduled_pt_ms == 1500.0

    def test_delay_non_scheduled_returns_none(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1")])
        sched.tick(0.0)  # -> pending
        assert sched.delay_inject("e1", 500.0) is None

    def test_delay_nonexistent_returns_none(self) -> None:
        sched = InjectScheduler()
        assert sched.delay_inject("nope", 100.0) is None

    def test_delayed_inject_activates_at_new_time(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=100.0)])
        sched.delay_inject("e1", 200.0)
        # Should not activate at original time
        changes = sched.tick(100.0)
        assert sched.injects["e1"].lifecycle == InjectLifecycle.SCHEDULED
        assert len(changes) == 0
        # Should activate at new time
        sched.tick(300.0)
        assert sched.injects["e1"].lifecycle == InjectLifecycle.PENDING


class TestSkipInject:
    def test_skip_scheduled_inject(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=9999.0)])
        result = sched.skip_inject("e1")
        assert result is not None
        assert result["action"] == "skipped"
        assert sched.injects["e1"].lifecycle == InjectLifecycle.CANCELLED

    def test_skip_running_inject(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        result = sched.skip_inject("e1")
        assert result is not None
        assert sched.injects["e1"].lifecycle == InjectLifecycle.CANCELLED

    def test_skip_completed_returns_none(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1")])
        sched.tick(0.0)  # -> pending
        sched.tick(0.0)  # -> running
        sched.complete_inject("e1", 0.0)
        assert sched.skip_inject("e1") is None

    def test_skip_already_cancelled_returns_none(self) -> None:
        sched = InjectScheduler()
        sched.load_injects([_inject("e1", scheduled_pt_ms=9999.0)])
        sched.cancel_inject("e1")
        assert sched.skip_inject("e1") is None
