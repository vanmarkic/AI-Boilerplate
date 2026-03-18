"""Exercise engine — orchestrates TimeManager, EventScheduler (injects), IssueManager (defects).

Domain terms: "inject" = event, "defect" = issue. See AGENTS.md terminology mapping.
"""
from __future__ import annotations

import asyncio
import time as _time_mod
from enum import StrEnum
from typing import Callable, Awaitable

from engine.state_changes import PhaseChange, StateChange
from engine.engine_config import (  # noqa: F401 — re-exported
    TICK_INTERVAL_S, DecisionTemplate, EngineConfig, ScenarioContext,
)
from engine.game_modes.classic import ClassicMode
from engine.time_manager import TimeManager
from engine.event_scheduler import EventScheduler, EventLifecycle, EventType
from engine.issue_manager import IssueManager
from engine.decision_manager import DecisionManager


class EnginePhase(StrEnum):
    SETUP = "setup"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"


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
        self._timeout_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._on_state_change = on_state_change

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

    @property
    def game_mode(self) -> ClassicMode:
        return self._config.game_mode

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
        self._stop_timeout_monitor()
        return self._phase_change("completed")

    async def reset(self) -> dict:
        self._stop_tick_loop()
        self._stop_timeout_monitor()
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
        self._time.tick()
        pt = self._time.play_time_ms

        event_changes = self._events.tick(pt)
        changes.extend(event_changes)

        decision_changes = self._handle_decision_events(event_changes, pt)
        changes.extend(decision_changes)

        completed_events = {
            eid for eid, ev in self._events.events.items()
            if ev.lifecycle == EventLifecycle.COMPLETED
        }

        for change in event_changes:
            if change.get("action") == "completed":
                event_id = change["event_id"]
                issue_changes = self._issues.activate_by_event(event_id, pt)
                changes.extend(issue_changes)

        issue_changes = self._issues.tick(pt, completed_events)
        changes.extend(issue_changes)

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
            timeout_ms = t.timeout_ms if t else 0.0
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
                timeout_ms=timeout_ms,
                current_pt_ms=pt,
            ))
            if self._config.game_mode.should_pause_on_decision():
                self._phase = EnginePhase.PAUSED
                self._time.pause()
                self._stop_tick_loop()
            if timeout_ms > 0:
                self._start_timeout_monitor()
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

    def _start_timeout_monitor(self) -> None:
        if self._timeout_task and not self._timeout_task.done():
            return
        self._timeout_task = asyncio.create_task(self._timeout_loop())

    def _stop_timeout_monitor(self) -> None:
        if self._timeout_task and not self._timeout_task.done():
            self._timeout_task.cancel()
            self._timeout_task = None

    async def _timeout_loop(self) -> None:
        """Monitor open decisions for wall-clock timeout expiry."""
        try:
            while self._decisions.get_open_decisions():
                await asyncio.sleep(0.5)
                now_ms = _time_mod.monotonic() * 1000
                pt = self._time.play_time_ms
                all_changes: list[dict] = []
                for d in list(self._decisions.get_open_decisions()):
                    if d.timeout_ms <= 0:
                        continue
                    if (now_ms - d.opened_at_rt_ms) < d.timeout_ms:
                        continue
                    # Auto-submit worst option via game mode
                    auto_id = self._config.game_mode.on_decision_timeout(
                        d.id, d.options,
                    )
                    selected_ids = [auto_id] if auto_id else []
                    close_change = self._decisions.close_decision(
                        d.id,
                        current_pt_ms=pt,
                        selected_option_ids=selected_ids,
                    )
                    if close_change:
                        all_changes.append(close_change)
                    # Apply scoring via v2
                    selected_opts = [
                        o for o in d.options if o["id"] in selected_ids
                    ]
                    template = self._find_decision_template(d.id)
                    forced_ids = template.forced_option_ids if template else []
                    extra = self._config.game_mode.on_decision_closed_v2(
                        d.id, selected_opts, d.options,
                        forced_option_ids=forced_ids or None,
                    )
                    all_changes.extend(extra)
                    # Chain to next decision
                    next_id = self._config.game_mode.get_next_decision_id(d.id)
                    if next_id:
                        nt = self._find_decision_template(next_id)
                        if nt:
                            timeout_ms = self._config.game_mode.get_decision_time_ms(
                                int(nt.timeout_ms),
                            )
                            opened = self._decisions.open_decision(
                                id=nt.id,
                                event_id=None,
                                issue_id=nt.issue_id,
                                title=nt.title,
                                description=nt.description,
                                question_type=nt.question_type,
                                options=nt.options,
                                completion_mode=nt.completion_mode,
                                target_roles=nt.target_roles,
                                timeout_ms=timeout_ms,
                                current_pt_ms=pt,
                            )
                            all_changes.append(opened)
                if all_changes and self._on_state_change:
                    await self._on_state_change(all_changes)
                if not self._decisions.get_open_decisions():
                    if self._config.game_mode.requires_gm():
                        await self.resume()
                    break
        except asyncio.CancelledError:
            pass

    def _phase_change(self, action: str) -> PhaseChange:
        return {
            "type": "phase_change",
            "action": action,
            "phase": self._phase.value,
            "time": self._time.snapshot(),
        }
