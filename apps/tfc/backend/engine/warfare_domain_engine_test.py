"""Tests for warfare domain integration in ExerciseEngine.

Verifies that:
- Snapshot includes warfare domains
- Event domain effects are applied on tick (event starts -> domain changes)
- trigger_event applies domain effects
"""

from __future__ import annotations

import pytest

from engine.engine_config import EngineConfig, ScenarioContext
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import ExerciseEngine
from engine.state_changes import DomainEffect
from engine.warfare_domain_manager import WarfareDomainState


def _config(
    events: list[ScheduledEvent] | None = None,
    initial_warfare_domains: list[WarfareDomainState] | None = None,
) -> EngineConfig:
    return EngineConfig(
        exercise_id=1,
        title="Test",
        events=events or [],
        context=ScenarioContext(),
        initial_warfare_domains=initial_warfare_domains or [],
    )


class TestSnapshotIncludesWarfareDomains:
    """Engine snapshot includes warfare_domains field."""

    def test_snapshot_with_domains(self) -> None:
        domains = [
            WarfareDomainState(domain_id="aaw", label="AAW", threat_level="green"),
            WarfareDomainState(domain_id="asuw", label="ASUW", threat_level="yellow"),
        ]
        engine = ExerciseEngine(_config(initial_warfare_domains=domains))
        snap = engine.snapshot()

        assert "warfare_domains" in snap
        assert len(snap["warfare_domains"]) == 2
        aaw = next(d for d in snap["warfare_domains"] if d["domain_id"] == "aaw")
        assert aaw["threat_level"] == "green"
        assert aaw["label"] == "AAW"
        asuw = next(d for d in snap["warfare_domains"] if d["domain_id"] == "asuw")
        assert asuw["threat_level"] == "yellow"

    def test_snapshot_empty_domains(self) -> None:
        engine = ExerciseEngine(_config())
        snap = engine.snapshot()
        assert snap["warfare_domains"] == []


class TestTickDomainEffects:
    """Event domain_effects are applied when an event starts via tick."""

    @pytest.mark.asyncio
    async def test_event_domain_effects_applied_on_start(self) -> None:
        from unittest.mock import AsyncMock, patch

        domains = [
            WarfareDomainState(domain_id="aaw", label="AAW", threat_level="green"),
        ]
        evt = ScheduledEvent(
            id="evt-1",
            title="AAW Threat",
            description="Incoming air threat",
            event_type=EventType.INFORMATIONAL,
            scheduled_pt_ms=0.0,
            domain_effects=[
                DomainEffect(domain_id="aaw", threat_level="red"),
            ],
        )
        callback = AsyncMock()
        engine = ExerciseEngine(
            _config(events=[evt], initial_warfare_domains=domains),
            on_state_change=callback,
        )
        with patch("engine.time_manager._now_ms", return_value=0.0):
            engine._time.start()
            engine._time._paused = False
            await engine.tick()  # scheduled -> pending
            await engine.tick()  # pending -> running (domain effects apply)

        assert engine.warfare_domain_manager.domains["aaw"].threat_level == "red"

        # Verify callback received warfare_domain_change
        all_changes: list[dict] = []  # type: ignore[type-arg]
        for call in callback.call_args_list:
            all_changes.extend(call[0][0])
        domain_changes = [c for c in all_changes if c.get("type") == "warfare_domain_change"]
        assert len(domain_changes) == 1
        assert domain_changes[0]["domain_id"] == "aaw"
        assert domain_changes[0]["threat_level"] == "red"

    @pytest.mark.asyncio
    async def test_event_without_domain_effects_no_change(self) -> None:
        from unittest.mock import AsyncMock, patch

        domains = [
            WarfareDomainState(domain_id="aaw", label="AAW", threat_level="green"),
        ]
        evt = ScheduledEvent(
            id="evt-2",
            title="No Effects",
            description="",
            event_type=EventType.INFORMATIONAL,
            scheduled_pt_ms=0.0,
        )
        callback = AsyncMock()
        engine = ExerciseEngine(
            _config(events=[evt], initial_warfare_domains=domains),
            on_state_change=callback,
        )
        with patch("engine.time_manager._now_ms", return_value=0.0):
            engine._time.start()
            engine._time._paused = False
            await engine.tick()
            await engine.tick()

        assert engine.warfare_domain_manager.domains["aaw"].threat_level == "green"


