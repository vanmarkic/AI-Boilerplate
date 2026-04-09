"""Property tests for EventScheduler lifecycle transitions."""
from __future__ import annotations

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from engine.event_scheduler import (
    VALID_TRANSITIONS,
    EventLifecycle,
    EventScheduler,
    EventType,
    ScheduledEvent,
)
from engine.strategies import (
    durations,
    monotonic_play_times,
    play_times,
    scheduled_events,
)

TERMINAL = {EventLifecycle.COMPLETED, EventLifecycle.CANCELLED}


def _simple_event(
    eid: str = "e0",
    scheduled_pt_ms: float = 0.0,
    duration_ms: float | None = None,
) -> ScheduledEvent:
    return ScheduledEvent(
        id=eid,
        title=f"Event {eid}",
        description="test",
        event_type=EventType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        duration_ms=duration_ms,
        dependencies=[],
        triggered_issues=[],
    )


class TestTransitionsAlwaysValid:
    """Every lifecycle change must follow VALID_TRANSITIONS."""

    @given(
        scheduled_pt=play_times(),
        duration=st.one_of(st.none(), durations()),
        ticks=monotonic_play_times(min_size=2, max_size=60),
    )
    @settings(max_examples=300)
    def test_tick_only_produces_valid_transitions(
        self,
        scheduled_pt: float,
        duration: float | None,
        ticks: list[float],
    ) -> None:
        event = _simple_event(scheduled_pt_ms=scheduled_pt, duration_ms=duration)
        sched = EventScheduler()
        sched.load_events([event])
        prev = EventLifecycle.SCHEDULED
        for pt in ticks:
            sched.tick(pt)
            current = sched.events["e0"].lifecycle
            if current != prev:
                assert current in VALID_TRANSITIONS[prev], (
                    f"Invalid transition {prev} -> {current} at pt={pt}"
                )
                prev = current


class TestTerminalStatesAbsorbing:
    """Once an event is COMPLETED or CANCELLED, no tick changes its state."""

    @given(
        duration=durations(),
        extra_ticks=monotonic_play_times(min_size=5, max_size=20),
    )
    @settings(max_examples=200)
    def test_completed_event_stays_completed(
        self, duration: float, extra_ticks: list[float],
    ) -> None:
        event = _simple_event(scheduled_pt_ms=0.0, duration_ms=duration)
        sched = EventScheduler()
        sched.load_events([event])
        sched.tick(0.0)   # -> pending
        sched.tick(0.0)   # -> running
        sched.tick(duration + 1.0)  # -> completed
        assert sched.events["e0"].lifecycle == EventLifecycle.COMPLETED
        for pt in extra_ticks:
            sched.tick(duration + 1.0 + pt)
            assert sched.events["e0"].lifecycle == EventLifecycle.COMPLETED

    @given(extra_ticks=monotonic_play_times(min_size=5, max_size=20))
    @settings(max_examples=100)
    def test_cancelled_event_stays_cancelled(
        self, extra_ticks: list[float],
    ) -> None:
        event = _simple_event(scheduled_pt_ms=9999.0)
        sched = EventScheduler()
        sched.load_events([event])
        sched.cancel_event("e0")
        assert sched.events["e0"].lifecycle == EventLifecycle.CANCELLED
        for pt in extra_ticks:
            sched.tick(pt)
            assert sched.events["e0"].lifecycle == EventLifecycle.CANCELLED


class TestCancelIdempotent:
    """Cancelling a terminal event always returns None."""

    @given(duration=durations())
    @settings(max_examples=100)
    def test_cancel_completed_returns_none(self, duration: float) -> None:
        sched = EventScheduler()
        sched.load_events([_simple_event(scheduled_pt_ms=0.0, duration_ms=duration)])
        sched.tick(0.0)
        sched.tick(0.0)
        sched.tick(duration + 1.0)
        assert sched.events["e0"].lifecycle == EventLifecycle.COMPLETED
        assert sched.cancel_event("e0") is None

    @given(data=st.data())
    @settings(max_examples=50)
    def test_double_cancel_returns_none(self, data: st.DataObject) -> None:
        sched = EventScheduler()
        sched.load_events([_simple_event(scheduled_pt_ms=9999.0)])
        sched.cancel_event("e0")
        assert sched.cancel_event("e0") is None


class TestDependencyOrdering:
    """Child events never activate before their dependencies complete."""

    @given(
        dep_schedule=play_times(),
        dep_duration=durations(),
        child_schedule=play_times(),
        ticks=monotonic_play_times(min_size=5, max_size=40),
    )
    @settings(max_examples=200)
    def test_child_waits_for_dependency(
        self,
        dep_schedule: float,
        dep_duration: float,
        child_schedule: float,
        ticks: list[float],
    ) -> None:
        dep = ScheduledEvent(
            id="dep",
            title="Dep",
            description="dep",
            event_type=EventType.OPERATIONAL,
            scheduled_pt_ms=dep_schedule,
            duration_ms=dep_duration,
            dependencies=[],
            triggered_issues=[],
        )
        child = ScheduledEvent(
            id="child",
            title="Child",
            description="child",
            event_type=EventType.OPERATIONAL,
            scheduled_pt_ms=child_schedule,
            dependencies=["dep"],
            triggered_issues=[],
        )
        sched = EventScheduler()
        sched.load_events([dep, child])

        for pt in ticks:
            sched.tick(pt)
            dep_ev = sched.events["dep"]
            child_ev = sched.events["child"]
            if child_ev.lifecycle != EventLifecycle.SCHEDULED:
                assert dep_ev.lifecycle == EventLifecycle.COMPLETED, (
                    f"Child left SCHEDULED ({child_ev.lifecycle}) "
                    f"but dep is {dep_ev.lifecycle}"
                )


class TestSnapshotRoundtrip:
    """Snapshot always returns a list with correct structure."""

    @given(
        n_events=st.integers(min_value=1, max_value=10),
        ticks=monotonic_play_times(min_size=1, max_size=10),
    )
    @settings(max_examples=100)
    def test_snapshot_has_correct_length_and_keys(
        self, n_events: int, ticks: list[float],
    ) -> None:
        events = [
            _simple_event(eid=f"e{i}", scheduled_pt_ms=float(i * 100))
            for i in range(n_events)
        ]
        sched = EventScheduler()
        sched.load_events(events)
        for pt in ticks:
            sched.tick(pt)
        snap = sched.snapshot()
        assert len(snap) == n_events
        required_keys = {"id", "title", "description", "event_type", "scheduled_pt_ms",
                         "duration_ms", "dependencies", "triggered_issues", "lifecycle",
                         "started_at_pt_ms", "completed_at_pt_ms"}
        for entry in snap:
            assert required_keys <= set(entry.keys())
