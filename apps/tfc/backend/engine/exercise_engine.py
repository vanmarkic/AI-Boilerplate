"""Exercise engine — the single source of truth for exercise state.

Orchestrates TimeManager, EventScheduler, and IssueManager.
Runs a tick loop (250ms) when the exercise is running.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Callable, Awaitable

from engine.time_manager import TimeManager
from engine.event_scheduler import EventScheduler, ScheduledEvent, EventLifecycle
from engine.issue_manager import IssueManager, TrackedIssue


TICK_INTERVAL_S = 0.25  # 250ms


class EnginePhase(StrEnum):
    SETUP = "setup"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"


@dataclass
class EngineConfig:
    """Configuration loaded from a scenario."""
    exercise_id: int
    title: str
    time_factor: float = 1.0
    events: list[ScheduledEvent] = field(default_factory=list)
    issues: list[TrackedIssue] = field(default_factory=list)


class ExerciseEngine:
    """Runtime engine for a single exercise session."""

    def __init__(
        self,
        config: EngineConfig,
        on_state_change: Callable[[list[dict]], Awaitable[None]] | None = None,
    ) -> None:
        self._config = config
        self._phase = EnginePhase.SETUP
        self._time = TimeManager(factor=config.time_factor)
        self._events = EventScheduler()
        self._issues = IssueManager()
        self._tick_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._on_state_change = on_state_change

        # Load scenario data
        self._events.load_events(config.events)
        self._issues.load_issues(config.issues)

    @property
    def phase(self) -> EnginePhase:
        return self._phase

    @property
    def time_manager(self) -> TimeManager:
        return self._time

    @property
    def event_scheduler(self) -> EventScheduler:
        return self._events

    @property
    def issue_manager(self) -> IssueManager:
        return self._issues

    async def start(self) -> dict:
        """Start the exercise. Transitions from SETUP or PAUSED to RUNNING."""
        if self._phase not in {EnginePhase.SETUP, EnginePhase.PAUSED}:
            return {"error": f"Cannot start from {self._phase}"}
        self._phase = EnginePhase.RUNNING
        self._time.start()
        self._start_tick_loop()
        return self._phase_change("started")

    async def pause(self) -> dict:
        """Pause the exercise."""
        if self._phase != EnginePhase.RUNNING:
            return {"error": f"Cannot pause from {self._phase}"}
        self._phase = EnginePhase.PAUSED
        self._time.pause()
        self._stop_tick_loop()
        return self._phase_change("paused")

    async def resume(self) -> dict:
        """Resume a paused exercise."""
        return await self.start()

    async def complete(self) -> dict:
        """Complete the exercise."""
        if self._phase in {EnginePhase.COMPLETED, EnginePhase.SETUP}:
            return {"error": f"Cannot complete from {self._phase}"}
        self._phase = EnginePhase.COMPLETED
        self._time.pause()
        self._stop_tick_loop()
        return self._phase_change("completed")

    async def reset(self) -> dict:
        """Reset the exercise to setup state."""
        self._stop_tick_loop()
        self._phase = EnginePhase.SETUP
        self._time.reset()
        self._events.load_events(self._config.events)
        self._issues.load_issues(self._config.issues)
        return self._phase_change("reset")

    def set_speed(self, factor: float) -> dict:
        """Change the time speed factor."""
        self._time.factor = factor
        return {
            "type": "speed_change",
            "factor": factor,
        }

    async def tick(self) -> list[dict]:
        """Execute a single tick — advance time and check all triggers.

        Returns list of state changes that occurred.
        """
        changes: list[dict] = []

        # 1. Advance play time
        self._time.tick()
        pt = self._time.play_time_ms

        # 2. Check event triggers and transitions
        event_changes = self._events.tick(pt)
        changes.extend(event_changes)

        # 3. Collect completed event IDs for issue triggers
        completed_events = {
            eid
            for eid, ev in self._events.events.items()
            if ev.lifecycle == EventLifecycle.COMPLETED
        }

        # 4. Check newly completed events for issue triggers
        for change in event_changes:
            if change.get("action") == "completed":
                event_id = change["event_id"]
                issue_changes = self._issues.activate_by_event(event_id, pt)
                changes.extend(issue_changes)

        # 5. Check issue triggers and ETBOL countdowns
        issue_changes = self._issues.tick(pt, completed_events)
        changes.extend(issue_changes)

        # 6. Broadcast changes
        if changes and self._on_state_change:
            await self._on_state_change(changes)

        return changes

    def snapshot(self) -> dict:
        """Full state snapshot for client sync."""
        return {
            "exercise_id": self._config.exercise_id,
            "title": self._config.title,
            "phase": self._phase.value,
            "time": self._time.snapshot(),
            "events": self._events.snapshot(),
            "issues": self._issues.snapshot(),
        }

    def _start_tick_loop(self) -> None:
        if self._tick_task is None or self._tick_task.done():
            self._tick_task = asyncio.create_task(self._tick_loop())

    def _stop_tick_loop(self) -> None:
        if self._tick_task and not self._tick_task.done():
            self._tick_task.cancel()
            self._tick_task = None

    async def _tick_loop(self) -> None:
        """Run tick() at TICK_INTERVAL_S until cancelled."""
        try:
            while True:
                await self.tick()
                await asyncio.sleep(TICK_INTERVAL_S)
        except asyncio.CancelledError:
            pass

    def _phase_change(self, action: str) -> dict:
        return {
            "type": "phase_change",
            "action": action,
            "phase": self._phase.value,
            "time": self._time.snapshot(),
        }
