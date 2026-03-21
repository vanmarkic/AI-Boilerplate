"""Tests for scenario content schema and loader."""

import pytest
from pydantic import ValidationError

from engine.event_scheduler import EventType, ScheduledEvent
from engine.exercise_engine import EngineConfig, ExerciseEngine
from engine.issue_manager import TrackedIssue, TriggerMode
from features.scenario.scenario_content import (
    DecisionTemplateDef,
    RoleDef,
    ScenarioContent,
    ScenarioEventDef,
    ScenarioIssueDef,
)
from features.scenario.scenario_loader import (
    build_engine_config,
    load_scenario_events,
    load_scenario_issues,
)


def _full_content() -> dict:
    """Return a complete scenario content dict for testing."""
    return {
        "phases": [
            {
                "id": "phase-1",
                "title": "Phase 1",
                "description": "Opening phase",
                "duration_ms": 600_000,
                "events": ["evt-1", "evt-2"],
            },
        ],
        "events": [
            {
                "id": "evt-1",
                "title": "Briefing",
                "description": "Initial briefing",
                "event_type": "informational",
                "scheduled_pt_ms": 0,
                "duration_ms": 60_000,
                "dependencies": [],
                "triggered_issues": ["iss-1"],
            },
            {
                "id": "evt-2",
                "title": "System Failure",
                "description": "Main system goes down",
                "event_type": "operational",
                "scheduled_pt_ms": 120_000,
                "duration_ms": None,
                "dependencies": ["evt-1"],
                "triggered_issues": [],
            },
        ],
        "issues": [
            {
                "id": "iss-1",
                "title": "Comms Down",
                "description": "Communications failure",
                "trigger_mode": "event-based",
                "trigger_event_id": "evt-1",
                "auto_resolve_ms": 300_000,
            },
            {
                "id": "iss-2",
                "title": "Power Loss",
                "description": "Generator offline",
                "trigger_mode": "time-based",
                "trigger_time_pt_ms": 180_000,
                "auto_resolve_ms": 0,
            },
        ],
        "decision_templates": [
            {
                "id": "dec-1",
                "title": "Evacuate?",
                "description": "Decide whether to evacuate",
                "issue_id": "iss-1",
                "question_type": "single_choice",
                "options": [
                    {"id": "opt-a", "label": "Yes", "score": 10.0, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None},
                    {"id": "opt-b", "label": "No", "score": 0.0, "stress_delta": 0, "system_effects": [], "targets_system": False, "max_plays": 1, "role": None},
                ],
                "completion_mode": "first_response",
            },
        ],
        "default_time_factor": 2.0,
        "roles": [
            {"id": "co", "label": "Commanding Officer", "player_type": "decision_maker"},
            {"id": "nav", "label": "Navigator", "player_type": "advisor"},
        ],
    }


# ── ScenarioContent validation ──────────────────────────────────────────


def test_scenario_content_validates_complete_json() -> None:
    content = ScenarioContent.model_validate(_full_content())
    assert len(content.events) == 2
    assert len(content.issues) == 2
    assert len(content.phases) == 1
    assert len(content.decision_templates) == 1
    assert content.default_time_factor == 2.0


def test_scenario_content_empty_rejected() -> None:
    """Empty content is no longer valid — roles are required."""
    with pytest.raises(ValidationError, match="at least one role"):
        ScenarioContent.model_validate({})


def test_scenario_event_def_validation() -> None:
    evt = ScenarioEventDef.model_validate(
        {
            "id": "e1",
            "title": "Test",
            "event_type": "decision",
            "scheduled_pt_ms": 5000,
        }
    )
    assert evt.description == ""
    assert evt.duration_ms is None
    assert evt.dependencies == []
    assert evt.triggered_issues == []


def test_scenario_event_def_missing_required_fields() -> None:
    with pytest.raises(ValidationError):
        ScenarioEventDef.model_validate({"id": "e1"})


def test_scenario_issue_def_trigger_modes() -> None:
    time_issue = ScenarioIssueDef.model_validate(
        {
            "id": "i1",
            "title": "Time Issue",
            "trigger_mode": "time-based",
            "trigger_time_pt_ms": 10_000,
        }
    )
    assert time_issue.trigger_mode == "time-based"
    assert time_issue.trigger_time_pt_ms == 10_000

    event_issue = ScenarioIssueDef.model_validate(
        {
            "id": "i2",
            "title": "Event Issue",
            "trigger_mode": "event-based",
            "trigger_event_id": "evt-1",
        }
    )
    assert event_issue.trigger_mode == "event-based"
    assert event_issue.trigger_event_id == "evt-1"

    manual_issue = ScenarioIssueDef.model_validate(
        {
            "id": "i3",
            "title": "Manual Issue",
            "trigger_mode": "manual",
        }
    )
    assert manual_issue.trigger_mode == "manual"
    assert manual_issue.auto_resolve_ms == 0


