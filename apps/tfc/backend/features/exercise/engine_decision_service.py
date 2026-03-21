"""Application service for engine decision orchestration.

Encapsulates the close-decision workflow:
  close → score → advance to next turn → broadcast.

The backend owns sequencing. After closing a decision, the service
delegates to engine.force_trigger_next_decision() which force-triggers
the next event and opens the corresponding decision. The frontend is
purely reactive — it receives WS broadcasts and updates the UI.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from core.exceptions import BadRequestError, NotFoundError
from engine.exercise_engine import ExerciseEngine
from engine.state_changes import DecisionClosed, StateChange


class EngineDecisionService:
    """Orchestrates decision closing, scoring, and turn advancement."""

    async def close_decision(
        self,
        engine: ExerciseEngine,
        decision_id: str,
        selected_option_ids: list[str],
        broadcast: Callable[[list[StateChange]], Awaitable[None]],
    ) -> DecisionClosed:
        """Close a decision and handle all side effects.

        Flow: close → score → system effects → advance to next turn → broadcast.
        """
        pt = engine.time_manager.play_time_ms

        decision = engine.decision_manager.get_decision(decision_id)
        if decision is None or decision.status != "open":
            raise NotFoundError(
                f"Decision {decision_id} not found or already closed",
            )
        all_options = decision.options

        # Validate max_selections before mutating state
        template = engine.find_decision_template(decision_id)
        if template and template.max_selections is not None:
            if len(selected_option_ids) > template.max_selections:
                raise BadRequestError(
                    f"Decision {decision_id} allows at most "
                    f"{template.max_selections} selections, "
                    f"got {len(selected_option_ids)}",
                )

        result = engine.decision_manager.close_decision(
            decision_id,
            current_pt_ms=pt,
            selected_option_ids=selected_option_ids,
        )
        if result is None:
            raise NotFoundError(
                f"Decision {decision_id} not found or already closed",
            )

        # Score via game mode strategy
        selected_options = [o for o in all_options if o["id"] in selected_option_ids]
        forced_ids = template.forced_option_ids if template else []

        score_changes = engine.game_mode.on_decision_closed_v2(
            decision_id,
            selected_options,
            all_options,
            forced_option_ids=forced_ids or None,
            turn_stress_delta=template.stress_delta if template else 0,
        )

        # Apply system effects from selected options
        sys_changes = engine._apply_system_effects(selected_options)

        if score_changes or sys_changes:
            await broadcast(score_changes + sys_changes)

        # Advance to next turn: force-trigger next event in sequence
        advance_changes = engine.force_trigger_next_decision(pt)
        if advance_changes:
            await broadcast(advance_changes)

        # Auto-resume if GM mode and no more open decisions
        if engine.game_mode.requires_gm():
            if not engine.decision_manager.get_open_decisions():
                await engine.resume()

        return result
