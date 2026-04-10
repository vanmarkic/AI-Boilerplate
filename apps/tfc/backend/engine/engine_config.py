"""Engine configuration dataclasses and constants.

Defines DecisionTemplate, ScenarioContext, and EngineConfig — the
data structures passed to ExerciseEngine at construction time.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from engine.inject_scheduler import ScheduledInject
from engine.defect_manager import TrackedDefect

TICK_INTERVAL_S = 0.25


@dataclass
class DecisionTemplate:
    id: str
    title: str
    description: str
    question_type: str
    options: list[dict]
    completion_mode: str
    defect_id: str | None = None
    target_roles: list[str] = field(default_factory=list)
    timeout_ms: float = 0.0


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
    injects: list[ScheduledInject] = field(default_factory=list)
    defects: list[TrackedDefect] = field(default_factory=list)
    decision_templates: list[DecisionTemplate] = field(default_factory=list)
    context: ScenarioContext = field(default_factory=ScenarioContext)