# ── Loader tests ─────────────────────────────────────────────────────────


def test_load_scenario_events_converts_all() -> None:
    content = ScenarioContent.model_validate(_full_content())
    events = load_scenario_events(content)
    assert len(events) == 2
    assert all(isinstance(e, ScheduledEvent) for e in events)

    briefing = next(e for e in events if e.id == "evt-1")
    assert briefing.title == "Briefing"
    assert briefing.event_type == EventType.INFORMATIONAL
    assert briefing.scheduled_pt_ms == 0
    assert briefing.duration_ms == 60_000
    assert briefing.triggered_issues == ["iss-1"]

    failure = next(e for e in events if e.id == "evt-2")
    assert failure.event_type == EventType.OPERATIONAL
    assert failure.dependencies == ["evt-1"]


def test_load_scenario_issues_converts_all() -> None:
    content = ScenarioContent.model_validate(_full_content())
    issues = load_scenario_issues(content)
    assert len(issues) == 2
    assert all(isinstance(i, TrackedIssue) for i in issues)

    comms = next(i for i in issues if i.id == "iss-1")
    assert comms.trigger_mode == TriggerMode.EVENT_BASED
    assert comms.trigger_event_id == "evt-1"
    assert comms.auto_resolve_ms == 300_000

    power = next(i for i in issues if i.id == "iss-2")
    assert power.trigger_mode == TriggerMode.TIME_BASED
    assert power.trigger_time_pt_ms == 180_000


def test_build_engine_config_produces_valid_config() -> None:
    content = ScenarioContent.model_validate(_full_content())
    config = build_engine_config(exercise_id=42, title="Test Ex", content=content)
    assert isinstance(config, EngineConfig)
    assert config.exercise_id == 42
    assert config.title == "Test Ex"
    assert config.time_factor == 2.0
    assert len(config.events) == 2
    assert len(config.issues) == 2


def test_round_trip_content_to_engine() -> None:
    """Create content, build config, verify engine can start."""
    content = ScenarioContent.model_validate(_full_content())
    config = build_engine_config(exercise_id=1, title="Round Trip", content=content)
    engine = ExerciseEngine(config)
    snap = engine.snapshot()
    assert snap["exercise_id"] == 1
    assert len(snap["events"]) == 2
    assert len(snap["issues"]) == 2
    assert snap["phase"] == "setup"


# ── Role validation invariants ──────────────────────────────────────────

VALID_ROLES = [
    {"id": "co", "label": "CO", "player_type": "decision_maker"},
    {"id": "nav", "label": "Nav", "player_type": "advisor"},
]


class TestRolesRequired:
    """Every scenario must define at least one role."""

    def test_empty_roles_rejected(self) -> None:
        with pytest.raises(ValidationError, match="at least one role"):
            ScenarioContent(roles=[])

    def test_valid_roles_accepted(self) -> None:
        sc = ScenarioContent(
            roles=[
                RoleDef(id="co", label="CO", player_type="decision_maker"),
                RoleDef(id="nav", label="Nav", player_type="advisor"),
            ]
        )
        assert len(sc.roles) == 2


class TestDecisionMakerRequired:
    """At least one role must have player_type='decision_maker'."""

    def test_no_decision_maker_rejected(self) -> None:
        with pytest.raises(ValidationError, match="decision_maker"):
            ScenarioContent(roles=[RoleDef(id="nav", label="Nav", player_type="advisor")])

    def test_decision_maker_present_accepted(self) -> None:
        sc = ScenarioContent(roles=[RoleDef(id="co", label="CO", player_type="decision_maker")])
        assert sc.roles[0].player_type == "decision_maker"


