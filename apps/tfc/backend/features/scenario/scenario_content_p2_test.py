"""Tests for P2 scenario content additions: timeout_ms, briefing, objectives, rules."""
from features.scenario.scenario_content import (
    DecisionTemplateDef,
    ScenarioContent,
)


def test_decision_template_default_timeout() -> None:
    dt = DecisionTemplateDef(
        id="dt1", title="T", issue_id="i1", question_type="single_choice",
    )
    assert dt.timeout_ms == 0


def test_decision_template_custom_timeout() -> None:
    dt = DecisionTemplateDef(
        id="dt1", title="T", issue_id="i1", question_type="single_choice",
        timeout_ms=5000.0,
    )
    assert dt.timeout_ms == 5000.0


def test_scenario_content_briefing_defaults() -> None:
    content = ScenarioContent()
    assert content.briefing == ""
    assert content.objectives == []
    assert content.rules == []


def test_scenario_content_with_briefing() -> None:
    content = ScenarioContent(
        briefing="Emergency scenario briefing",
        objectives=["Objective 1", "Objective 2"],
        rules=["Rule A"],
    )
    assert content.briefing == "Emergency scenario briefing"
    assert len(content.objectives) == 2
    assert content.rules == ["Rule A"]


def test_scenario_content_round_trip() -> None:
    data = {
        "events": [],
        "issues": [],
        "decision_templates": [
            {
                "id": "dt1", "title": "D1", "issue_id": "i1",
                "question_type": "free_text", "timeout_ms": 3000,
            },
        ],
        "briefing": "Brief",
        "objectives": ["O1"],
        "rules": ["R1"],
    }
    content = ScenarioContent.model_validate(data)
    assert content.decision_templates[0].timeout_ms == 3000
    assert content.briefing == "Brief"
