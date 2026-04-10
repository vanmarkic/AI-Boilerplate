"""Hypothesis strategies for generating engine domain objects.

Used by property tests (*_prop_test.py) to generate random but valid
ScheduledInject, TrackedDefect, ActiveDecision, and EngineConfig instances.
"""
from __future__ import annotations

from hypothesis import strategies as st
from hypothesis.strategies import SearchStrategy

from engine.decision_manager import ActiveDecision
from engine.inject_scheduler import InjectLifecycle, InjectType, ScheduledInject
from engine.defect_manager import DefectLifecycle, TrackedDefect, TriggerMode


def inject_ids(prefix: str = "e") -> SearchStrategy[str]:
    """Generate short inject-style IDs like 'e0', 'e1', ..., 'e19'."""
    return st.integers(min_value=0, max_value=19).map(lambda i: f"{prefix}{i}")


def defect_ids() -> SearchStrategy[str]:
    return inject_ids(prefix="i")


def play_times() -> SearchStrategy[float]:
    """Non-negative play times in ms, avoiding infinities."""
    return st.floats(min_value=0.0, max_value=1e8, allow_nan=False, allow_infinity=False)


def durations() -> SearchStrategy[float]:
    """Positive durations in ms."""
    return st.floats(min_value=1.0, max_value=1e7, allow_nan=False, allow_infinity=False)


def speed_factors() -> SearchStrategy[float]:
    """Valid speed factors (positive, reasonable range)."""
    return st.floats(min_value=0.01, max_value=100.0, allow_nan=False, allow_infinity=False)


@st.composite
def scheduled_injects(
    draw: st.DrawFn,
    *,
    with_duration: bool | None = None,
    with_dependencies: bool = False,
) -> ScheduledInject:
    """Generate a random ScheduledInject."""
    eid = draw(inject_ids())
    scheduled_pt = draw(play_times())
    duration = None
    if with_duration is True or (with_duration is None and draw(st.booleans())):
        duration = draw(durations())
    deps: list[str] = []
    if with_dependencies:
        deps = draw(st.lists(inject_ids(), max_size=3, unique=True))
        deps = [d for d in deps if d != eid]
    return ScheduledInject(
        id=eid,
        title=f"Inject {eid}",
        description="generated",
        inject_type=draw(st.sampled_from(InjectType)),
        scheduled_pt_ms=scheduled_pt,
        duration_ms=duration,
        dependencies=deps,
        triggered_defects=[],
    )


@st.composite
def tracked_defects(
    draw: st.DrawFn,
    *,
    trigger_mode: TriggerMode | None = None,
) -> TrackedDefect:
    """Generate a random TrackedDefect."""
    iid = draw(defect_ids())
    mode = trigger_mode or draw(st.sampled_from(TriggerMode))
    trigger_time = draw(play_times()) if mode == TriggerMode.TIME_BASED else None
    trigger_inject = draw(inject_ids()) if mode == TriggerMode.INJECT_BASED else None
    auto_resolve = draw(st.one_of(st.just(0.0), durations()))
    return TrackedDefect(
        id=iid,
        title=f"Defect {iid}",
        description="generated",
        trigger_mode=mode,
        trigger_time_pt_ms=trigger_time,
        trigger_inject_id=trigger_inject,
        auto_resolve_pt_ms=auto_resolve,
    )


def monotonic_play_times(min_size: int = 1, max_size: int = 50) -> SearchStrategy[list[float]]:
    """Generate a sorted list of non-negative play times (monotonic ticks)."""
    return st.lists(
        play_times(), min_size=min_size, max_size=max_size,
    ).map(sorted)
