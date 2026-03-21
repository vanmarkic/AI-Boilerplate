"""Exercise engine — orchestrates TimeManager, EventScheduler (injects), IssueManager (defects).

Domain terms: "inject" = event, "defect" = issue. See AGENTS.md terminology mapping.
"""

from __future__ import annotations

import asyncio
import time as _time_mod
from collections.abc import Awaitable, Callable
from enum import StrEnum

from engine.decision_manager import DecisionManager
from engine.engine_config import (  # noqa: F401 — re-exported
    TICK_INTERVAL_S,
    DecisionTemplate,
    EngineConfig,
    ScenarioContext,
)
from engine.event_scheduler import EventLifecycle, EventScheduler, EventType
from engine.game_modes.protocol import GameMode
from engine.issue_manager import IssueManager
from engine.state_changes import (
    DecisionOpened,
    DecisionOptionSnapshot,
    EngineSnapshot,
    PhaseChange,
    StateChange,
    SystemStateChange,
)
from engine.system_manager import SystemManager
from engine.time_manager import TimeManager


class EngineStateError(RuntimeError):
    """Raised when an engine lifecycle method is called in an invalid phase."""


class EnginePhase(StrEnum):
    SETUP = "setup"
    BRIEFING = "briefing"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"


class ExerciseEngine:
    """Runtime engine for a single exercise session."""

    def __init__(
        self,
        config: EngineConfig,
        on_state_change: Callable[[list[StateChange]], Awaitable[None]] | None = None,
    ) -> None:
        self._config = config
        self._phase = EnginePhase.SETUP
        self._time = TimeManager(factor=config.time_factor)
        self._events = EventScheduler()
        self._issues = IssueManager()
        self._systems = SystemManager()
        self._decisions = DecisionManager()
        self._tick_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._timeout_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._on_state_change = on_state_change

        self._events.load_events(config.events)
        self._issues.load_issues(config.issues)
        self._systems.load_systems(list(config.initial_system_states))

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
    def system_manager(self) -> SystemManager:
        return self._systems

    @property
    def decision_manager(self) -> DecisionManager:
        return self._decisions

    @property
    def config(self) -> EngineConfig:
        return self._config

    @property
    def game_mode(self) -> GameMode:
        return self._config.game_mode

    async def start(self) -> PhaseChange:
        if self._phase not in {EnginePhase.SETUP}:
            raise EngineStateError(f"Cannot start from {self._phase}")
        self._phase = EnginePhase.BRIEFING
        return self._phase_change("started")

    async def begin(self) -> PhaseChange:
        """Transition BRIEFING → RUNNING: player has read the briefing."""
        if self._phase != EnginePhase.BRIEFING:
            raise EngineStateError(f"Cannot begin from {self._phase}")
        self._phase = EnginePhase.RUNNING
        self._time.start()
        self._start_tick_loop()
        return self._phase_change("begun")

    async def pause(self) -> PhaseChange:
        if self._phase != EnginePhase.RUNNING:
            raise EngineStateError(f"Cannot pause from {self._phase}")
        self._phase = EnginePhase.PAUSED
        self._time.pause()
        self._stop_tick_loop()
        return self._phase_change("paused")

    async def resume(self) -> PhaseChange:
        if self._phase != EnginePhase.PAUSED:
            raise EngineStateError(f"Cannot resume from {self._phase}")
        self._phase = EnginePhase.RUNNING
        self._time.start()
        self._start_tick_loop()
        return self._phase_change("started")

    async def complete(self) -> PhaseChange:
        if self._phase in {EnginePhase.COMPLETED, EnginePhase.SETUP}:
            raise EngineStateError(f"Cannot complete from {self._phase}")
        self._phase = EnginePhase.COMPLETED
        self._time.pause()
        self._stop_tick_loop()
        self._stop_timeout_monitor()
        return self._phase_change("completed")

    async def reset(self) -> PhaseChange:
        self._stop_tick_loop()
        self._stop_timeout_monitor()
        self._phase = EnginePhase.SETUP
        self._time.reset()
        self._events.load_events(self._config.events)
        self._issues.load_issues(self._config.issues)
        self._systems.load_systems(list(self._config.initial_system_states))
        self._decisions.clear()
        return self._phase_change("reset")

    def set_speed(self, factor: float) -> StateChange:
        self._time.factor = factor
        return {"type": "speed_change", "factor": factor}

    async def tick(self) -> list[StateChange]:
        """Advance time, check triggers, return state changes."""
        changes: list[StateChange] = []
        self._time.tick()
        pt = self._time.play_time_ms

        event_changes = self._events.tick(pt)
        changes.extend(event_changes)

        decision_changes = self._handle_decision_events(event_changes, pt)
        changes.extend(decision_changes)

        completed_events = {
            eid
            for eid, ev in self._events.events.items()
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

    def snapshot(self) -> EngineSnapshot:
        """Full state snapshot for client sync."""
        return EngineSnapshot(
            exercise_id=self._config.exercise_id,
            title=self._config.title,
            phase=self._phase.value,
            time=self._time.snapshot(),
            events=self._events.snapshot(),
            issues=self._issues.snapshot(),
            decisions=self._decisions.snapshot(),
            score=self._config.game_mode.snapshot(),
            systems=self._systems.snapshot(),
        )

    def _handle_decision_events(
        self,
        event_changes: list[StateChange],
        pt: float,
    ) -> list[DecisionOpened]:
        changes: list[DecisionOpened] = []
        for change in event_changes:
            if change.get("action") not in ("started", "force_triggered"):
                continue
            event_id = change["event_id"]
            event = self._events.events.get(event_id)
            if event is None or event.event_type != EventType.DECISION:
                continue
            # Skip if there's already an open decision (prevent tick-loop pile-up)
            if self._decisions.get_open_decisions():
                continue
            t = self.find_decision_template(event_id)
            template_timeout = t.timeout_ms if t else 0.0
            # If template has no timeout, use game mode's stress-based timer
            timeout_ms = template_timeout or self._config.game_mode.get_decision_time_ms(0)
            changes.append(
                self._decisions.open_decision(
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
                    max_selections=t.max_selections if t else None,
                    current_pt_ms=pt,
                )
            )
            if self._config.game_mode.should_pause_on_decision():
                self._phase = EnginePhase.PAUSED
                self._time.pause()
                self._stop_tick_loop()
            if timeout_ms > 0:
                self._start_timeout_monitor()
        return changes

    def find_decision_template(self, event_id: str) -> DecisionTemplate | None:
        return next((dt for dt in self._config.decision_templates if dt.id == event_id), None)

    def force_trigger_next_decision(self, pt: float) -> list[StateChange]:
        """Force-trigger the next event in the game mode's decision sequence.

        Called after closing a decision (player submission or timeout).
        Returns event_change + decision_opened state changes, or [] if
        the sequence is exhausted or the next event doesn't exist.
        """
        next_id = self._config.game_mode.get_next_decision_id("")
        if not next_id:
            return []
        event = self._events.events.get(next_id)
        if not event:
            return []
        event_change = self._events.force_trigger(next_id, pt)
        if not event_change:
            return []
        changes: list[StateChange] = [event_change]
        changes.extend(self._handle_decision_events([event_change], pt))
        return changes

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
        if not self._timeout_task or self._timeout_task.done():
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
                all_changes: list[StateChange] = []
                for d in list(self._decisions.get_open_decisions()):
                    if d.timeout_ms <= 0:
                        continue
                    if (now_ms - d.opened_at_rt_ms) < d.timeout_ms:
                        continue
                    # Auto-submit worst option via game mode
                    auto_id = self._config.game_mode.on_decision_timeout(
                        d.id,
                        d.options,
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
                    selected_opts = [o for o in d.options if o["id"] in selected_ids]
                    template = self.find_decision_template(d.id)
                    forced_ids = template.forced_option_ids if template else []
                    extra = self._config.game_mode.on_decision_closed_v2(
                        d.id,
                        selected_opts,
                        d.options,
                        forced_option_ids=forced_ids or None,
                        turn_stress_delta=template.stress_delta if template else 0,
                    )
                    all_changes.extend(extra)
                    # Apply system effects from selected options
                    all_changes.extend(self._apply_system_effects(selected_opts))
                    # Advance to next turn
                    all_changes.extend(self.force_trigger_next_decision(pt))
                if all_changes and self._on_state_change:
                    await self._on_state_change(all_changes)
                if not self._decisions.get_open_decisions():
                    if self._config.game_mode.requires_gm():
                        await self.resume()
                    break
        except asyncio.CancelledError:
            pass

    def _apply_system_effects(
        self, selected_options: list[DecisionOptionSnapshot],
    ) -> list[SystemStateChange]:
        """Apply system_effects from selected options via SystemManager."""
        out: list[SystemStateChange] = []  # TODO: targets_system needs submission data plumbing
        for opt in selected_options:
            for fx in opt["system_effects"]:
                if fx["power_state"] is not None:
                    if c := self._systems.set_power(fx["system_id"], fx["power_state"]):
                        out.append(c)
                if fx["operational_state"] is not None:
                    if c := self._systems.set_operational(fx["system_id"], fx["operational_state"]):
                        out.append(c)
        return out

    def _phase_change(self, action: str) -> PhaseChange:
        return {
            "type": "phase_change",
            "action": action,
            "phase": self._phase.value,
            "time": self._time.snapshot(),
        }
