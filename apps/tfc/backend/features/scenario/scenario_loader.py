"""Converts ScenarioContent into engine-ready runtime objects.

Bridges the gap between the authored scenario JSON and the engine's
ScheduledEvent / TrackedIssue / EngineConfig dataclasses.
"""

from __future__ import annotations

from engine.engine_config import RoleInfo
from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import (
    DecisionTemplate,
    EngineConfig,
    ScenarioContext,
)
from engine.game_modes import create_game_mode
from engine.issue_manager import TrackedIssue, TriggerMode
from engine.state_changes import DecisionOptionSnapshot, DomainEffect, SystemEffect
from engine.system_manager import SystemState
from engine.warfare_domain_manager import WarfareDomainState
from features.scenario.scenario_content import (
    DecisionOptionDef,
    DecisionTemplateDef,
    ScenarioContent,
    ScenarioEventDef,
    ScenarioIssueDef,
    SystemStateDef,
    TurnDefinition,
    WarfareDomainDef,
)


def load_scenario_events(content: ScenarioContent) -> list[ScheduledEvent]:
    """Convert scenario event definitions to engine ScheduledEvent objects."""
    events: list[ScheduledEvent] = []
    for evt in content.events:
        events.append(
            ScheduledEvent(
                id=evt.id,
                title=evt.title,
                description=evt.description,
                event_type=EventType(evt.event_type),
                scheduled_pt_ms=evt.scheduled_pt_ms,
                duration_ms=evt.duration_ms,
                dependencies=list(evt.dependencies),
                triggered_issues=list(evt.triggered_issues),
                target_roles=list(evt.target_roles),
                role_descriptions=dict(evt.role_descriptions),
                system_effects=[
                    SystemEffect(
                        system_id=e.system_id,
                        operational_state=e.operational_state,
                        power_state=e.power_state,
                        set_all_power=e.set_all_power,
                    )
                    for e in evt.system_effects
                ],
                domain_effects=[
                    DomainEffect(domain_id=de.domain_id, threat_level=de.threat_level)
                    for de in evt.domain_effects
                ],
            ),
        )
    return events


def load_scenario_issues(content: ScenarioContent) -> list[TrackedIssue]:
    """Convert scenario issue definitions to engine TrackedIssue objects."""
    issues: list[TrackedIssue] = []
    for iss in content.issues:
        issues.append(
            TrackedIssue(
                id=iss.id,
                title=iss.title,
                description=iss.description,
                trigger_mode=TriggerMode(iss.trigger_mode),
                trigger_time_pt_ms=iss.trigger_time_pt_ms,
                trigger_event_id=iss.trigger_event_id,
                auto_resolve_ms=iss.auto_resolve_ms,
            ),
        )
    return issues


def load_decision_templates(
    content: ScenarioContent,
) -> list[DecisionTemplate]:
    """Convert scenario decision template defs to engine DecisionTemplate."""
    return [
        DecisionTemplate(
            id=dt.id,
            title=dt.title,
            description=dt.description,
            issue_id=dt.issue_id,
            question_type=dt.question_type,
            options=[
                DecisionOptionSnapshot(
                    id=o.id,
                    label=o.label,
                    score=o.score,
                    stress_delta=o.stress_delta,
                    system_effects=[
                        SystemEffect(
                            system_id=e.system_id,
                            operational_state=e.operational_state,
                            power_state=e.power_state,
                            set_all_power=e.set_all_power,
                        )
                        for e in o.system_effects
                    ],
                    targets_system=o.targets_system,
                    max_plays=o.max_plays,
                    role=None,
                )
                for o in dt.options
            ],
            completion_mode=dt.completion_mode,
            timeout_ms=dt.timeout_ms,
            target_roles=list(dt.target_roles),
            forced_option_ids=list(dt.forced_option_ids),
            max_selections=dt.max_selections,
            stress_delta=dt.stress_delta,
        )
        for dt in content.decision_templates
    ]


def load_system_states(content: ScenarioContent) -> list[SystemState]:
    """Convert scenario system state definitions to engine SystemState objects."""
    return [
        SystemState(
            system_id=s.system_id,
            label=s.label or s.system_id.upper().replace("_", " "),
            category=s.category,
            operational=s.operational_state or "green",
            power=s.power_state if s.power_state is not None else False,
        )
        for s in content.initial_system_states
    ]


def load_warfare_domains(content: ScenarioContent) -> list[WarfareDomainState]:
    """Convert scenario warfare domain definitions to engine WarfareDomainState objects."""
    return [
        WarfareDomainState(
            domain_id=d.domain_id,
            label=d.label or d.domain_id.upper(),
            threat_level=d.initial_threat_level,
        )
        for d in content.initial_warfare_domains
    ]


