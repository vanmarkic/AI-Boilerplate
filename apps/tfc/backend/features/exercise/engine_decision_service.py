"""Application service for engine decision orchestration.

Thin shell: validates HTTP request shape, delegates to engine.close_decision(),
and broadcasts the returned state changes.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from core.exceptions import BadRequestError, NotFoundError
from engine.exercise_engine import ExerciseEngine
from engine.state_changes import DecisionClosed, StateChange


class EngineDecisionService:
    """Orchestrates decision closing via the engine's canonical close path."""

    async def close_decision(
        self,
        engine: ExerciseEngine,
        decision_id: str,
        selected_option_ids: list[str],
        broadcast: Callable[[list[StateChange]], Awaitable[None]],
        target_system_selections: dict[str, str] | None = None,
    ) -> DecisionClosed:
        """Validate request shape, delegate to engine, broadcast changes."""
        # Pre-validate for nicer HTTP errors (engine also enforces)
        decision = engine.decision_manager.get_decision(decision_id)
        if decision is None or decision.status != "open":
            raise NotFoundError(
                f"Decision {decision_id} not found or already closed",
            )
        template = engine.find_decision_template(decision_id)
        if template and template.max_selections is not None:
            if len(selected_option_ids) > template.max_selections:
                raise BadRequestError(
                    f"Decision {decision_id} allows at most "
                    f"{template.max_selections} selections, "
                    f"got {len(selected_option_ids)}",
                )

        try:
            changes = await engine.close_decision(
                decision_id, selected_option_ids, target_system_selections
            )
        except ValueError as exc:
            msg = str(exc)
            if "not found" in msg or "already closed" in msg:
                raise NotFoundError(msg) from exc
            raise BadRequestError(msg) from exc

        await broadcast(changes)

        # Return the DecisionClosed change (first in the list)
        return changes[0]  # type: ignore[return-value]