class TestTriggerEventDomainEffects:
    """trigger_event applies domain effects."""

    @pytest.mark.asyncio
    async def test_trigger_event_applies_domain_effects(self) -> None:
        domains = [
            WarfareDomainState(domain_id="asuw", label="ASUW", threat_level="green"),
        ]
        evt = ScheduledEvent(
            id="e1",
            title="Surface Threat",
            description="",
            event_type=EventType.INFORMATIONAL,
            scheduled_pt_ms=999_999,
            domain_effects=[
                DomainEffect(domain_id="asuw", threat_level="yellow"),
            ],
        )
        engine = ExerciseEngine(_config(events=[evt], initial_warfare_domains=domains))
        await engine.start()
        await engine.begin()

        changes = engine.trigger_event("e1")

        assert engine.warfare_domain_manager.domains["asuw"].threat_level == "yellow"
        domain_changes = [c for c in changes if c.get("type") == "warfare_domain_change"]
        assert len(domain_changes) == 1
        assert domain_changes[0]["domain_id"] == "asuw"
        assert domain_changes[0]["threat_level"] == "yellow"

    @pytest.mark.asyncio
    async def test_trigger_event_no_domain_effects(self) -> None:
        domains = [
            WarfareDomainState(domain_id="aaw", label="AAW", threat_level="green"),
        ]
        evt = ScheduledEvent(
            id="e2",
            title="Info Event",
            description="",
            event_type=EventType.INFORMATIONAL,
            scheduled_pt_ms=999_999,
        )
        engine = ExerciseEngine(_config(events=[evt], initial_warfare_domains=domains))
        await engine.start()
        await engine.begin()

        changes = engine.trigger_event("e2")

        assert engine.warfare_domain_manager.domains["aaw"].threat_level == "green"
        domain_changes = [c for c in changes if c.get("type") == "warfare_domain_change"]
        assert len(domain_changes) == 0


class TestApplyEventDomainEffectsUnit:
    """Unit tests for _apply_event_domain_effects method."""

    def test_applies_multiple_effects(self) -> None:
        domains = [
            WarfareDomainState(domain_id="aaw", label="AAW", threat_level="green"),
            WarfareDomainState(domain_id="asuw", label="ASUW", threat_level="green"),
        ]
        engine = ExerciseEngine(_config(initial_warfare_domains=domains))
        effects = [
            DomainEffect(domain_id="aaw", threat_level="yellow"),
            DomainEffect(domain_id="asuw", threat_level="red"),
        ]
        changes = engine._apply_event_domain_effects(effects)
        assert len(changes) == 2
        assert engine.warfare_domain_manager.domains["aaw"].threat_level == "yellow"
        assert engine.warfare_domain_manager.domains["asuw"].threat_level == "red"

    def test_empty_effects_returns_empty(self) -> None:
        engine = ExerciseEngine(_config())
        assert engine._apply_event_domain_effects([]) == []

    def test_no_change_if_same_level(self) -> None:
        domains = [
            WarfareDomainState(domain_id="aaw", label="AAW", threat_level="red"),
        ]
        engine = ExerciseEngine(_config(initial_warfare_domains=domains))
        effects = [DomainEffect(domain_id="aaw", threat_level="red")]
        changes = engine._apply_event_domain_effects(effects)
        assert len(changes) == 0

    def test_unknown_domain_ignored(self) -> None:
        engine = ExerciseEngine(_config())
        effects = [DomainEffect(domain_id="nonexistent", threat_level="red")]
        changes = engine._apply_event_domain_effects(effects)
        assert len(changes) == 0
