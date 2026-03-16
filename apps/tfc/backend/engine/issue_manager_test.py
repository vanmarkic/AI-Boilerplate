"""Unit tests for IssueManager lifecycle and triggers."""
import pytest

from engine.issue_manager import (
    IssueLifecycle,
    IssueManager,
    TrackedIssue,
    TriggerMode,
)


def _issue(
    iid: str = "i1",
    trigger_mode: TriggerMode = TriggerMode.TIME_BASED,
    trigger_time_pt_ms: float | None = None,
    trigger_event_id: str | None = None,
    etbol_ms: float = 0.0,
) -> TrackedIssue:
    return TrackedIssue(
        id=iid,
        title=f"Issue {iid}",
        description=f"Desc {iid}",
        trigger_mode=trigger_mode,
        trigger_time_pt_ms=trigger_time_pt_ms,
        trigger_event_id=trigger_event_id,
        etbol_ms=etbol_ms,
    )


class TestLoadIssues:
    def test_load_stores_issues(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1"), _issue("i2")])
        assert len(mgr.issues) == 2
        assert "i1" in mgr.issues


class TestTickTimeBased:
    def test_activates_when_pt_passes_trigger(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=100)])
        changes = mgr.tick(200, set())
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.ACTIVE
        assert any(c["issue_id"] == "i1" and c["action"] == "activated"
                    for c in changes)

    def test_no_activation_before_trigger(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=100)])
        mgr.tick(50, set())
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.INACTIVE


class TestTickEventBased:
    def test_activates_when_trigger_event_completed(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([
            _issue("i1", trigger_mode=TriggerMode.EVENT_BASED,
                   trigger_event_id="e1"),
        ])
        changes = mgr.tick(100, {"e1"})
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.ACTIVE

    def test_no_activation_without_event(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([
            _issue("i1", trigger_mode=TriggerMode.EVENT_BASED,
                   trigger_event_id="e1"),
        ])
        mgr.tick(100, set())
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.INACTIVE


class TestTickManual:
    def test_manual_issues_not_auto_activated(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.tick(99999, set())
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.INACTIVE


class TestTickEtbol:
    def test_resolves_after_etbol_expires(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([
            _issue("i1", trigger_time_pt_ms=0, etbol_ms=100),
        ])
        mgr.tick(0, set())  # activates
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.ACTIVE
        changes = mgr.tick(200, set())  # etbol expires
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.RESOLVED
        assert any(c["action"] == "etbol_expired" for c in changes)


class TestActivateByEvent:
    def test_activates_linked_issues(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([
            _issue("i1", trigger_mode=TriggerMode.EVENT_BASED,
                   trigger_event_id="e1"),
            _issue("i2", trigger_mode=TriggerMode.EVENT_BASED,
                   trigger_event_id="e2"),
        ])
        changes = mgr.activate_by_event("e1", 100)
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.ACTIVE
        assert mgr.issues["i2"].lifecycle == IssueLifecycle.INACTIVE
        assert len(changes) == 1


class TestManualActivate:
    def test_gm_activates_issue(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        result = mgr.manual_activate("i1", 50)
        assert result is not None
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.ACTIVE
        assert mgr.issues["i1"].activated_at_pt_ms == 50

    def test_manual_activate_already_active_returns_none(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_mode=TriggerMode.MANUAL)])
        mgr.manual_activate("i1", 50)
        assert mgr.manual_activate("i1", 100) is None


class TestMitigate:
    def test_active_to_mitigated(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=0)])
        mgr.tick(0, set())
        result = mgr.mitigate("i1")
        assert result is not None
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.MITIGATED

    def test_mitigate_inactive_returns_none(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=9999)])
        assert mgr.mitigate("i1") is None


class TestResolve:
    def test_active_to_resolved(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=0)])
        mgr.tick(0, set())
        result = mgr.resolve("i1", 100)
        assert result is not None
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.RESOLVED
        assert mgr.issues["i1"].resolved_at_pt_ms == 100

    def test_mitigated_to_resolved(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=0)])
        mgr.tick(0, set())
        mgr.mitigate("i1")
        result = mgr.resolve("i1", 200)
        assert result is not None
        assert mgr.issues["i1"].lifecycle == IssueLifecycle.RESOLVED

    def test_resolve_inactive_returns_none(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=9999)])
        assert mgr.resolve("i1", 0) is None


class TestReleaseToPlayers:
    def test_release_active_issue(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=0)])
        mgr.tick(0, set())
        result = mgr.release_to_players("i1")
        assert result is not None
        assert mgr.issues["i1"].released_to_players is True

    def test_release_inactive_returns_none(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=9999)])
        assert mgr.release_to_players("i1") is None


class TestSnapshot:
    def test_snapshot_serializable(self) -> None:
        mgr = IssueManager()
        mgr.load_issues([_issue("i1", trigger_time_pt_ms=100, etbol_ms=500)])
        snap = mgr.snapshot()
        assert len(snap) == 1
        assert snap[0]["id"] == "i1"
        assert snap[0]["lifecycle"] == "inactive"
        assert snap[0]["etbol_ms"] == 500
        assert "released" in snap[0]
