"""Hypothesis strategies for generating engine domain objects.

Used by property tests (*_prop_test.py) to generate random but valid
ScheduledEvent, TrackedIssue, ActiveDecision, and EngineConfig instances.
"""
from __future__ import annotations

from hypothesis import strategies as st
from hypothesis.strategies import SearchStrategy

from engine.decision_manager import ActiveDecision
from engine.event_scheduler import EventLifecycle, EventType, ScheduledEvent
from engine.issue_manager import IssueLifecycle, TrackedIssue, TriggerMode


def event_ids(prefix: str = "e") -> SearchStrategy[str]:
    """Generate short event-style IDs like 'e0', 'e1', ..., 'e19'."""
    return st.integers(min_value=0, max_value=19).map(lambda i: f"{prefix}{i}")


def issue_ids() -> SearchStrategy[str]:
    return event_ids(prefix="i")


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
def scheduled_events(
    draw: st.DrawFn,
    *,
    with_duration: bool | None = None,
    with_dependencies: bool = False,
) -> ScheduledEvent:
    """Generate a random ScheduledEvent."""
    eid = draw(event_ids())
    scheduled_pt = draw(play_times())
    duration = None
    if with_duration is True or (with_duration is None and draw(st.booleans())):
        duration = draw(durations())
    deps: list[str] = []
    if with_dependencies:
        deps = draw(st.lists(event_ids(), max_size=3, unique=True))
        deps = [d for d in deps if d != eid]
    return ScheduledEvent(
        id=eid,
        title=f"Event {eid}",
        description="generated",
        event_type=draw(st.sampled_from(EventType)),
        scheduled_pt_ms=scheduled_pt,
        duration_ms=duration,
        dependencies=deps,
        triggered_issues=[],
    )


@st.composite
def tracked_issues(
    draw: st.DrawFn,
    *,
    trigger_mode: TriggerMode | None = None,
) -> TrackedIssue:
    """Generate a random TrackedIssue."""
    iid = draw(issue_ids())
    mode = trigger_mode or draw(st.sampled_from(TriggerMode))
    trigger_time = draw(play_times()) if mode == TriggerMode.TIME_BASED else None
    trigger_event = draw(event_ids()) if mode == TriggerMode.EVENT_BASED else None
    auto_resolve = draw(st.one_of(st.just(0.0), durations()))
    return TrackedIssue(
        id=iid,
        title=f"Issue {iid}",
        description="generated",
        trigger_mode=mode,
        trigger_time_pt_ms=trigger_time,
        trigger_event_id=trigger_event,
        auto_resolve_ms=auto_resolve,
    )


def monotonic_play_times(min_size: int = 1, max_size: int = 50) -> SearchStrategy[list[float]]:
    """Generate a sorted list of non-negative play times (monotonic ticks)."""
    return st.lists(
        play_times(), min_size=min_size, max_size=max_size,
    ).map(sorted)


def scores() -> SearchStrategy[float]:
    """Non-negative scores for decision options."""
    return st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False)


def signed_scores() -> SearchStrategy[float]:
    """Scores that can be positive, zero, or negative."""
    return st.floats(min_value=-50.0, max_value=100.0, allow_nan=False, allow_infinity=False)


def penalty_factors() -> SearchStrategy[float]:
    """Positive penalty multipliers."""
    return st.floats(min_value=0.01, max_value=10.0, allow_nan=False, allow_infinity=False)


def decision_sequences(min_size: int = 1, max_size: int = 10) -> SearchStrategy[list[str]]:
    """Generate a list of unique decision template IDs."""
    return st.lists(
        event_ids(prefix="d"), min_size=min_size, max_size=max_size, unique=True,
    )


def option_lists(min_size: int = 1, max_size: int = 6) -> SearchStrategy[list[dict]]:
    """Generate lists of decision options with id, label, and score."""
    return st.lists(
        st.fixed_dictionaries({
            "id": st.text(alphabet="abcdefghijklmnop", min_size=1, max_size=5),
            "label": st.just("Option"),
            "score": scores(),
        }),
        min_size=min_size,
        max_size=max_size,
        unique_by=lambda o: o["id"],
    )


def signed_option_lists(
    min_size: int = 1, max_size: int = 6,
) -> SearchStrategy[list[dict]]:
    """Option lists with +/0/- scores."""
    return st.lists(
        st.fixed_dictionaries({
            "id": st.text(alphabet="abcdefghijklmnop", min_size=1, max_size=5),
            "label": st.just("Option"),
            "score": signed_scores(),
        }),
        min_size=min_size,
        max_size=max_size,
        unique_by=lambda o: o["id"],
    )
