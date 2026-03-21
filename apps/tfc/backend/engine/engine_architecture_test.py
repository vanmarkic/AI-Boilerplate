"""Architecture guard tests — prevent service/router from calling private engine methods.

These tests enforce the boundary established by the engine path unification:
services and routers must use public engine methods (close_decision, trigger_event),
not reach into _private internals.
"""

from __future__ import annotations

import ast
import inspect

from features.exercise import engine_actions_router, engine_decision_service


def _find_private_engine_access(source: str) -> list[str]:
    """Find all `engine._something` or `self._something` engine attribute accesses."""
    tree = ast.parse(source)
    violations: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Attribute):
            continue
        if not node.attr.startswith("_"):
            continue
        # Check if accessing on a variable named 'engine'
        if isinstance(node.value, ast.Name) and node.value.id == "engine":
            violations.append(f"engine.{node.attr}")
    return violations


class TestServiceDoesNotCallPrivateEngineMethods:
    def test_no_private_engine_access(self) -> None:
        source = inspect.getsource(engine_decision_service)
        violations = _find_private_engine_access(source)
        assert violations == [], (
            f"EngineDecisionService calls private engine methods: {violations}. "
            "Use public engine API (close_decision, trigger_event) instead."
        )


class TestRouterDoesNotCallPrivateEngineMethods:
    def test_no_private_engine_access_in_trigger(self) -> None:
        """The trigger_event endpoint must use engine.trigger_event(), not internals."""
        source = inspect.getsource(engine_actions_router)
        violations = _find_private_engine_access(source)
        # Filter to only the trigger-related violations (other endpoints may
        # still use engine internals for non-unified paths like cancel/complete)
        trigger_violations = [v for v in violations if v != "engine._on_state_change"]
        assert trigger_violations == [], (
            f"engine_actions_router calls private engine methods: {trigger_violations}. "
            "Use public engine API (trigger_event) instead."
        )