def generate_events_from_turns(turns: list[TurnDefinition]) -> list[ScenarioEventDef]:
    """Generate ScenarioEventDef objects from turn-based authoring.

    Each turn inject becomes a ScenarioEventDef. Turn-level system/domain
    effects attach to the first event of each turn. If a turn has no injects
    but has effects, a marker event is created.
    """
    events: list[ScenarioEventDef] = []
    for turn in turns:
        ti = turn.turn_index
        has_injects = bool(turn.injects)
        has_effects = bool(turn.system_effects_on_start or turn.domain_effects_on_start)

        if not has_injects and has_effects:
            events.append(
                ScenarioEventDef(
                    id=f"turn-{ti}-marker",
                    title=turn.title or f"Turn {ti}",
                    description="",
                    event_type="informational",
                    scheduled_pt_ms=0,
                    system_effects=list(turn.system_effects_on_start),
                    domain_effects=list(turn.domain_effects_on_start),
                ),
            )
            continue

        for inject_idx, inject in enumerate(turn.injects):
            is_first = inject_idx == 0
            if is_first and turn.has_decisions:
                event_type = "decision"
            else:
                event_type = "informational"

            events.append(
                ScenarioEventDef(
                    id=f"turn-{ti}-inject-{inject_idx}",
                    title=turn.title or f"Turn {ti} Inject {inject_idx}",
                    description=inject.text,
                    event_type=event_type,
                    scheduled_pt_ms=0,
                    target_roles=list(inject.target_roles),
                    role_descriptions=dict(inject.role_descriptions),
                    system_effects=list(turn.system_effects_on_start) if is_first else [],
                    domain_effects=list(turn.domain_effects_on_start) if is_first else [],
                ),
            )
    return events


def generate_decisions_from_turns(
    turns: list[TurnDefinition],
    blue_card_catalog: list[dict] | None = None,
) -> list[DecisionTemplateDef]:
    """Generate DecisionTemplateDef objects from turn-based authoring.

    Each turn with has_decisions=True and available_cards produces one
    DecisionTemplateDef. Card labels are resolved from the catalog if provided.
    """
    catalog_lookup: dict[str, dict] = {}
    if blue_card_catalog:
        for card in blue_card_catalog:
            catalog_lookup[card["id"]] = card

    decisions: list[DecisionTemplateDef] = []
    for turn in turns:
        if not turn.has_decisions or not turn.available_cards:
            continue

        ti = turn.turn_index
        options: list[DecisionOptionDef] = []
        for card_cfg in turn.available_cards:
            catalog_entry = catalog_lookup.get(card_cfg.card_id)
            if catalog_entry:
                label = catalog_entry.get("title", card_cfg.card_id)
                targets_system = catalog_entry.get("targets_system", False)
            else:
                label = card_cfg.card_id
                targets_system = False

            options.append(
                DecisionOptionDef(
                    id=card_cfg.card_id,
                    label=label,
                    score=card_cfg.score,
                    stress_delta=card_cfg.stress_delta,
                    system_effects=list(card_cfg.system_effects),
                    targets_system=targets_system,
                    max_plays=card_cfg.max_plays,
                ),
            )

        decisions.append(
            DecisionTemplateDef(
                id=f"turn-{ti}-decision",
                title=turn.title or f"Turn {ti} Decision",
                description="",
                issue_id=f"turn-{ti}-issue",
                question_type="multi_choice",
                options=options,
                completion_mode="first_response",
                max_selections=turn.max_selections,
                stress_delta=turn.base_stress_delta,
            ),
        )
    return decisions


def merge_system_states(
    domain_systems: list[dict],
    scenario_overrides: list[SystemStateDef],
) -> list[SystemStateDef]:
    """Merge domain config base systems with scenario-level overrides.

    Domain systems provide defaults (green, power off). Scenario overrides
    replace matching system_id entries.
    """
    override_map = {s.system_id: s for s in scenario_overrides}
    result: list[SystemStateDef] = []

    for ds in domain_systems:
        sid = ds["system_id"]
        if sid in override_map:
            result.append(override_map.pop(sid))
        else:
            result.append(
                SystemStateDef(
                    system_id=sid,
                    label=ds.get("label", ""),
                    category=ds.get("category", "system"),
                    operational_state=ds.get("operational_state", "green"),
                    power_state=ds.get("power_state", False),
                ),
            )

    # Append any overrides for systems not in domain_systems
    for remaining in override_map.values():
        result.append(remaining)

    return result


