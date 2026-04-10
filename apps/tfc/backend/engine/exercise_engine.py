"""Exercise engine — orchestrates TimeManager, InjectScheduler, DefectManager."""
from __future__ import annotations

import asyncio
import time as _time_mod
from enum import StrEnum
from typing import Callable, Awaitable

from engine.state_changes import PhaseChange, StateChange
from engine.engine_config import (  # noqa: F401 — re-exported
    TICK_INTERVAL_S, DecisionTemplate, EngineConfig, ScenarioContext,
)
from engine.time_manager import TimeManager
from engine.inject_scheduler import InjectScheduler, InjectLifecycle, InjectType
from engine.defect_manager import DefectManager
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
        self._injects = InjectScheduler()
        self._defects = DefectManager()
        self._decisions = DecisionManager()
        self._tick_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._timeout_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._on_state_change = on_state_change

        self._injects.load_injects(config.injects)
        self._defects.load_defects(config.defects)

    @property
    def phase(self) -> EnginePhase:
        return self._phase

    @property
    def time_manager(self) -> TimeManager:
        return self._time

    @property
    def inject_scheduler(self) -> InjectScheduler:
        return self._injects

    @property
    def defect_manager(self) -> DefectManager:
        return self._defects

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
        self._stop_timeout_monitor()
        return self._phase_change("completed")

    async def reset(self) -> dict:
        self._stop_tick_loop()
        self._stop_timeout_monitor()
        self._phase = EnginePhase.SETUP
        self._time.reset()
        self._injects.load_injects(self._config.injects)
        self._defects.load_defects(self._config.defects)
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

        inject_changes = self._injects.tick(pt)
        changes.extend(inject_changes)

        decision_changes = self._handle_decision_injects(inject_changes, pt)
        changes.extend(decision_changes)

        completed_injects = {
            eid for eid, ev in self._injects.injects.items()
            if ev.lifecycle == InjectLifecycle.COMPLETED
        }

        for change in inject_changes:
            if change.get("action") == "completed":
                inject_id = change["inject_id"]
                defect_changes = self._defects.activate_by_inject(inject_id, pt)
                changes.extend(defect_changes)

        defect_changes = self._defects.tick(pt, completed_injects, current_rt_ms=self._time.real_time_ms)
        changes.extend(defect_changes)

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
            "injects": self._injects.snapshot(),
            "defects": self._defects.snapshot(),
            "decisions": self._decisions.snapshot(),
        }

    def _handle_decision_injects(
        self, inject_changes: list[dict], pt: float,
    ) -> list[dict]:
        changes: list[dict] = []
        for change in inject_changes:
            if change.get("action") != "started":
                continue
            inject_id = change["inject_id"]
            inject = self._injects.injects.get(inject_id)
            if inject is None or inject.inject_type != InjectType.DECISION:
                continue
            t = self._find_decision_template(inject_id)
            timeout_ms = t.timeout_ms if t else 0.0
            changes.append(self._decisions.open_decision(
                id=t.id if t else inject_id,
                inject_id=inject_id,
                defect_id=t.defect_id if t else None,
                title=t.title if t else inject.title,
                description=t.description if t else inject.description,
                question_type=t.question_type if t else "free_text",
                options=t.options if t else [],
                completion_mode=t.completion_mode if t else "first_response",
                target_roles=t.target_roles if t else [],
                timeout_ms=timeout_ms,
                current_pt_ms=pt,
            ))
            self._phase = EnginePhase.PAUSED
            self._time.pause()
            self._stop_tick_loop()
            if timeout_ms > 0:
                self._start_timeout_monitor()
        return changes

    def _find_decision_template(self, inject_id: str) -> DecisionTemplate | None:
        for dt in self._config.decision_templates:
            if dt.id == inject_id:
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
                changes = [
                    c for d in self._decisions.get_open_decisions()
                    if d.timeout_ms > 0 and (now_ms - d.opened_at_rt_ms) >= d.timeout_ms
                    for c in [self._decisions.close_decision(d.id, current_pt_ms=pt)]
                    if c is not None
                ]
                if changes and self._on_state_change:
                    await self._on_state_change(changes)
                if changes and not self._decisions.get_open_decisions():
                    await self.resume()
        except asyncio.CancelledError:
            pass

    def _phase_change(self, action: str) -> PhaseChange:
        return {
            "type": "phase_change",
            "action": action,
            "phase": self._phase.value,
            "time": self._time.snapshot(),
        }
