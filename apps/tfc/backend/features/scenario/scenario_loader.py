"""Converts ScenarioContent into engine-ready runtime objects.

Bridges the gap between the authored scenario JSON and the engine's
ScheduledEvent / TrackedIssue / EngineConfig dataclasses.
"""
from __future__ import annotations

from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import EngineConfig
from engine.issue_manager import TrackedIssue, TriggerMode
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
                etbol_ms=iss.etbol_ms,
            ),
        )
    return issues


def build_engine_config(
    exercise_id: int,
    title: str,
    content: ScenarioContent,
) -> EngineConfig:
    """Build a full EngineConfig from a validated ScenarioContent."""
    return EngineConfig(
        exercise_id=exercise_id,
        title=title,
        time_factor=content.default_time_factor,
        events=load_scenario_events(content),
        issues=load_scenario_issues(content),
    )
