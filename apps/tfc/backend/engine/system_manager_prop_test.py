"""Property tests for SystemManager.

Invariants tested:
- Load/snapshot round-trip: loading systems and snapshotting preserves all data.
- Power toggle idempotency: setting power to the same value returns None.
- Operational set idempotency: setting operational to the same value returns None.
- Increment ceiling: incrementing past green returns None.
- set_all_power completeness: all systems end up with the requested power state.
- Unknown system returns None for all mutation methods.
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from engine.strategies import system_state_lists, system_states
from engine.system_manager import OPERATIONAL_ORDER, SystemManager, SystemState


class TestLoadSnapshotRoundTrip:
    """Loading systems then snapshotting preserves all fields."""

    @given(systems=system_state_lists(min_size=0, max_size=10))
    @settings(max_examples=200)
    def test_snapshot_matches_loaded_systems(
        self,
        systems: list[SystemState],
    ) -> None:
        mgr = SystemManager()
        mgr.load_systems(systems)
        snap = mgr.snapshot()
        assert len(snap) == len(systems)
        by_id = {s["system_id"]: s for s in snap}
        for s in systems:
            assert s.system_id in by_id
            entry = by_id[s.system_id]
            assert entry["label"] == s.label
            assert entry["category"] == s.category
            assert entry["power"] == s.power
            assert entry["operational"] == s.operational


class TestPowerToggle:
    """set_power returns None when value unchanged, change dict otherwise."""

    @given(state=system_states())
    @settings(max_examples=200)
    def test_same_power_returns_none(self, state: SystemState) -> None:
        mgr = SystemManager()
        mgr.load_systems([state])
        result = mgr.set_power(state.system_id, state.power)
        assert result is None

    @given(state=system_states())
    @settings(max_examples=200)
    def test_different_power_returns_change(self, state: SystemState) -> None:
        mgr = SystemManager()
        mgr.load_systems([state])
        original_power = state.power
        result = mgr.set_power(state.system_id, not original_power)
        assert result is not None
        assert result["system_id"] == state.system_id
        assert result["power"] == (not original_power)
        assert result["action"] == "power_changed"


class TestOperationalSet:
    """set_operational returns None when value unchanged or invalid."""

    @given(state=system_states())
    @settings(max_examples=200)
    def test_same_operational_returns_none(self, state: SystemState) -> None:
        mgr = SystemManager()
        mgr.load_systems([state])
        result = mgr.set_operational(state.system_id, state.operational)
        assert result is None

    @given(
        state=system_states(),
        target=st.sampled_from(OPERATIONAL_ORDER),
    )
    @settings(max_examples=200)
    def test_different_operational_returns_change(
        self,
        state: SystemState,
        target: str,
    ) -> None:
        mgr = SystemManager()
        mgr.load_systems([state])
        original_op = state.operational
        result = mgr.set_operational(state.system_id, target)
        if target == original_op:
            assert result is None
        else:
            assert result is not None
            assert result["operational"] == target

    @given(state=system_states())
    @settings(max_examples=100)
    def test_invalid_operational_returns_none(self, state: SystemState) -> None:
        mgr = SystemManager()
        mgr.load_systems([state])
        assert mgr.set_operational(state.system_id, "invalid_color") is None


class TestIncrementOperational:
    """increment_operational walks red->yellow->green, None at ceiling."""

    @given(state=system_states())
    @settings(max_examples=200)
    def test_green_returns_none(self, state: SystemState) -> None:
        state.operational = "green"
        mgr = SystemManager()
        mgr.load_systems([state])
        assert mgr.increment_operational(state.system_id) is None

    @given(
        state=system_states(),
        op=st.sampled_from(["red", "yellow"]),
    )
    @settings(max_examples=200)
    def test_non_green_increments(self, state: SystemState, op: str) -> None:
        state.operational = op
        mgr = SystemManager()
        mgr.load_systems([state])
        result = mgr.increment_operational(state.system_id)
        assert result is not None
        expected_idx = OPERATIONAL_ORDER.index(op) + 1
        assert result["operational"] == OPERATIONAL_ORDER[expected_idx]


class TestSetAllPower:
    """set_all_power sets every system to the requested power state."""

    @given(
        systems=system_state_lists(min_size=1, max_size=10),
        on=st.booleans(),
    )
    @settings(max_examples=200)
    def test_all_systems_match_requested_state(
        self,
        systems: list[SystemState],
        on: bool,
    ) -> None:
        mgr = SystemManager()
        mgr.load_systems(systems)
        mgr.set_all_power(on)
        for s in mgr.systems.values():
            assert s.power == on


class TestUnknownSystem:
    """All mutation methods return None for unknown system IDs."""

    @given(state=system_states())
    @settings(max_examples=100)
    def test_unknown_id_returns_none(self, state: SystemState) -> None:
        mgr = SystemManager()
        mgr.load_systems([state])
        unknown = state.system_id + "_unknown"
        assert mgr.set_power(unknown, True) is None
        assert mgr.set_operational(unknown, "red") is None
        assert mgr.increment_operational(unknown) is None
