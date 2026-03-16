"""Tests for IssueManager lifecycle and triggers."""
import pytest

from engine.issue_manager import (
    IssueLifecycle,
    IssueManager,
    TrackedIssue,
    TriggerMode,
)


def _issue(
    id: str = "i1",
    trigger_mode: TriggerMode = TriggerMode.TIME_BASED,
    trigger_time_pt_ms: float | None = None,
    trigger_event_id: str | None = None,
    etbol_ms: float = 0.0,
) -> TrackedIssue:
    return TrackedIssue(
        id=id,
        title=f"Issue {id}",
        description="test",
        trigger_mode=trigger_mode,
        trigger_time_pt_ms=trigger_time_pt_ms,
        trigger_event_id=trigger_event_id,
        etbol_ms=etbol_ms,
    )


class TestTimeBasedActivation:
    def test_activates_at_trigger_time(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=500.0)])
        changes = mgr.tick(500.0, set())
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.ACTIVE
        assert any(c["action"] == "activated" for c in changes)

    def test_not_activated_before_time(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=500.0)])
        mgr.tick(499.0, set())
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.INACTIVE


class TestEventBasedActivation:
    def test_activate_by_event(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([
            _issue(
                "i1",
                trigger_mode=TriggerMode.EVENT_BASED,
                trigger_event_id="evt1",
            ),
        ])
        changes = mgr.activate_by_event("evt1", 100.0)
        assert len(changes) == 1
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.ACTIVE
        assert mgr.issues["i1"].activated_at_pt_ms == 100.0

    def test_activate_by_event_wrong_id_no_change(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([
            _issue("i1", trigger_mode=TriggerMode.EVENT_BASED, trigger_event_id="evt1"),
        ])
        changes = mgr.activate_by_event("evt_other", 100.0)
        assert len(changes) == 0
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.INACTIVE


class TestManualActivation:
    def test_manual_activate(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        result = mgr.manual_activate("i1", 200.0)
        assert result is not None
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.ACTIVE

    def test_manual_activate_already_active_returns_none(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 100.0)
        assert mgr.manual_activate("i1", 200.0) is None


class TestMitigateResolve:
    def test_mitigate_active_issue(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 0.0)
        result = mgr.mitigate("i1")
        assert result is not None
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.MITIGATED

    def test_resolve_from_active(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 0.0)
        result = mgr.resolve("i1", 300.0)
        assert result is not None
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.RESOLVED
        assert mgr.issues["i1"].resolved_at_pt_ms == 300.0

    def test_resolve_from_mitigated(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 0.0)
        mgr.mitigate("i1")
        result = mgr.resolve("i1", 400.0)
        assert result is not None
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.RESOLVED


class TestETBOLCountdown:
    def test_etbol_auto_resolves(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=0.0, etbol_ms=1000.0)])
        mgr.tick(0.0, set())  # activates
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.ACTIVE
        changes = mgr.tick(1000.0, set())
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.RESOLVED
        assert any(c["action"] == "etbol_expired" for c in changes)


class TestReleaseToPlayers:
    def test_release_active_issue(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 0.0)
        result = mgr.release_to_players("i1")
        assert result is not None
        assert mgr.issues["i1"].released_to_players is True

    def test_release_inactive_returns_none(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        assert mgr.release_to_players("i1") is None


class TestInactiveGuards:
    def test_mitigate_inactive_returns_none(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        assert mgr.mitigate("i1") is None

    def test_resolve_inactive_returns_none(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        assert mgr.resolve("i1", 0.0) is None
