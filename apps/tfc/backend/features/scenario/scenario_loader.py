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
from engine.state_changes import DecisionOptionSnapshot
from features.scenario.scenario_content import ScenarioContent


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
                DecisionOptionSnapshot(id=o.id, label=o.label, score=o.score) for o in dt.options
            ],
            completion_mode=dt.completion_mode,
            timeout_ms=dt.timeout_ms,
            target_roles=list(dt.target_roles),
            forced_option_ids=list(dt.forced_option_ids),
        )
        for dt in content.decision_templates
    ]


def build_engine_config(
    exercise_id: int,
    title: str,
    content: ScenarioContent,
) -> EngineConfig:
    """Build a full EngineConfig from a validated ScenarioContent."""
    context = ScenarioContext(
        title=title,
        description="",
        briefing=content.briefing,
        objectives=list(content.objectives),
        rules=list(content.rules),
        roles=[RoleInfo(id=r.id, label=r.label, player_type=r.player_type) for r in content.roles],
    )
    mode_config = dict(content.game_mode_config)
    if content.decision_sequence:
        mode_config.setdefault("decision_sequence", list(content.decision_sequence))
    game_mode = create_game_mode(content.game_mode, mode_config)
    return EngineConfig(
        exercise_id=exercise_id,
        title=title,
        time_factor=content.default_time_factor,
        events=load_scenario_events(content),
        issues=load_scenario_issues(content),
        decision_templates=load_decision_templates(content),
        context=context,
        game_mode=game_mode,
    )
