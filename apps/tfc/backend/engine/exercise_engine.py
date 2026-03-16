"""Exercise engine — orchestrates TimeManager, EventScheduler, IssueManager.

Runs a tick loop (250ms) when the exercise is running.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Callable, Awaitable

from engine.state_changes import PhaseChange, StateChange

from engine.time_manager import TimeManager
from engine.event_scheduler import EventScheduler, ScheduledEvent, EventLifecycle, EventType
from engine.issue_manager import IssueManager, TrackedIssue
from engine.decision_manager import DecisionManager

TICK_INTERVAL_S = 0.25


class EnginePhase(StrEnum):
    SETUP = "setup"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"


@dataclass
class DecisionTemplate:
    id: str
    title: str
    description: str
    issue_id: str
    question_type: str
    options: list[dict]
    completion_mode: str
    target_roles: list[str] = field(default_factory=list)


@dataclass
class ScenarioContext:
    title: str = ""
    description: str = ""
    briefing: str = ""
    objectives: list[str] = field(default_factory=list)
    rules: list[str] = field(default_factory=list)


@dataclass
class EngineConfig:
    exercise_id: int
    title: str
    time_factor: float = 1.0
    events: list[ScheduledEvent] = field(default_factory=list)
    issues: list[TrackedIssue] = field(default_factory=list)
    decision_templates: list[DecisionTemplate] = field(default_factory=list)
    context: ScenarioContext = field(default_factory=ScenarioContext)


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
        self._decisions = DecisionManager()
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

    @property
    def decision_manager(self) -> DecisionManager:
        return self._decisions

    async def start(self) -> dict:
        if self._phase not in {EnginePhase.SETUP, EnginePhase.PAUSED}:
            return {"error": f"Cannot start from {self._phase}"}
        self._phase = EnginePhase.RUNNING
        self._time.start()
        self._start_tick_loop()
        return self._phase_change("started")

    async def pause(self) -> dict:
        if self._phase != EnginePhase.RUNNING:
            return {"error": f"Cannot pause from {self._phase}"}
        self._phase = EnginePhase.PAUSED
        self._time.pause()
        self._stop_tick_loop()
        return self._phase_change("paused")

    async def resume(self) -> dict:
        return await self.start()

    async def complete(self) -> dict:
        if self._phase in {EnginePhase.COMPLETED, EnginePhase.SETUP}:
            return {"error": f"Cannot complete from {self._phase}"}
        self._phase = EnginePhase.COMPLETED
        self._time.pause()
        self._stop_tick_loop()
        return self._phase_change("completed")

    async def reset(self) -> dict:
        self._stop_tick_loop()
        self._phase = EnginePhase.SETUP
        self._time.reset()
        self._events.load_events(self._config.events)
        self._issues.load_issues(self._config.issues)
        self._decisions.clear()
        return self._phase_change("reset")

    def set_speed(self, factor: float) -> StateChange:
        self._time.factor = factor
        return {"type": "speed_change", "factor": factor}

    async def tick(self) -> list[StateChange]:
        """Advance time, check triggers, return state changes."""
        changes: list[dict] = []

        # 1. Advance play time
        self._time.tick()
        pt = self._time.play_time_ms

        # 2. Check event triggers and transitions
        event_changes = self._events.tick(pt)
        changes.extend(event_changes)

        # 2b. Check for DECISION events that just started
        decision_changes = self._handle_decision_events(event_changes, pt)
        changes.extend(decision_changes)

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

        # 5. Check issue triggers and auto-resolve countdowns
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
            "decisions": self._decisions.snapshot(),
        }

    def _handle_decision_events(
        self, event_changes: list[dict], pt: float,
    ) -> list[dict]:
        changes: list[dict] = []
        for change in event_changes:
            if change.get("action") != "started":
                continue
            event_id = change["event_id"]
            event = self._events.events.get(event_id)
            if event is None or event.event_type != EventType.DECISION:
                continue
            t = self._find_decision_template(event_id)
            changes.append(self._decisions.open_decision(
                id=t.id if t else event_id,
                event_id=event_id,
                issue_id=t.issue_id if t else None,
                title=t.title if t else event.title,
                description=t.description if t else event.description,
                question_type=t.question_type if t else "free_text",
                options=t.options if t else [],
                completion_mode=t.completion_mode if t else "first_response",
                target_roles=t.target_roles if t else [],
                current_pt_ms=pt,
            ))
            self._phase = EnginePhase.PAUSED
            self._time.pause()
            self._stop_tick_loop()
        return changes

    def _find_decision_template(self, event_id: str) -> DecisionTemplate | None:
        for dt in self._config.decision_templates:
            if dt.id == event_id:
                return dt
        return None

    def _start_tick_loop(self) -> None:
        if self._tick_task is None or self._tick_task.done():
            self._tick_task = asyncio.create_task(self._tick_loop())

    def _stop_tick_loop(self) -> None:
        if self._tick_task and not self._tick_task.done():
            self._tick_task.cancel()
            self._tick_task = None

    async def _tick_loop(self) -> None:
        try:
            while True:
                await self.tick()
                await asyncio.sleep(TICK_INTERVAL_S)
        except asyncio.CancelledError:
            pass

    def _phase_change(self, action: str) -> PhaseChange:
        return {
            "type": "phase_change",
            "action": action,
            "phase": self._phase.value,
            "time": self._time.snapshot(),
        }