class TestTargetRolesExist:
    """Decision template target_roles must reference defined role IDs."""

    def test_unknown_target_role_rejected(self) -> None:
        with pytest.raises(ValidationError, match="nonexistent"):
            ScenarioContent(
                roles=[
                    RoleDef(id="co", label="CO", player_type="decision_maker"),
                ],
                decision_templates=[
                    DecisionTemplateDef(
                        id="d1",
                        title="T",
                        issue_id="i1",
                        question_type="single_choice",
                        target_roles=["nonexistent"],
                    ),
                ],
            )

    def test_valid_target_role_accepted(self) -> None:
        sc = ScenarioContent(
            roles=[
                RoleDef(id="co", label="CO", player_type="decision_maker"),
                RoleDef(id="nav", label="Nav", player_type="advisor"),
            ],
            decision_templates=[
                DecisionTemplateDef(
                    id="d1",
                    title="T",
                    issue_id="i1",
                    question_type="single_choice",
                    target_roles=["co"],
                ),
            ],
        )
        assert sc.decision_templates[0].target_roles == ["co"]

    def test_empty_target_roles_accepted(self) -> None:
        """Untargeted decisions (target_roles=[]) are valid."""
        sc = ScenarioContent(
            roles=[
                RoleDef(id="co", label="CO", player_type="decision_maker"),
            ],
            decision_templates=[
                DecisionTemplateDef(
                    id="d1",
                    title="T",
                    issue_id="i1",
                    question_type="single_choice",
                    target_roles=[],
                ),
            ],
        )
        assert sc.decision_templates[0].target_roles == []


class TestEventTargetRolesExist:
    """Event target_roles and role_descriptions must reference defined role IDs."""

    def test_unknown_event_target_role_rejected(self) -> None:
        with pytest.raises(ValidationError, match="nonexistent"):
            ScenarioContent(
                roles=[
                    RoleDef(id="co", label="CO", player_type="decision_maker"),
                ],
                events=[
                    ScenarioEventDef(
                        id="e1",
                        title="T",
                        event_type="informational",
                        scheduled_pt_ms=0,
                        target_roles=["nonexistent"],
                    ),
                ],
            )

    def test_unknown_role_description_key_rejected(self) -> None:
        with pytest.raises(ValidationError, match="role_description for unknown"):
            ScenarioContent(
                roles=[
                    RoleDef(id="co", label="CO", player_type="decision_maker"),
                ],
                events=[
                    ScenarioEventDef(
                        id="e1",
                        title="T",
                        event_type="informational",
                        scheduled_pt_ms=0,
                        role_descriptions={"ghost": "should fail"},
                    ),
                ],
            )

    def test_valid_event_target_roles_accepted(self) -> None:
        sc = ScenarioContent(
            roles=[
                RoleDef(id="co", label="CO", player_type="decision_maker"),
                RoleDef(id="nav", label="Nav", player_type="advisor"),
            ],
            events=[
                ScenarioEventDef(
                    id="e1",
                    title="T",
                    event_type="informational",
                    scheduled_pt_ms=0,
                    target_roles=["nav"],
                    role_descriptions={"nav": "Nav-specific text", "co": "CO text"},
                ),
            ],
        )
        assert sc.events[0].target_roles == ["nav"]
        assert sc.events[0].role_descriptions["nav"] == "Nav-specific text"


class TestCollaborativeRoleMinimum:
    """Simple collaborative mode requires at least 2 playable roles."""

    def test_single_role_rejected(self) -> None:
        with pytest.raises(ValidationError, match="at least 2 playable roles"):
            ScenarioContent(
                game_mode="simple_collaborative",
                roles=[RoleDef(id="co", label="CO", player_type="decision_maker")],
            )

    def test_two_roles_accepted(self) -> None:
        sc = ScenarioContent(
            game_mode="simple_collaborative",
            roles=[
                RoleDef(id="co", label="CO", player_type="decision_maker"),
                RoleDef(id="ops", label="OPS", player_type="advisor"),
            ],
        )
        assert len(sc.roles) == 2

    def test_three_roles_accepted(self) -> None:
        sc = ScenarioContent(
            game_mode="simple_collaborative",
            roles=[
                RoleDef(id="co", label="CO", player_type="decision_maker"),
                RoleDef(id="ops", label="OPS", player_type="advisor"),
                RoleDef(id="nav", label="NAV", player_type="advisor"),
            ],
        )
        assert len(sc.roles) == 3

    def test_four_roles_accepted(self) -> None:
        sc = ScenarioContent(
            game_mode="simple_collaborative",
            roles=[
                RoleDef(id="co", label="CO", player_type="decision_maker"),
                RoleDef(id="ops", label="OPS", player_type="advisor"),
                RoleDef(id="nav", label="NAV", player_type="advisor"),
                RoleDef(id="pwo", label="PWO", player_type="advisor"),
            ],
        )
        assert len(sc.roles) == 4

    def test_classic_mode_single_role_still_valid(self) -> None:
        """Classic mode only needs 1 role (+ GM filled separately)."""
        sc = ScenarioContent(
            game_mode="classic",
            roles=[RoleDef(id="co", label="CO", player_type="decision_maker")],
        )
        assert len(sc.roles) == 1
