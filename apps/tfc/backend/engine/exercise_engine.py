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
    DomainEffect,
    EngineSnapshot,
    PhaseChange,
    StateChange,
    SystemEffect,
    SystemStateChange,
    WarfareDomainChange,
)
from engine.system_manager import SystemManager
from engine.time_manager import TimeManager
from engine.warfare_domain_manager import WarfareDomainManager


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
        self._warfare_domains = WarfareDomainManager()
        self._decisions = DecisionManager()
        self._tick_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._timeout_task: asyncio.Task | None = None  # type: ignore[type-arg]
        self._on_state_change = on_state_change

        self._option_play_counts: dict[str, int] = {}

        self._events.load_events(config.events)
        self._issues.load_issues(config.issues)
        self._systems.load_systems(list(config.initial_system_states))
        self._warfare_domains.load_domains(list(config.initial_warfare_domains))

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
    def warfare_domain_manager(self) -> WarfareDomainManager:
        return self._warfare_domains

    @property
    def decision_manager(self) -> DecisionManager:
        return self._decisions

    @property
    def config(self) -> EngineConfig:
        return self._config

    @property
    def option_play_counts(self) -> dict[str, int]:
        return dict(self._option_play_counts)

    def record_option_plays(self, options: list[DecisionOptionSnapshot]) -> None:
        """Increment play count for each selected option."""
        for opt in options:
            self._option_play_counts[opt["id"]] = self._option_play_counts.get(opt["id"], 0) + 1

    def is_option_exhausted(self, option: DecisionOptionSnapshot) -> bool:
        """Check if an option has reached its max_plays limit."""
        max_plays = option["max_plays"]
        if max_plays == 0:
            return False  # unlimited
        return self._option_play_counts.get(option["id"], 0) >= max_plays

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
        self._warfare_domains.load_domains(list(self._config.initial_warfare_domains))
        self._decisions.clear()
        self._option_play_counts.clear()
        return self._phase_change("reset")

    def set_speed(self, factor: float) -> StateChange:
        self._time.factor = factor
        return {"type": "speed_change", "factor": factor}

    # ── Canonical decision close ─────────────────────────────────────────

    async def close_decision(
        self,
        decision_id: str,
        selected_option_ids: list[str],
        target_system_selections: dict[str, str] | None = None,
    ) -> list[StateChange]:
        """Single canonical path for closing a decision.

        Handles: validate → close → score → resolve forced cards →
        record plays → system effects (with optional target overrides) →
        advance turn → auto-complete.

        Args:
            target_system_selections: map of option_id → system_id for
                options with targets_system=True. Pass None on timeout
                to skip target-system effects.

        Raises ValueError if decision missing/closed, max_selections
        violated, or a required target system selection is missing/invalid.
        """
        pt = self._time.play_time_ms

        decision = self._decisions.get_decision(decision_id)
        if decision is None or decision.status != "open":
            raise ValueError(f"Decision {decision_id} not found or already closed")

        template = self.find_decision_template(decision_id)

        # Validate max_selections
        if template and template.max_selections is not None:
            if len(selected_option_ids) > template.max_selections:
                raise ValueError(
                    f"Decision {decision_id} allows at most "
                    f"{template.max_selections} selections, "
                    f"got {len(selected_option_ids)}"
                )

        # 1. Close
        close_change = self._decisions.close_decision(
            decision_id,
            current_pt_ms=pt,
            selected_option_ids=selected_option_ids,
        )
        if not close_change:
            raise ValueError(f"Decision {decision_id} not found or already closed")
        changes: list[StateChange] = [close_change]

        # 2. Score (forced cards handled inside game mode)
        selected_opts = [o for o in decision.options if o["id"] in selected_option_ids]
        forced_ids = template.forced_option_ids if template else []
        score_changes = self._config.game_mode.on_decision_closed_v2(
            decision_id,
            selected_opts,
            decision.options,
            forced_option_ids=forced_ids or None,
            turn_stress_delta=template.stress_delta if template else 0,
        )
        changes.extend(score_changes)

        # 3. Resolve effective options (selected + auto-added forced cards)
        effective_opts = self._resolve_effective_options(
            selected_opts,
            decision.options,
            forced_ids,
        )

        # 4. Record plays + system effects on effective options
        self.record_option_plays(effective_opts)
        changes.extend(self._apply_system_effects(effective_opts, target_system_selections))

        # 5. Advance to next turn (or auto-complete if exhausted)
        advance = await self._advance_to_next_turn(decision_id, pt)
        changes.extend(advance)

        # 6. Auto-resume for GM mode
        if self._config.game_mode.requires_gm():
            if not self._decisions.get_open_decisions():
                changes.append(await self.resume())

        return changes

    def _resolve_effective_options(
        self,
        selected: list[DecisionOptionSnapshot],
        all_options: list[DecisionOptionSnapshot],
        forced_ids: list[str],
    ) -> list[DecisionOptionSnapshot]:
        """Return selected + auto-added forced card options."""
        selected_ids = {o["id"] for o in selected}
        effective = list(selected)
        for fid in forced_ids or []:
            if fid not in selected_ids:
                forced_opt = next((o for o in all_options if o["id"] == fid), None)
                if forced_opt is not None:
                    effective.append(forced_opt)
        return effective

    async def _advance_to_next_turn(
        self,
        closed_decision_id: str,
        pt: float,
    ) -> list[StateChange]:
        """Advance to next decision in sequence, or auto-complete if exhausted."""
        advance = self.force_trigger_next_decision(pt, closed_decision_id)
        if advance:
            return advance
        # Sequence exhausted — auto-complete if still running
        if (
            self._config.game_mode.get_next_decision_id(closed_decision_id) is None
            and self._phase == EnginePhase.RUNNING
        ):
            try:
                return [await self.complete()]
            except EngineStateError:
                pass  # Another path already completed
        return []

    # ── Canonical event trigger ────────────────────────────────────────

    def trigger_event(self, event_id: str) -> list[StateChange]:
        """Single canonical path for triggering an event.

        Handles: force-trigger → event system effects →
        event domain effects → open decision (if applicable).

        Raises ValueError if event missing or not triggerable.
        """
        pt = self._time.play_time_ms
        event = self._events.events.get(event_id)
        if not event:
            raise ValueError(f"Event {event_id} not found")
        event_change = self._events.force_trigger(event_id, pt)
        if not event_change:
            raise ValueError(f"Event {event_id} not triggerable")
        changes: list[StateChange] = [event_change]
        # Apply system effects
        if event.system_effects:
            changes.extend(self._apply_event_system_effects(event.system_effects))
        # Apply domain effects
        if event.domain_effects:
            changes.extend(self._apply_event_domain_effects(event.domain_effects))
        # Open decision if applicable
        changes.extend(self._handle_decision_events([event_change], pt))
        return changes

    async def tick(self) -> list[StateChange]:
        """Advance time, check triggers, return state changes."""
        changes: list[StateChange] = []
        self._time.tick()
        pt = self._time.play_time_ms

        event_changes = self._events.tick(pt)
        changes.extend(event_changes)

        # Apply system effects from events that just started
        # (force-triggered events are handled in force_trigger_next_decision)
        for change in event_changes:
            if change.get("action") == "started":
                event = self._events.events.get(change["event_id"])
                if event and event.system_effects:
                    changes.extend(self._apply_event_system_effects(event.system_effects))
                if event and event.domain_effects:
                    changes.extend(self._apply_event_domain_effects(event.domain_effects))

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
            warfare_domains=self._warfare_domains.snapshot(),
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

    def force_trigger_next_decision(
        self,
        pt: float,
        closed_decision_id: str = "",
    ) -> list[StateChange]:
        """Force-trigger the next event in the game mode's decision sequence.

        Called after closing a decision (player submission or timeout).
        Returns event_change + decision_opened state changes, or [] if
        the sequence is exhausted or the next event doesn't exist.
        """
        next_id = self._config.game_mode.get_next_decision_id(closed_decision_id)
        if not next_id:
            return []
        event = self._events.events.get(next_id)
        if not event:
            return []
        event_change = self._events.force_trigger(next_id, pt)
        if not event_change:
            return []
        changes: list[StateChange] = [event_change]
        # Apply system effects from force-triggered event
        if event and event.system_effects:
            changes.extend(self._apply_event_system_effects(event.system_effects))
        # Apply domain effects from force-triggered event
        if event and event.domain_effects:
            changes.extend(self._apply_event_domain_effects(event.domain_effects))
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

    def _is_timed_out(self, decision: object) -> bool:
        """Check if a decision has exceeded its wall-clock timeout."""
        now_ms = _time_mod.monotonic() * 1000
        return (
            decision.timeout_ms > 0 and (now_ms - decision.opened_at_rt_ms) >= decision.timeout_ms
        )

    def _select_timeout_option(self, decision: object) -> str | None:
        """Pick the auto-submit option for a timed-out decision."""
        available = [o for o in decision.options if not self.is_option_exhausted(o)]
        return self._config.game_mode.on_decision_timeout(
            decision.id,
            available or decision.options,
        )

    async def _timeout_loop(self) -> None:
        """Monitor open decisions for wall-clock timeout expiry."""
        try:
            while self._decisions.get_open_decisions():
                await asyncio.sleep(0.5)
                for d in list(self._decisions.get_open_decisions()):
                    if not self._is_timed_out(d):
                        continue
                    auto_id = self._select_timeout_option(d)
                    selected = [auto_id] if auto_id else []
                    changes = await self.close_decision(d.id, selected)
                    if changes and self._on_state_change:
                        await self._on_state_change(changes)
                if not self._decisions.get_open_decisions():
                    break
        except asyncio.CancelledError:
            pass

    def _apply_system_effects(
        self,
        selected_options: list[DecisionOptionSnapshot],
        target_system_selections: dict[str, str] | None = None,
    ) -> list[SystemStateChange]:
        """Apply system_effects from selected decision options via SystemManager."""
        out: list[SystemStateChange] = []
        for opt in selected_options:
            effects = opt["system_effects"]
            if opt["targets_system"]:
                sel = (target_system_selections or {}).get(opt["id"])
                if sel is None:
                    if target_system_selections is not None:
                        raise ValueError(f"Option {opt['id']} requires a target system selection")
                    # No selections at all (e.g. timeout) — skip effect
                    continue
                if sel not in self._systems.systems:
                    raise ValueError(f"Target system '{sel}' not found")
                effects = [
                    SystemEffect(
                        system_id=sel,
                        operational_state=fx["operational_state"],
                        power_state=fx["power_state"],
                        set_all_power=fx["set_all_power"],
                    )
                    for fx in effects
                ]
            out.extend(self._apply_effects_list(effects))
        return out

    def _apply_event_system_effects(
        self,
        effects: list[SystemEffect],
    ) -> list[SystemStateChange]:
        """Apply system_effects from an event (inject) via SystemManager."""
        return self._apply_effects_list(effects)

    def _apply_event_domain_effects(
        self,
        effects: list[DomainEffect],
    ) -> list[WarfareDomainChange]:
        """Apply domain_effects from an event (inject) via WarfareDomainManager."""
        out: list[WarfareDomainChange] = []
        for fx in effects:
            if c := self._warfare_domains.set_threat_level(fx["domain_id"], fx["threat_level"]):
                out.append(c)
        return out

    def _apply_effects_list(
        self,
        effects: list[SystemEffect],
    ) -> list[SystemStateChange]:
        """Shared logic for applying a list of SystemEffect dicts."""
        out: list[SystemStateChange] = []
        for fx in effects:
            if fx.get("set_all_power"):
                on = fx["power_state"] if fx["power_state"] is not None else True
                out.extend(self._systems.set_all_power(on))
                continue
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
