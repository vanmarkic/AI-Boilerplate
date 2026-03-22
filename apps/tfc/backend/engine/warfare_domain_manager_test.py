"""Tests for WarfareDomainManager threat-level state management."""

from engine.warfare_domain_manager import WarfareDomainManager, WarfareDomainState


def _domain(
    domain_id: str = "aaw",
    label: str = "",
    threat_level: str = "green",
) -> WarfareDomainState:
    return WarfareDomainState(
        domain_id=domain_id,
        label=label or domain_id.upper(),
        threat_level=threat_level,
    )


class TestLoadDomains:
    def test_load_replaces_existing(self) -> None:
        mgr = WarfareDomainManager()
        mgr.load_domains([_domain("aaw"), _domain("asuw")])
        assert len(mgr.domains) == 2
        mgr.load_domains([_domain("cyber")])
        assert len(mgr.domains) == 1
        assert "cyber" in mgr.domains


class TestSetThreatLevel:
    def test_set_threat_level(self) -> None:
        mgr = WarfareDomainManager()
        mgr.load_domains([_domain("aaw")])
        change = mgr.set_threat_level("aaw", "yellow")
        assert change is not None
        assert change["type"] == "warfare_domain_change"
        assert change["domain_id"] == "aaw"
        assert change["threat_level"] == "yellow"

    def test_no_change_if_same_level(self) -> None:
        mgr = WarfareDomainManager()
        mgr.load_domains([_domain("aaw", threat_level="green")])
        assert mgr.set_threat_level("aaw", "green") is None

    def test_unknown_domain_returns_none(self) -> None:
        mgr = WarfareDomainManager()
        mgr.load_domains([])
        assert mgr.set_threat_level("nope", "red") is None

    def test_invalid_level_returns_none(self) -> None:
        mgr = WarfareDomainManager()
        mgr.load_domains([_domain("aaw")])
        assert mgr.set_threat_level("aaw", "purple") is None


class TestSnapshot:
    def test_snapshot_returns_all_domains(self) -> None:
        mgr = WarfareDomainManager()
        mgr.load_domains([_domain("aaw"), _domain("asuw", threat_level="red")])
        snap = mgr.snapshot()
        assert len(snap) == 2
        aaw = next(s for s in snap if s["domain_id"] == "aaw")
        assert aaw["threat_level"] == "green"

    def test_empty_snapshot(self) -> None:
        mgr = WarfareDomainManager()
        mgr.load_domains([])
        assert mgr.snapshot() == []
