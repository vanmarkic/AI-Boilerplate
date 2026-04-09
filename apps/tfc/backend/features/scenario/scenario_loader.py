"""Converts ScenarioContent into engine-ready runtime objects.

Bridges the gap between the authored scenario JSON and the engine's
ScheduledInject / TrackedDefect / EngineConfig dataclasses.
"""
from __future__ import annotations

from engine.inject_scheduler import ExecutionMode, InjectType, ScheduledInject
from engine.exercise_engine import (
    DecisionTemplate,
    EngineConfig,
    ScenarioContext,
)
from engine.defect_manager import TrackedDefect, TriggerMode
from features.scenario.scenario_content import ScenarioContent


def load_scenario_injects(content: ScenarioContent) -> list[ScheduledInject]:
    """Convert scenario inject definitions to engine ScheduledInject objects."""
    injects: list[ScheduledInject] = []
    for inj in content.injects:
        injects.append(
            ScheduledInject(
                id=inj.id,
                title=inj.title,
                description=inj.description,
                inject_type=InjectType(inj.inject_type),
                scheduled_pt_ms=inj.scheduled_pt_ms,
                duration_ms=inj.duration_ms,
                dependencies=list(inj.dependencies),
                triggered_defects=list(inj.triggered_defects),
                execution_mode=ExecutionMode(inj.execution_mode),
            ),
        )
    return injects


def load_scenario_defects(content: ScenarioContent) -> list[TrackedDefect]:
    """Convert scenario defect definitions to engine TrackedDefect objects."""
    defects: list[TrackedDefect] = []
    for defect in content.defects:
        defects.append(
            TrackedDefect(
                id=defect.id,
                title=defect.title,
                description=defect.description,
                trigger_mode=TriggerMode(defect.trigger_mode),
                trigger_time_pt_ms=defect.trigger_time_pt_ms,
                trigger_inject_id=defect.trigger_inject_id,
                auto_resolve_ms=defect.auto_resolve_ms,
            ),
        )
    return defects


def load_decision_templates(
    content: ScenarioContent,
) -> list[DecisionTemplate]:
    """Convert scenario decision template defs to engine DecisionTemplate."""
    return [
        DecisionTemplate(
            id=dt.id,
            title=dt.title,
            description=dt.description,
            defect_id=dt.defect_id,
            question_type=dt.question_type,
            options=[
                {"id": o.id, "label": o.label, "score": o.score}
                for o in dt.options
            ],
            completion_mode=dt.completion_mode,
            timeout_ms=dt.timeout_ms,
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
    )
    return EngineConfig(
        exercise_id=exercise_id,
        title=title,
        time_factor=content.default_time_factor,
        injects=load_scenario_injects(content),
        defects=load_scenario_defects(content),
        decision_templates=load_decision_templates(content),
        context=context,
    )
