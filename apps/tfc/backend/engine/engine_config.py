"""Engine configuration dataclasses and constants.

Defines DecisionTemplate, ScenarioContext, and EngineConfig — the
data structures passed to ExerciseEngine at construction time.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from engine.event_scheduler import ScheduledEvent
from engine.game_modes.classic import ClassicMode
from engine.issue_manager import TrackedIssue

TICK_INTERVAL_S = 0.25


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
    timeout_ms: float = 0.0
    forced_option_ids: list[str] = field(default_factory=list)


@dataclass
class RoleInfo:
    id: str
    label: str
    player_type: str = "advisor"


@dataclass
class ScenarioContext:
    title: str = ""
    description: str = ""
    briefing: str = ""
    objectives: list[str] = field(default_factory=list)
    rules: list[str] = field(default_factory=list)
    roles: list[RoleInfo] = field(default_factory=list)


@dataclass
class EngineConfig:
    exercise_id: int
    title: str
    time_factor: float = 1.0
    events: list[ScheduledEvent] = field(default_factory=list)  # domain: "injects"
    issues: list[TrackedIssue] = field(default_factory=list)  # domain: "defects"
    decision_templates: list[DecisionTemplate] = field(default_factory=list)
    context: ScenarioContext = field(default_factory=ScenarioContext)
    game_mode: ClassicMode = field(default_factory=ClassicMode)
