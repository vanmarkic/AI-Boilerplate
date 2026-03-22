"""Pydantic models defining the structured JSON stored in tfc_scenarios.content.

These models validate scenario data authored by the GM and serve as the
bridge between the scenario editor and the exercise engine.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from core.game_mode_constants import GM_CLASSIC, GM_SIMPLE_COLLABORATIVE


class SystemEffectDef(BaseModel):
    """A system state change triggered by selecting a decision option or event start."""

    system_id: str
    operational_state: str | None = None  # "green" | "yellow" | "red"
    power_state: bool | None = None
    set_all_power: bool = False  # General Quarters: power all systems ON


class DomainEffectDef(BaseModel):
    """A warfare domain threat-level change triggered by an event."""

    domain_id: str
    threat_level: str  # "green" | "yellow" | "red"


class DecisionOptionDef(BaseModel):
    """A single selectable option within a decision template."""

    id: str
    label: str
    score: float = 0.0
    stress_delta: int = 0
    system_effects: list[SystemEffectDef] = []
    targets_system: bool = False
    max_plays: int = Field(default=0, ge=0)  # 0 = unlimited, 1+ = explicit limit


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
    max_selections: int | None = None  # None = unlimited
    stress_delta: int = 0  # turn-level stress applied regardless of card choice


class ScenarioEventDef(BaseModel):
    """Definition of an inject (event) within a scenario. Domain term: 'inject'."""

    id: str
    title: str
    description: str = ""
    event_type: str  # informational, operational, decision
    scheduled_pt_ms: float  # when to trigger in play time
    duration_ms: float | None = None  # auto-complete after duration
    dependencies: list[str] = []  # event IDs that must complete first
    triggered_issues: list[str] = []  # issue IDs activated on completion
    target_roles: list[str] = []  # empty = visible to all roles
    role_descriptions: dict[str, str] = {}  # per-role description overrides
    system_effects: list[SystemEffectDef] = []  # system state changes on event start
    domain_effects: list[DomainEffectDef] = []  # warfare domain changes on event start


class ScenarioIssueDef(BaseModel):
    """Definition of a defect (issue) within a scenario. Domain term: 'defect'."""

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


class SystemStateDef(BaseModel):
    """Initial or expected system state in scenario definition."""

    system_id: str
    label: str = ""
    category: str = "system"  # "system" | "weapon"
    operational_state: str | None = None  # "green"|"yellow"|"red"
    power_state: bool | None = None


class WarfareDomainDef(BaseModel):
    """Initial warfare domain definition in scenario."""

    domain_id: str
    label: str = ""
    initial_threat_level: str = "green"


class BlueCardDef(BaseModel):
    """A card in the global catalog, independent of any turn."""

    id: str
    title: str
    description: str = ""
    targets_system: bool = False


class TurnInjectDef(BaseModel):
    """Per-role inject text within a turn."""

    target_roles: list[str] = []
    text: str
    role_descriptions: dict[str, str] = {}


class TurnCardConfig(BaseModel):
    """Per-turn configuration for an available blue card."""

    card_id: str
    score: float = 0.0
    stress_delta: int = 0
    system_effects: list[SystemEffectDef] = []
    domain_effects: list[DomainEffectDef] = []
    max_plays: int = Field(default=0, ge=0)


class PathNoteDef(BaseModel):
    """Facilitator notes for best/acceptable play paths."""

    card_ids: list[str] = []
    notes: str = ""


class TurnDefinition(BaseModel):
    """Groups injects and a decision template into a turn."""

    turn_index: int
    title: str = ""
    facilitator_prompt: str | None = None
    has_decisions: bool = True
    duration_ms: float | None = None
    # Legacy fields (kept for backward compat with existing seeds)
    inject_ids: list[str] = []
    decision_template_id: str | None = None
    # New turn-authoring fields
    injects: list[TurnInjectDef] = []
    available_cards: list[TurnCardConfig] = []
    max_selections: int = 2
    base_stress_delta: int = 0
    system_effects_on_start: list[SystemEffectDef] = []
    domain_effects_on_start: list[DomainEffectDef] = []
    best_path: PathNoteDef | None = None
    acceptable_path: PathNoteDef | None = None
    design_notes: str = ""


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
    game_mode: str = GM_CLASSIC
    game_mode_config: dict[str, object] = {}
    decision_sequence: list[str] = []
    roles: list[RoleDef] = []
    turns: list[TurnDefinition] = []
    initial_system_states: list[SystemStateDef] = []
    initial_warfare_domains: list[WarfareDomainDef] = []
    score_tier_thresholds: dict[str, float] = {}  # {"lo": 0.33, "mid": 0.66}

    @model_validator(mode="after")
    def validate_roles(self) -> ScenarioContent:
        """Enforce that every scenario defines roles appropriate for its game mode."""
        if not self.roles:
            raise ValueError("Scenario must define at least one role in 'roles'.")
        role_ids = {r.id for r in self.roles}
        player_types = {r.player_type for r in self.roles}
        if "decision_maker" not in player_types:
            raise ValueError(
                "Scenario must have at least one role with player_type='decision_maker'."
            )
        if self.game_mode == GM_SIMPLE_COLLABORATIVE and len(self.roles) < 2:
            raise ValueError(
                "Simple collaborative scenarios require at least 2 playable "
                f"roles, but only {len(self.roles)} defined."
            )
        for dt in self.decision_templates:
            for rid in dt.target_roles:
                if rid not in role_ids:
                    raise ValueError(
                        f"Decision template '{dt.id}' targets unknown "
                        f"role '{rid}'. Defined roles: {sorted(role_ids)}."
                    )
        for evt in self.events:
            for rid in evt.target_roles:
                if rid not in role_ids:
                    raise ValueError(
                        f"Event '{evt.id}' targets unknown "
                        f"role '{rid}'. Defined roles: {sorted(role_ids)}."
                    )
            for rid in evt.role_descriptions:
                if rid not in role_ids:
                    raise ValueError(
                        f"Event '{evt.id}' has role_description for unknown "
                        f"role '{rid}'. Defined roles: {sorted(role_ids)}."
                    )
        return self
