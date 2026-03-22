"""Tests for max_plays enforcement in ExerciseEngine.

Verifies that option play counts are tracked and exhausted options
are excluded from timeout auto-selection.
"""

from __future__ import annotations

import pytest

from engine.engine_config import DecisionTemplate, EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import ExerciseEngine
from engine.state_changes import DecisionOptionSnapshot


def _option(
    id: str,
    *,
    score: float = 0.0,
    stress_delta: int = 0,
    max_plays: int = 1,
) -> DecisionOptionSnapshot:
    return DecisionOptionSnapshot(
        id=id,
        label=f"Option {id}",
        score=score,
        stress_delta=stress_delta,
        system_effects=[],
        targets_system=False,
        max_plays=max_plays,
        role=None,
    )


def _config(
    decision_templates: list[DecisionTemplate] | None = None,
    events: list[ScheduledEvent] | None = None,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test",
        events=events or [],
        decision_templates=decision_templates or [],
        context=ScenarioContext(),
    )


class TestMaxPlaysTracking:
    """Play count tracking on ExerciseEngine."""

    def test_initial_play_counts_empty(self) -> None:
        engine = ExerciseEngine(_config())
        assert engine.option_play_counts == {}

    def test_record_plays_increments_count(self) -> None:
        engine = ExerciseEngine(_config())
        opts = [_option("a"), _option("b")]
        engine.record_option_plays(opts)
        assert engine.option_play_counts["a"] == 1
        assert engine.option_play_counts["b"] == 1

    def test_record_plays_accumulates(self) -> None:
        engine = ExerciseEngine(_config())
        engine.record_option_plays([_option("a")])
        engine.record_option_plays([_option("a")])
        assert engine.option_play_counts["a"] == 2

    def test_is_option_exhausted(self) -> None:
        engine = ExerciseEngine(_config())
        opt = _option("a", max_plays=2)
        engine.record_option_plays([opt])
        assert not engine.is_option_exhausted(opt)
        engine.record_option_plays([opt])
        assert engine.is_option_exhausted(opt)

    def test_zero_max_plays_means_unlimited(self) -> None:
        """max_plays=0 means unlimited plays."""
        engine = ExerciseEngine(_config())
        opt = _option("a", max_plays=0)
        for _ in range(100):
            engine.record_option_plays([opt])
        assert not engine.is_option_exhausted(opt)

    @pytest.mark.asyncio
    async def test_reset_clears_play_counts(self) -> None:
        engine = ExerciseEngine(_config())
        engine.record_option_plays([_option("a")])
        assert engine.option_play_counts["a"] == 1
        await engine.reset()
        assert engine.option_play_counts == {}


class TestMaxPlaysTimeoutFiltering:
    """Exhausted options are excluded from timeout auto-selection."""

    @pytest.mark.asyncio
    async def test_timeout_skips_exhausted_worst_option(self) -> None:
        """When the worst option is exhausted, timeout picks the next worst."""
        from unittest.mock import AsyncMock, patch

        from engine.game_modes.simple_collaborative import SimpleCollaborativeMode

        opts = [
            _option("worst", score=-10.0, max_plays=1),
            _option("mid", score=0.0, max_plays=1),
            _option("best", score=10.0, max_plays=1),
        ]
        evt = ScheduledEvent(
            id="d1",
            title="T",
            description="",
            event_type=EventType.DECISION,
            scheduled_pt_ms=0.0,
        )
        dt = DecisionTemplate(
            id="d1",
            title="T",
            description="D",
            issue_id="i1",
            question_type="single_choice",
            options=opts,
            completion_mode="first_response",
            timeout_ms=100.0,
        )
        mode = SimpleCollaborativeMode(decision_sequence=["d1"])
        callback = AsyncMock()
        engine = ExerciseEngine(
            EngineConfig(
                exercise_id=1,
                title="Test",
                events=[evt],
                decision_templates=[dt],
                game_mode=mode,
            ),
            on_state_change=callback,
        )

        # Exhaust the worst option
        engine.record_option_plays([opts[0]])

        # Open the decision
        with patch("engine.time_manager._now_ms", return_value=0.0):
            engine._time.start()
            engine._time._paused = False
            await engine.tick()  # pending
            await engine.tick()  # started -> decision opens

        assert len(engine.decision_manager.get_open_decisions()) == 1

        # Force timeout
        async def _instant_sleep(_: float) -> None:
            pass

        with (
            patch("asyncio.sleep", side_effect=_instant_sleep),
            patch("time.monotonic", return_value=1.0),
        ):
            d = engine.decision_manager.get_open_decisions()[0]
            d.opened_at_rt_ms = 0.0
            await engine._timeout_loop()

        # The "mid" option should have been auto-selected (next worst), not "worst"
        all_changes: list[dict] = []  # type: ignore[type-arg]
        for call in callback.call_args_list:
            all_changes.extend(call[0][0])
        close_changes = [c for c in all_changes if c.get("type") == "decision_closed"]
        assert len(close_changes) == 1
        assert close_changes[0]["selected_option_ids"] == ["mid"]
