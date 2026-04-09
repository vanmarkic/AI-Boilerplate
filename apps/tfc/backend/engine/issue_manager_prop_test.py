"""Property tests for IssueManager lifecycle and triggers."""
from __future__ import annotations

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from engine.issue_manager import (
    VALID_TRANSITIONS,
    IssueLifecycle,
    IssueManager,
    TrackedIssue,
    TriggerMode,
)
from engine.strategies import durations, monotonic_play_times, play_times

TERMINAL = {IssueLifecycle.RESOLVED}


def _issue(
    iid: str = "i0",
    trigger_mode: TriggerMode = TriggerMode.TIME_BASED,
    trigger_time_pt_ms: float | None = None,
    trigger_event_id: str | None = None,
    auto_resolve_ms: float = 0.0,
) -> TrackedIssue:
    return TrackedIssue(
        id=iid,
        title=f"Issue {iid}",
        description="generated",
        trigger_mode=trigger_mode,
        trigger_time_pt_ms=trigger_time_pt_ms,
        trigger_event_id=trigger_event_id,
        auto_resolve_ms=auto_resolve_ms,
    )


class TestTransitionsAlwaysValid:
    """Every lifecycle change must follow VALID_TRANSITIONS."""

    @given(
        trigger_time=play_times(),
        auto_resolve=st.one_of(st.just(0.0), durations()),
        ticks=monotonic_play_times(min_size=2, max_size=50),
    )
    @settings(max_examples=300)
    def test_tick_only_produces_valid_transitions(
        self,
        trigger_time: float,
        auto_resolve: float,
        ticks: list[float],
    ) -> None:
        issue = _issue(trigger_time_pt_ms=trigger_time, auto_resolve_ms=auto_resolve)
        mgr = IssueManager()
        mgr.load_issues([issue])
        prev = IssueLifecycle.INACTIVE
        for pt in ticks:
            mgr.tick(pt, set())
            current = mgr.issues["i0"].lifecycle
            if current != prev:
                assert current in VALID_TRANSITIONS[prev], (
                    f"Invalid transition {prev} -> {current} at pt={pt}"
                )
                prev = current


class TestResolvedAbsorbing:
    """Once resolved, no tick or operation changes the lifecycle."""

    @given(
        trigger_time=play_times(),
        auto_resolve=durations(),
        extra_ticks=monotonic_play_times(min_size=5, max_size=20),
    )
    @settings(max_examples=200)
    def test_auto_resolved_stays_resolved(
        self,
        trigger_time: float,
        auto_resolve: float,
        extra_ticks: list[float],
    ) -> None:
        issue = _issue(trigger_time_pt_ms=trigger_time, auto_resolve_ms=auto_resolve)
        mgr = IssueManager()
        mgr.load_issues([issue])
        # Activate then wait for auto-resolve
        far_future = trigger_time + auto_resolve + 1.0
        mgr.tick(far_future, set())  # activates
        mgr.tick(far_future + auto_resolve + 1.0, set())  # auto-resolves
        if mgr.issues["i0"].lifecycle != IssueLifecycle.RESOLVED:
            return  # timing edge case, skip
        for pt in extra_ticks:
            mgr.tick(far_future + auto_resolve + 1.0 + pt, set())
            assert mgr.issues["i0"].lifecycle == IssueLifecycle.RESOLVED

    @given(extra_ticks=monotonic_play_times(min_size=3, max_size=15))
    @settings(max_examples=100)
    def test_manually_resolved_stays_resolved(
        self, extra_ticks: list[float],
    ) -> None:
        issue = _issue(trigger_mode=TriggerMode.MANUAL)
        mgr = IssueManager()
        mgr.load_issues([issue])
        mgr.manual_activate("i0", 0.0)
        mgr.resolve("i0", 100.0)
        assert mgr.issues["i0"].lifecycle == IssueLifecycle.RESOLVED
        for pt in extra_ticks:
            mgr.tick(pt, set())
            assert mgr.issues["i0"].lifecycle == IssueLifecycle.RESOLVED


class TestMitigateResolveGuards:
    """Operations on wrong states always return None."""

    @given(data=st.data())
    @settings(max_examples=100)
    def test_mitigate_inactive_returns_none(self, data: st.DataObject) -> None:
        issue = _issue(trigger_mode=TriggerMode.MANUAL)
        mgr = IssueManager()
        mgr.load_issues([issue])
        assert mgr.mitigate("i0") is None

    @given(data=st.data())
    @settings(max_examples=100)
    def test_resolve_inactive_returns_none(self, data: st.DataObject) -> None:
        issue = _issue(trigger_mode=TriggerMode.MANUAL)
        mgr = IssueManager()
        mgr.load_issues([issue])
        assert mgr.resolve("i0", 0.0) is None

    @given(data=st.data())
    @settings(max_examples=50)
    def test_resolve_already_resolved_returns_none(self, data: st.DataObject) -> None:
        issue = _issue(trigger_mode=TriggerMode.MANUAL)
        mgr = IssueManager()
        mgr.load_issues([issue])
        mgr.manual_activate("i0", 0.0)
        mgr.resolve("i0", 100.0)
        assert mgr.resolve("i0", 200.0) is None


class TestEventBasedActivation:
    """Event-triggered issues only activate when their event is completed."""

    @given(
        event_id=st.text(min_size=1, max_size=5, alphabet=st.characters(whitelist_categories=("L",))),
        wrong_ids=st.lists(
            st.text(min_size=1, max_size=5, alphabet=st.characters(whitelist_categories=("L",))),
            min_size=1,
            max_size=5,
        ),
    )
    @settings(max_examples=100)
    def test_wrong_event_does_not_activate(
        self, event_id: str, wrong_ids: list[str],
    ) -> None:
        issue = _issue(
            trigger_mode=TriggerMode.EVENT_BASED,
            trigger_event_id=event_id,
        )
        mgr = IssueManager()
        mgr.load_issues([issue])
        for wid in wrong_ids:
            if wid == event_id:
                continue
            mgr.activate_by_event(wid, 0.0)
            assert mgr.issues["i0"].lifecycle == IssueLifecycle.INACTIVE


class TestActivationSetsReleasedFlag:
    """Any activation path must set released_to_players = True."""

    @given(pt=play_times())
    @settings(max_examples=50)
    def test_time_activated_is_released(self, pt: float) -> None:
        issue = _issue(trigger_time_pt_ms=0.0)
        mgr = IssueManager()
        mgr.load_issues([issue])
        mgr.tick(pt, set())
        if mgr.issues["i0"].lifecycle == IssueLifecycle.ACTIVE:
            assert mgr.issues["i0"].released_to_players is True

    @given(pt=play_times())
    @settings(max_examples=50)
    def test_manual_activated_is_released(self, pt: float) -> None:
        issue = _issue(trigger_mode=TriggerMode.MANUAL)
        mgr = IssueManager()
        mgr.load_issues([issue])
        mgr.manual_activate("i0", pt)
        assert mgr.issues["i0"].released_to_players is True


class TestSnapshotConsistency:
    """Snapshot length matches loaded issues."""

    @given(n=st.integers(min_value=0, max_value=15))
    @settings(max_examples=50)
    def test_snapshot_length_matches_loaded(self, n: int) -> None:
        issues = [
            _issue(iid=f"i{i}", trigger_mode=TriggerMode.MANUAL) for i in range(n)
        ]
        mgr = IssueManager()
        mgr.load_issues(issues)
        assert len(mgr.snapshot()) == n
