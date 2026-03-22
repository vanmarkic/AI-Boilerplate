"""Property tests — full N-decision sequence pipeline through ExerciseEngine.

Verifies invariants across an entire decision chain:
- At most 1 open decision at any point
- Stress stays clamped to [0, 10]
- turn_number increments by exactly 1 per close
- Score accumulates correctly (selected + forced card scores)
- After close + advance, the next opened decision ID matches the sequence
- After the last close, 0 open decisions and get_next_decision_id returns None
"""

from __future__ import annotations

import asyncio

from hypothesis import given, settings
from hypothesis import strategies as st

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import ExerciseEngine
from engine.game_modes.simple_collaborative import SimpleCollaborativeMode
from engine.strategies import decision_sequences, option_lists, play_times


@st.composite
def decision_sequence_with_templates(
    draw: st.DrawFn,
) -> tuple[list[str], list[DecisionTemplate], list[ScheduledEvent]]:
    """Generate a self-consistent set of decision IDs, templates, and events."""
    seq = draw(decision_sequences(min_size=3, max_size=10))
    templates = []
    events = []
    for did in seq:
        opts = draw(option_lists(min_size=2, max_size=5))
        tmpl = DecisionTemplate(
            id=did,
            issue_id=f"iss-{did}",
            title=f"Decision {did}",
            description="generated",
            question_type="multi_choice",
            options=opts,
            completion_mode="first_response",
            target_roles=["co"],
            timeout_ms=0,  # no timeout so the monitor task won't auto-close
            max_selections=draw(st.integers(min_value=1, max_value=max(1, len(opts)))),
        )
        event = ScheduledEvent(
            id=did,
            title=f"Event {did}",
            description="generated",
            event_type=EventType.DECISION,
            scheduled_pt_ms=999_999,  # far future — tick loop never fires these
        )
        templates.append(tmpl)
        events.append(event)
    return seq, templates, events


