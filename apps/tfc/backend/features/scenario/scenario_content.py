"""Pydantic models defining the structured JSON stored in tfc_scenarios.content.

These models validate scenario data authored by the GM and serve as the
bridge between the scenario editor and the exercise engine.
"""
from __future__ import annotations

from pydantic import BaseModel


class DecisionOptionDef(BaseModel):
    """A single selectable option within a decision template."""
    id: str
    label: str
    score: float = 0.0


class DecisionTemplateDef(BaseModel):
    """Template for a decision that players must make during an exercise."""
    id: str
    title: str
    description: str = ""
    issue_id: str  # linked issue
    question_type: str  # single_choice, multi_choice, free_text, scale
    options: list[DecisionOptionDef] = []
    completion_mode: str = "first_response"
    timeout_ms: float = 0  # 0 = no timeout
    target_roles: list[str] = []
    forced_option_ids: list[str] = []


class ScenarioEventDef(BaseModel):
    """Definition of a single event within a scenario."""
    id: str
    title: str
    description: str = ""
    event_type: str  # informational, operational, decision
    scheduled_pt_ms: float  # when to trigger in play time
    duration_ms: float | None = None  # auto-complete after duration
    dependencies: list[str] = []  # event IDs that must complete first
    triggered_issues: list[str] = []  # issue IDs activated on completion


class ScenarioIssueDef(BaseModel):
    """Definition of a single issue within a scenario."""
    id: str
    title: str
    description: str = ""
    trigger_mode: str  # time-based, event-based, manual
    trigger_time_pt_ms: float | None = None
    trigger_event_id: str | None = None
    auto_resolve_ms: float = 0  # 0 = no auto-resolve


class ScenarioPhaseDef(BaseModel):
    """Definition of a phase grouping events within a scenario."""
    id: str
    title: str
    description: str = ""
    duration_ms: float | None = None  # auto-advance after duration
    events: list[str] = []  # event IDs in this phase


class RoleDef(BaseModel):
    """Definition of a participant role within a scenario."""
    id: str
    label: str
    player_type: str = "advisor"  # "advisor" or "decision_maker"


class ScenarioContent(BaseModel):
    """Top-level scenario definition validated against this schema.

    This is the structured JSON stored in the ``tfc_scenarios.content``
    column. The GM authors this via the scenario editor; the engine
    loader converts it into runtime objects at exercise start.
    """
    phases: list[ScenarioPhaseDef] = []
    events: list[ScenarioEventDef] = []
    issues: list[ScenarioIssueDef] = []
    decision_templates: list[DecisionTemplateDef] = []
    default_time_factor: float = 1.0
    briefing: str = ""
    objectives: list[str] = []
    rules: list[str] = []
    game_mode: str = "classic"
    game_mode_config: dict = {}
    decision_sequence: list[str] = []
    roles: list[RoleDef] = []
