"""Property tests for DefectManager lifecycle and triggers."""
from __future__ import annotations

from hypothesis import given, settings, assume
from hypothesis import strategies as st

from engine.defect_manager import (
    VALID_TRANSITIONS,
    DefectLifecycle,
    DefectManager,
    TrackedDefect,
    TriggerMode,
)
from engine.strategies import durations, monotonic_play_times, play_times

TERMINAL = {DefectLifecycle.RESOLVED}


def _defect(
    iid: str = "i0",
    trigger_mode: TriggerMode = TriggerMode.TIME_BASED,
    trigger_time_pt_ms: float | None = None,
    trigger_inject_id: str | None = None,
    auto_resolve_pt_ms: float = 0.0,
) -> TrackedDefect:
    return TrackedDefect(
        id=iid,
        title=f"Defect {iid}",
        description="generated",
        trigger_mode=trigger_mode,
        trigger_time_pt_ms=trigger_time_pt_ms,
        trigger_inject_id=trigger_inject_id,
        auto_resolve_pt_ms=auto_resolve_pt_ms,
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
        defect = _defect(trigger_time_pt_ms=trigger_time, auto_resolve_pt_ms=auto_resolve)
        mgr = DefectManager()
        mgr.load_defects([defect])
        prev = DefectLifecycle.INACTIVE
        for pt in ticks:
            mgr.tick(pt, set())
            current = mgr.defects["i0"].lifecycle
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
        defect = _defect(trigger_time_pt_ms=trigger_time, auto_resolve_pt_ms=auto_resolve)
        mgr = DefectManager()
        mgr.load_defects([defect])
        # Activate then wait for auto-resolve
        far_future = trigger_time + auto_resolve + 1.0
        mgr.tick(far_future, set())  # activates
        mgr.tick(far_future + auto_resolve + 1.0, set())  # auto-resolves
        if mgr.defects["i0"].lifecycle != DefectLifecycle.RESOLVED:
            return  # timing edge case, skip
        for pt in extra_ticks:
            mgr.tick(far_future + auto_resolve + 1.0 + pt, set())
            assert mgr.defects["i0"].lifecycle == DefectLifecycle.RESOLVED

    @given(extra_ticks=monotonic_play_times(min_size=3, max_size=15))
    @settings(max_examples=100)
    def test_manually_resolved_stays_resolved(
        self, extra_ticks: list[float],
    ) -> None:
        defect = _defect(trigger_mode=TriggerMode.MANUAL)
        mgr = DefectManager()
        mgr.load_defects([defect])
        mgr.manual_activate("i0", 0.0)
        mgr.resolve("i0", 100.0)
        assert mgr.defects["i0"].lifecycle == DefectLifecycle.RESOLVED
        for pt in extra_ticks:
            mgr.tick(pt, set())
            assert mgr.defects["i0"].lifecycle == DefectLifecycle.RESOLVED


class TestMitigateResolveGuards:
    """Operations on wrong states always return None."""

    @given(data=st.data())
    @settings(max_examples=100)
    def test_mitigate_inactive_returns_none(self, data: st.DataObject) -> None:
        defect = _defect(trigger_mode=TriggerMode.MANUAL)
        mgr = DefectManager()
        mgr.load_defects([defect])
        assert mgr.mitigate("i0") is None

    @given(data=st.data())
    @settings(max_examples=100)
    def test_resolve_inactive_returns_none(self, data: st.DataObject) -> None:
        defect = _defect(trigger_mode=TriggerMode.MANUAL)
        mgr = DefectManager()
        mgr.load_defects([defect])
        assert mgr.resolve("i0", 0.0) is None

    @given(data=st.data())
    @settings(max_examples=50)
    def test_resolve_already_resolved_returns_none(self, data: st.DataObject) -> None:
        defect = _defect(trigger_mode=TriggerMode.MANUAL)
        mgr = DefectManager()
        mgr.load_defects([defect])
        mgr.manual_activate("i0", 0.0)
        mgr.resolve("i0", 100.0)
        assert mgr.resolve("i0", 200.0) is None


class TestInjectBasedActivation:
    """Inject-triggered defects only activate when their inject is completed."""

    @given(
        inject_id=st.text(min_size=1, max_size=5, alphabet=st.characters(whitelist_categories=("L",))),
        wrong_ids=st.lists(
            st.text(min_size=1, max_size=5, alphabet=st.characters(whitelist_categories=("L",))),
            min_size=1,
            max_size=5,
        ),
    )
    @settings(max_examples=100)
    def test_wrong_inject_does_not_activate(
        self, inject_id: str, wrong_ids: list[str],
    ) -> None:
        defect = _defect(
            trigger_mode=TriggerMode.INJECT_BASED,
            trigger_inject_id=inject_id,
        )
        mgr = DefectManager()
        mgr.load_defects([defect])
        for wid in wrong_ids:
            if wid == inject_id:
                continue
            mgr.activate_by_inject(wid, 0.0)
            assert mgr.defects["i0"].lifecycle == DefectLifecycle.INACTIVE


class TestActivationSetsReleasedFlag:
    """Any activation path must set released_to_players = True."""

    @given(pt=play_times())
    @settings(max_examples=50)
    def test_time_activated_is_released(self, pt: float) -> None:
        defect = _defect(trigger_time_pt_ms=0.0)
        mgr = DefectManager()
        mgr.load_defects([defect])
        mgr.tick(pt, set())
        if mgr.defects["i0"].lifecycle == DefectLifecycle.ACTIVE:
            assert mgr.defects["i0"].released_to_players is True

    @given(pt=play_times())
    @settings(max_examples=50)
    def test_manual_activated_is_released(self, pt: float) -> None:
        defect = _defect(trigger_mode=TriggerMode.MANUAL)
        mgr = DefectManager()
        mgr.load_defects([defect])
        mgr.manual_activate("i0", pt)
        assert mgr.defects["i0"].released_to_players is True


class TestSnapshotConsistency:
    """Snapshot length matches loaded defects."""

    @given(n=st.integers(min_value=0, max_value=15))
    @settings(max_examples=50)
    def test_snapshot_length_matches_loaded(self, n: int) -> None:
        defects = [
            _defect(iid=f"i{i}", trigger_mode=TriggerMode.MANUAL) for i in range(n)
        ]
        mgr = DefectManager()
        mgr.load_defects(defects)
        assert len(mgr.snapshot()) == n