class TestFullDecisionSequencePipeline:
    """Simulate a full N-decision sequence and assert invariants at each step."""

    @given(
        sequence_data=decision_sequence_with_templates(),
        pt=play_times(),
    )
    @settings(max_examples=200)
    def test_full_sequence_invariants(
        self,
        sequence_data: tuple[list[str], list[DecisionTemplate], list[ScheduledEvent]],
        pt: float,
    ) -> None:
        seq, templates, events = sequence_data

        mode = SimpleCollaborativeMode(
            decision_sequence=seq,
            base_decision_time_ms=300_000,
        )
        config = EngineConfig(
            exercise_id=1,
            title="Prop Test",
            events=events,
            decision_templates=templates,
            game_mode=mode,
            context=ScenarioContext(title="T"),
        )

        engine = ExerciseEngine(config)

        async def _run() -> None:
            # Start the engine (SETUP → BRIEFING)
            await engine.start()

            # Manually force-trigger the first decision (index 0) at pt
            # This advances current_index to 0 — get_next_decision_id returns seq[0]
            first_id = seq[0]
            first_event = engine.event_scheduler.events[first_id]
            first_event.lifecycle = "pending"  # type: ignore[assignment]
            engine.force_trigger_next_decision(pt)

            # The first decision must now be open
            open_decisions = engine.decision_manager.get_open_decisions()
            assert len(open_decisions) == 1, (
                f"Expected 1 open decision after first trigger, got {len(open_decisions)}"
            )
            assert open_decisions[0].id == first_id

            accumulated_score = 0.0
            initial_turn = mode.turn_number  # should be 1

            for step, decision_id in enumerate(seq):
                # --- Invariant: at most 1 open decision ---
                open_now = engine.decision_manager.get_open_decisions()
                assert len(open_now) <= 1, (
                    f"Step {step}: expected <=1 open decision, got {len(open_now)}"
                )
                assert len(open_now) == 1, (
                    f"Step {step}: expected exactly 1 open decision before close"
                )
                assert open_now[0].id == decision_id, (
                    f"Step {step}: open decision ID {open_now[0].id!r} != expected {decision_id!r}"
                )

                # --- Invariant: stress in [0, 10] before close ---
                assert 0 <= mode.stress <= 10, (
                    f"Step {step}: stress {mode.stress} out of range before close"
                )

                turn_before = mode.turn_number
                score_before = mode.total_score

                # Select options: pick a subset (1 to max_selections)
                active = open_now[0]
                max_sel = active.max_selections or len(active.options)
                max_sel = min(max_sel, len(active.options))
                n_select = 1 if max_sel <= 1 else max_sel  # pick max for determinism
                selected = active.options[:n_select]
                selected_ids = [o["id"] for o in selected]

                # Close the decision
                close_change = engine.decision_manager.close_decision(
                    decision_id,
                    current_pt_ms=pt,
                    selected_option_ids=selected_ids,
                )
                assert close_change is not None, (
                    f"Step {step}: close_decision returned None for {decision_id!r}"
                )

                # Retrieve forced option IDs from template
                template = engine.find_decision_template(decision_id)
                forced_ids = template.forced_option_ids if template else []

                # Compute expected score delta before calling on_decision_closed_v2
                forced_opts = [
                    o
                    for o in active.options
                    if o["id"] in forced_ids and o["id"] not in selected_ids
                ]
                effective_options = selected + forced_opts
                expected_score_delta = sum(o.get("score", 0) for o in effective_options)

                # Apply scoring via game mode
                score_changes = engine.game_mode.on_decision_closed_v2(
                    decision_id,
                    selected,
                    active.options,
                    forced_option_ids=forced_ids or None,
                    turn_stress_delta=template.stress_delta if template else 0,
                )
                assert len(score_changes) >= 1, (
                    f"Step {step}: on_decision_closed_v2 returned no changes"
                )

                # --- Invariant: turn_number incremented by 1 ---
                assert mode.turn_number == turn_before + 1, (
                    f"Step {step}: turn_number should be {turn_before + 1}, got {mode.turn_number}"
                )

                # --- Invariant: stress clamped to [0, 10] after close ---
                assert 0 <= mode.stress <= 10, (
                    f"Step {step}: stress {mode.stress} out of range after close"
                )

                # --- Invariant: score accumulated correctly ---
                accumulated_score += expected_score_delta
                assert abs(mode.total_score - (score_before + expected_score_delta)) < 1e-9, (
                    f"Step {step}: score mismatch — "
                    f"expected {score_before + expected_score_delta}, got {mode.total_score}"
                )

                # Verify no open decisions remain after close
                open_after_close = engine.decision_manager.get_open_decisions()
                assert len(open_after_close) == 0, (
                    f"Step {step}: expected 0 open decisions after close, "
                    f"got {len(open_after_close)}"
                )

                is_last = step == len(seq) - 1

                if not is_last:
                    # Advance to next decision
                    next_id = seq[step + 1]
                    advance_changes = engine.force_trigger_next_decision(pt)
                    assert len(advance_changes) >= 1, (
                        f"Step {step}: force_trigger_next_decision returned no changes"
                    )

                    # --- Invariant: newly opened decision matches expected sequence ID ---
                    new_open = engine.decision_manager.get_open_decisions()
                    assert len(new_open) == 1, (
                        f"Step {step}: expected 1 open decision after advance, got {len(new_open)}"
                    )
                    assert new_open[0].id == next_id, (
                        f"Step {step}: new open decision {new_open[0].id!r} != expected {next_id!r}"
                    )

            # --- Invariant: after last close, 0 open decisions ---
            final_open = engine.decision_manager.get_open_decisions()
            assert len(final_open) == 0, (
                f"After last close: expected 0 open decisions, got {len(final_open)}"
            )

            # --- Invariant: get_next_decision_id returns None (sequence exhausted) ---
            next_id_after_end = mode.get_next_decision_id("")
            assert next_id_after_end is None, (
                f"Expected None after sequence exhausted, got {next_id_after_end!r}"
            )

            # --- Invariant: total turn count matches sequence length ---
            assert mode.turn_number == initial_turn + len(seq), (
                f"Expected turn_number {initial_turn + len(seq)}, got {mode.turn_number}"
            )

            # --- Invariant: accumulated score matches mode total ---
            assert abs(mode.total_score - accumulated_score) < 1e-9, (
                f"Final score mismatch: expected {accumulated_score}, got {mode.total_score}"
            )

            # Clean up any background tasks
            engine._stop_timeout_monitor()

        asyncio.run(_run())
