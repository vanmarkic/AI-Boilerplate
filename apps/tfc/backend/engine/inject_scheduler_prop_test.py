"""Property tests for InjectScheduler lifecycle transitions."""
from __future__ import annotations

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from engine.inject_scheduler import (
    VALID_TRANSITIONS,
    InjectLifecycle,
    InjectScheduler,
    InjectType,
    ScheduledInject,
)
from engine.strategies import (
    durations,
    monotonic_play_times,
    play_times,
    scheduled_injects,
)

TERMINAL = {InjectLifecycle.COMPLETED, InjectLifecycle.CANCELLED}


def _simple_inject(
    eid: str = "e0",
    scheduled_pt_ms: float = 0.0,
    duration_ms: float | None = None,
) -> ScheduledInject:
    return ScheduledInject(
        id=eid,
        title=f"Inject {eid}",
        description="test",
        inject_type=InjectType.OPERATIONAL,
        scheduled_pt_ms=scheduled_pt_ms,
        duration_ms=duration_ms,
        dependencies=[],
        triggered_defects=[],
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
        inject = _simple_inject(scheduled_pt_ms=scheduled_pt, duration_ms=duration)
        sched = InjectScheduler()
        sched.load_injects([inject])
        prev = InjectLifecycle.SCHEDULED
        for pt in ticks:
            sched.tick(pt)
            current = sched.injects["e0"].lifecycle
            if current != prev:
                assert current in VALID_TRANSITIONS[prev], (
                    f"Invalid transition {prev} -> {current} at pt={pt}"
                )
                prev = current


class TestTerminalStatesAbsorbing:
    """Once an inject is COMPLETED or CANCELLED, no tick changes its state."""

    @given(
        duration=durations(),
        extra_ticks=monotonic_play_times(min_size=5, max_size=20),
    )
    @settings(max_examples=200)
    def test_completed_inject_stays_completed(
        self, duration: float, extra_ticks: list[float],
    ) -> None:
        inject = _simple_inject(scheduled_pt_ms=0.0, duration_ms=duration)
        sched = InjectScheduler()
        sched.load_injects([inject])
        sched.tick(0.0)   # -> pending
        sched.tick(0.0)   # -> running
        sched.tick(duration + 1.0)  # -> completed
        assert sched.injects["e0"].lifecycle == InjectLifecycle.COMPLETED
        for pt in extra_ticks:
            sched.tick(duration + 1.0 + pt)
            assert sched.injects["e0"].lifecycle == InjectLifecycle.COMPLETED

    @given(extra_ticks=monotonic_play_times(min_size=5, max_size=20))
    @settings(max_examples=100)
    def test_cancelled_inject_stays_cancelled(
        self, extra_ticks: list[float],
    ) -> None:
        inject = _simple_inject(scheduled_pt_ms=9999.0)
        sched = InjectScheduler()
        sched.load_injects([inject])
        sched.cancel_inject("e0")
        assert sched.injects["e0"].lifecycle == InjectLifecycle.CANCELLED
        for pt in extra_ticks:
            sched.tick(pt)
            assert sched.injects["e0"].lifecycle == InjectLifecycle.CANCELLED


class TestCancelIdempotent:
    """Cancelling a terminal inject always returns None."""

    @given(duration=durations())
    @settings(max_examples=100)
    def test_cancel_completed_returns_none(self, duration: float) -> None:
        sched = InjectScheduler()
        sched.load_injects([_simple_inject(scheduled_pt_ms=0.0, duration_ms=duration)])
        sched.tick(0.0)
        sched.tick(0.0)
        sched.tick(duration + 1.0)
        assert sched.injects["e0"].lifecycle == InjectLifecycle.COMPLETED
        assert sched.cancel_inject("e0") is None

    @given(data=st.data())
    @settings(max_examples=50)
    def test_double_cancel_returns_none(self, data: st.DataObject) -> None:
        sched = InjectScheduler()
        sched.load_injects([_simple_inject(scheduled_pt_ms=9999.0)])
        sched.cancel_inject("e0")
        assert sched.cancel_inject("e0") is None


class TestDependencyOrdering:
    """Child injects never activate before their dependencies complete."""

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
        dep = ScheduledInject(
            id="dep",
            title="Dep",
            description="dep",
            inject_type=InjectType.OPERATIONAL,
            scheduled_pt_ms=dep_schedule,
            duration_ms=dep_duration,
            dependencies=[],
            triggered_defects=[],
        )
        child = ScheduledInject(
            id="child",
            title="Child",
            description="child",
            inject_type=InjectType.OPERATIONAL,
            scheduled_pt_ms=child_schedule,
            dependencies=["dep"],
            triggered_defects=[],
        )
        sched = InjectScheduler()
        sched.load_injects([dep, child])

        for pt in ticks:
            sched.tick(pt)
            dep_inj = sched.injects["dep"]
            child_inj = sched.injects["child"]
            if child_inj.lifecycle != InjectLifecycle.SCHEDULED:
                assert dep_inj.lifecycle == InjectLifecycle.COMPLETED, (
                    f"Child left SCHEDULED ({child_inj.lifecycle}) "
                    f"but dep is {dep_inj.lifecycle}"
                )


class TestSnapshotRoundtrip:
    """Snapshot always returns a list with correct structure."""

    @given(
        n_injects=st.integers(min_value=1, max_value=10),
        ticks=monotonic_play_times(min_size=1, max_size=10),
    )
    @settings(max_examples=100)
    def test_snapshot_has_correct_length_and_keys(
        self, n_injects: int, ticks: list[float],
    ) -> None:
        injects = [
            _simple_inject(eid=f"e{i}", scheduled_pt_ms=float(i * 100))
            for i in range(n_injects)
        ]
        sched = InjectScheduler()
        sched.load_injects(injects)
        for pt in ticks:
            sched.tick(pt)
        snap = sched.snapshot()
        assert len(snap) == n_injects
        required_keys = {"id", "title", "description", "inject_type", "scheduled_pt_ms",
                         "duration_ms", "dependencies", "triggered_defects", "lifecycle",
                         "started_at_pt_ms", "completed_at_pt_ms"}
        for entry in snap:
            assert required_keys <= set(entry.keys())