def merge_warfare_domains(
    domain_wds: list[dict],
    scenario_overrides: list[WarfareDomainDef],
) -> list[WarfareDomainDef]:
    """Merge domain config warfare domains with scenario-level overrides.

    Domain warfare domains provide defaults. Scenario overrides replace
    matching domain_id entries.
    """
    override_map = {wd.domain_id: wd for wd in scenario_overrides}
    result: list[WarfareDomainDef] = []

    for dwd in domain_wds:
        did = dwd["domain_id"]
        if did in override_map:
            result.append(override_map.pop(did))
        else:
            result.append(
                WarfareDomainDef(
                    domain_id=did,
                    label=dwd.get("label", ""),
                    initial_threat_level=dwd.get("initial_threat_level", "green"),
                ),
            )

    # Append any overrides for domains not in domain_wds
    for remaining in override_map.values():
        result.append(remaining)

    return result


def _compute_max_possible_score(content: ScenarioContent) -> float:
    """Sum the best achievable score across all decision templates in the sequence.

    For multi-choice without max_selections, only positive-score options count
    (a rational player would never voluntarily pick a negative-score card).
    """
    seq_ids = set(content.decision_sequence)
    total = 0.0
    for dt in content.decision_templates:
        if seq_ids and dt.id not in seq_ids:
            continue
        scores = sorted((o.score for o in dt.options), reverse=True)
        if dt.question_type == "single_choice":
            total += scores[0] if scores else 0.0
        elif dt.max_selections is not None:
            total += sum(scores[: dt.max_selections])
        else:
            total += sum(s for s in scores if s > 0)
    return total


def build_engine_config(
    exercise_id: int,
    title: str,
    content: ScenarioContent,
    *,
    practice_mode: bool = False,
) -> EngineConfig:
    """Build a full EngineConfig from a validated ScenarioContent."""
    context = ScenarioContext(
        title=title,
        description="",
        briefing=content.briefing,
        objectives=list(content.objectives),
        rules=list(content.rules),
        roles=[RoleInfo(id=r.id, label=r.label, player_type=r.player_type) for r in content.roles],
        score_tier_thresholds=dict(content.score_tier_thresholds),
    )
    mode_config = dict(content.game_mode_config)
    if content.decision_sequence:
        mode_config.setdefault("decision_sequence", list(content.decision_sequence))
    if content.score_tier_thresholds:
        mode_config.setdefault("score_tier_thresholds", dict(content.score_tier_thresholds))
    mode_config.setdefault(
        "max_possible_score",
        _compute_max_possible_score(content),
    )
    game_mode = create_game_mode(content.game_mode, mode_config)
    # Detect turn-based authoring: turns with authored injects or cards
    use_turns = bool(
        content.turns
        and any(t.injects or t.available_cards for t in content.turns)
    )

    if use_turns:
        # Generate events/decisions from turns, then convert via existing loaders
        turn_event_defs = generate_events_from_turns(content.turns)
        turn_decision_defs = generate_decisions_from_turns(content.turns)

        # Build synthetic issues for each decision turn
        turn_issue_defs: list[ScenarioIssueDef] = []
        for turn in content.turns:
            if turn.has_decisions and turn.available_cards:
                turn_issue_defs.append(
                    ScenarioIssueDef(
                        id=f"turn-{turn.turn_index}-issue",
                        title=f"Turn {turn.turn_index} Issue",
                        trigger_mode="manual",
                    ),
                )

        # Create a temporary content with the generated defs for the loaders
        turn_content = content.model_copy(
            update={
                "events": turn_event_defs,
                "decision_templates": turn_decision_defs,
                "issues": turn_issue_defs,
            },
        )
        events = load_scenario_events(turn_content)
        issues = load_scenario_issues(turn_content)
        decision_templates = load_decision_templates(turn_content)
        # Update decision_sequence from generated decisions
        decision_sequence = [dt.id for dt in turn_decision_defs]
        if decision_sequence:
            mode_config.setdefault("decision_sequence", decision_sequence)
            mode_config["max_possible_score"] = _compute_max_possible_score(turn_content)
            game_mode = create_game_mode(content.game_mode, mode_config)
    else:
        events = load_scenario_events(content)
        issues = load_scenario_issues(content)
        decision_templates = load_decision_templates(content)

    return EngineConfig(
        exercise_id=exercise_id,
        title=title,
        time_factor=content.default_time_factor,
        events=events,
        issues=issues,
        decision_templates=decision_templates,
        context=context,
        game_mode=game_mode,
        initial_system_states=load_system_states(content),
        initial_warfare_domains=load_warfare_domains(content),
    )
