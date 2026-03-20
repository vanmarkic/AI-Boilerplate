"""Application service for engine decision orchestration.

Encapsulates the close-decision workflow: close → score → chain → resume.
Framework-agnostic — the caller provides a broadcast callback.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from core.exceptions import BadRequestError, NotFoundError
from engine.exercise_engine import ExerciseEngine
from engine.state_changes import DecisionClosed, StateChange


class EngineDecisionService:
    """Orchestrates decision closing, scoring, chaining, and auto-resume."""

    async def close_decision(
        self,
        engine: ExerciseEngine,
        decision_id: str,
        selected_option_ids: list[str],
        broadcast: Callable[[list[StateChange]], Awaitable[None]],
    ) -> DecisionClosed:
        """Close a decision and handle all side effects.

        Returns the ``DecisionClosed`` state change dict.
        Raises ``NotFoundError`` if the decision is missing or already closed.
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

        extra = engine.game_mode.on_decision_closed_v2(
            decision_id,
            selected_options,
            all_options,
            forced_option_ids=forced_ids or None,
        )

        # TODO(Phase3): Apply system effects from selected options via
        # engine._apply_system_effects(selected_options) and broadcast.
        # Currently only applied on timeout path (_timeout_loop).

        if extra:
            await broadcast(extra)

        # Chain to next decision in sequence
        next_id = engine.game_mode.get_next_decision_id(decision_id)
        if next_id:
            next_template = engine.find_decision_template(next_id)
            if next_template:
                timeout_ms = engine.game_mode.get_decision_time_ms(
                    int(next_template.timeout_ms),
                )
                opened = engine.decision_manager.open_decision(
                    id=next_template.id,
                    event_id=None,
                    issue_id=next_template.issue_id,
                    title=next_template.title,
                    description=next_template.description,
                    question_type=next_template.question_type,
                    options=next_template.options,
                    completion_mode=next_template.completion_mode,
                    target_roles=next_template.target_roles,
                    timeout_ms=timeout_ms,
                    max_selections=next_template.max_selections,
                    current_pt_ms=pt,
                )
                await broadcast([opened])

        # Auto-resume if GM mode and no more open decisions
        if engine.game_mode.requires_gm():
            if not engine.decision_manager.get_open_decisions():
                await engine.resume()

        return result
