"""Tests for SystemManager power and operational state management."""

from engine.system_manager import SystemManager, SystemState


def _system(
    system_id: str = "s1",
    label: str = "",
    category: str = "system",
    power: bool = False,
    operational: str = "green",
) -> SystemState:
    return SystemState(
        system_id=system_id,
        label=label or f"System {system_id}",
        category=category,
        power=power,
        operational=operational,
    )


class TestLoadSystems:
    def test_load_replaces_existing(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1"), _system("s2")])
        assert len(mgr.systems) == 2
        mgr.load_systems([_system("s3")])
        assert len(mgr.systems) == 1
        assert "s3" in mgr.systems


class TestSetPower:
    def test_power_on(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", power=False)])
        change = mgr.set_power("s1", True)
        assert change is not None
        assert change["type"] == "system_state_change"
        assert change["action"] == "power_changed"
        assert change["power"] is True
        assert mgr.systems["s1"].power is True

    def test_power_no_change_returns_none(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", power=True)])
        assert mgr.set_power("s1", True) is None

    def test_power_unknown_system_returns_none(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([])
        assert mgr.set_power("unknown", True) is None


class TestSetOperational:
    def test_set_to_yellow(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", operational="green")])
        change = mgr.set_operational("s1", "yellow")
        assert change is not None
        assert change["action"] == "operational_changed"
        assert change["operational"] == "yellow"
        assert mgr.systems["s1"].operational == "yellow"

    def test_no_change_returns_none(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", operational="red")])
        assert mgr.set_operational("s1", "red") is None

    def test_invalid_state_returns_none(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1")])
        assert mgr.set_operational("s1", "purple") is None

    def test_unknown_system_returns_none(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([])
        assert mgr.set_operational("unknown", "red") is None


class TestIncrementOperational:
    def test_red_to_yellow(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", operational="red")])
        change = mgr.increment_operational("s1")
        assert change is not None
        assert mgr.systems["s1"].operational == "yellow"

    def test_yellow_to_green(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", operational="yellow")])
        change = mgr.increment_operational("s1")
        assert change is not None
        assert mgr.systems["s1"].operational == "green"

    def test_already_green_returns_none(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", operational="green")])
        assert mgr.increment_operational("s1") is None

    def test_unknown_system_returns_none(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([])
        assert mgr.increment_operational("unknown") is None


class TestSetAllPower:
    def test_all_on(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", power=False), _system("s2", power=False)])
        changes = mgr.set_all_power(True)
        assert len(changes) == 2
        assert all(s.power is True for s in mgr.systems.values())

    def test_skips_already_on(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", power=True), _system("s2", power=False)])
        changes = mgr.set_all_power(True)
        assert len(changes) == 1
        assert changes[0]["system_id"] == "s2"

    def test_all_off(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", power=True), _system("s2", power=True)])
        changes = mgr.set_all_power(False)
        assert len(changes) == 2
        assert all(s.power is False for s in mgr.systems.values())

    def test_empty_systems(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([])
        assert mgr.set_all_power(True) == []


class TestSnapshot:
    def test_snapshot_returns_all_systems(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([_system("s1", power=True, operational="yellow")])
        snap = mgr.snapshot()
        assert len(snap) == 1
        assert snap[0]["system_id"] == "s1"
        assert snap[0]["power"] is True
        assert snap[0]["operational"] == "yellow"
        assert snap[0]["label"] == "System s1"
        assert snap[0]["category"] == "system"

    def test_empty_snapshot(self) -> None:
        mgr = SystemManager()
        mgr.load_systems([])
        assert mgr.snapshot() == []
