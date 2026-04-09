"""Tests for DefectManager lifecycle and triggers."""
import pytest

from engine.defect_manager import (
    DefectLifecycle,
    DefectManager,
    TrackedDefect,
    TriggerMode,
)


def _defect(
    id: str = "i1",
    trigger_mode: TriggerMode = TriggerMode.TIME_BASED,
    trigger_time_pt_ms: float | None = None,
    trigger_inject_id: str | None = None,
    auto_resolve_ms: float = 0.0,
) -> TrackedDefect:
    return TrackedDefect(
        id=id,
        title=f"Defect {id}",
        description="test",
        trigger_mode=trigger_mode,
        trigger_time_pt_ms=trigger_time_pt_ms,
        trigger_inject_id=trigger_inject_id,
        auto_resolve_ms=auto_resolve_ms,
    )


class TestTimeBasedActivation:
    def test_activates_at_trigger_time(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_time_pt_ms=500.0)])
        changes = mgr.tick(500.0, set())
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.ACTIVE
        assert any(c["action"] == "activated" for c in changes)

    def test_not_activated_before_time(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_time_pt_ms=500.0)])
        mgr.tick(499.0, set())
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.INACTIVE


class TestInjectBasedActivation:
    def test_activate_by_inject(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([
            _defect(
                "i1",
                trigger_mode=TriggerMode.INJECT_BASED,
                trigger_inject_id="evt1",
            ),
        ])
        changes = mgr.activate_by_inject("evt1", 100.0)
        assert len(changes) == 1
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.ACTIVE
        assert mgr.defects["i1"].activated_at_pt_ms == 100.0

    def test_activate_by_inject_wrong_id_no_change(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([
            _defect("i1", trigger_mode=TriggerMode.INJECT_BASED, trigger_inject_id="evt1"),
        ])
        changes = mgr.activate_by_inject("evt_other", 100.0)
        assert len(changes) == 0
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.INACTIVE


class TestManualActivation:
    def test_manual_activate(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_mode=TriggerMode.MANUAL)])
        result = mgr.manual_activate("i1", 200.0)
        assert result is not None
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.ACTIVE

    def test_manual_activate_already_active_returns_none(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 100.0)
        assert mgr.manual_activate("i1", 200.0) is None


class TestMitigateResolve:
    def test_mitigate_active_defect(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 0.0)
        result = mgr.mitigate("i1")
        assert result is not None
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.MITIGATED

    def test_resolve_from_active(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 0.0)
        result = mgr.resolve("i1", 300.0)
        assert result is not None
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.RESOLVED
        assert mgr.defects["i1"].resolved_at_pt_ms == 300.0

    def test_resolve_from_mitigated(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 0.0)
        mgr.mitigate("i1")
        result = mgr.resolve("i1", 400.0)
        assert result is not None
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.RESOLVED


class TestAutoResolveCountdown:
    def test_auto_resolve_expires(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_time_pt_ms=0.0, auto_resolve_ms=1000.0)])
        mgr.tick(0.0, set())  # activates
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.ACTIVE
        changes = mgr.tick(1000.0, set())
        assert mgr.defects["i1"].lifecycle == DefectLifecycle.RESOLVED
        assert any(c["action"] == "auto_resolve_expired" for c in changes)


class TestReleaseToPlayers:
    def test_release_active_defect(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 0.0)
        result = mgr.release_to_players("i1")
        assert result is not None
        assert mgr.defects["i1"].released_to_players is True

    def test_release_inactive_returns_none(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_mode=TriggerMode.MANUAL)])
        assert mgr.release_to_players("i1") is None


class TestInactiveGuards:
    def test_mitigate_inactive_returns_none(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_mode=TriggerMode.MANUAL)])
        assert mgr.mitigate("i1") is None

    def test_resolve_inactive_returns_none(self) -> None:
        mgr = DefectManager()
        mgr.load_defects([_defect("i1", trigger_mode=TriggerMode.MANUAL)])
        assert mgr.resolve("i1", 0.0) is None
