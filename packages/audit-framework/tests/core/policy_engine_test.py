"""Tests for policy matching and the audit/broadcast policy engines."""

from __future__ import annotations

import pytest

from audit_framework.core.models import AuditEvent, AuditPolicy, BroadcastPolicy
from audit_framework.core.policy_engine import (
    AuditPolicyEngine,
    BroadcastPolicyEngine,
    PolicyMatcher,
)


def _event(action: str = "UPDATE", resource_type: str = "contract", **meta) -> AuditEvent:
    return AuditEvent(
        actor_id="u1",
        action=action,
        resource_type=resource_type,
        resource_id="c1",
        timestamp="t",
        request_id="r",
        metadata=meta,
    )


def test_empty_match_matches_everything() -> None:
    assert PolicyMatcher.matches({}, _event()) is True


def test_scalar_and_list_constraints() -> None:
    assert PolicyMatcher.matches({"action": "UPDATE"}, _event()) is True
    assert PolicyMatcher.matches({"action": ["CREATE", "UPDATE"]}, _event()) is True
    assert PolicyMatcher.matches({"action": ["DELETE"]}, _event()) is False


def test_match_against_metadata_bag() -> None:
    assert PolicyMatcher.matches({"tier": "gold"}, _event(tier="gold")) is True
    assert PolicyMatcher.matches({"tier": "gold"}, _event(tier="silver")) is False


def test_unknown_field_never_matches() -> None:
    assert PolicyMatcher.matches({"nonexistent": "x"}, _event()) is False


def test_audit_engine_picks_highest_priority() -> None:
    low = AuditPolicy(name="low", match={"action": ["UPDATE"]}, priority=1)
    high = AuditPolicy(name="high", match={"action": ["UPDATE"]}, priority=5)
    engine = AuditPolicyEngine()
    assert engine.evaluate([low, high], _event()) is high


def test_audit_engine_ignores_disabled_and_nonmatching() -> None:
    disabled = AuditPolicy(name="d", match={}, enabled=False, priority=9)
    other = AuditPolicy(name="o", match={"action": ["DELETE"]})
    match = AuditPolicy(name="m", match={"action": ["UPDATE"]})
    engine = AuditPolicyEngine()
    assert engine.evaluate([disabled, other, match], _event()) is match


def test_audit_engine_returns_none_when_nothing_matches() -> None:
    engine = AuditPolicyEngine()
    assert engine.evaluate([AuditPolicy(name="x", match={"action": ["LOGIN"]})], _event()) is None


def test_broadcast_engine_returns_all_matching_sorted_by_priority() -> None:
    a = BroadcastPolicy(name="a", match={}, priority=1)
    b = BroadcastPolicy(name="b", match={"action": ["UPDATE"]}, priority=10)
    c = BroadcastPolicy(name="c", match={"action": ["DELETE"]})
    engine = BroadcastPolicyEngine()
    result = engine.evaluate([a, b, c], _event())
    assert [p.name for p in result] == ["b", "a"]


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
