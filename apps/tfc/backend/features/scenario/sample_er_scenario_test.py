"""Tests for the Emergency Response sample scenario."""

from __future__ import annotations

from engine.inject_scheduler import InjectType
from engine.exercise_engine import EngineConfig, ExerciseEngine
from engine.defect_manager import TriggerMode
from features.scenario.sample_er_scenario import ER_SCENARIO_CONTENT
from features.scenario.scenario_content import ScenarioContent
from features.scenario.scenario_loader import (
    build_engine_config,
    load_decision_templates,
    load_scenario_injects,
    load_scenario_defects,
)


def _content() -> ScenarioContent:
    return ScenarioContent.model_validate(ER_SCENARIO_CONTENT)


# ── Schema validation ───────────────────────────────────────────────────


def test_er_scenario_validates_against_schema() -> None:
    content = _content()
    assert len(content.phases) == 4
    assert len(content.injects) == 11
    assert len(content.defects) == 7
    assert len(content.decision_templates) == 5
    assert content.default_time_factor == 1.5
    assert content.briefing != ""
    assert len(content.objectives) == 5
    assert len(content.rules) == 3


# ── Inject loading ────────────────────────────────────────────────────────


def test_er_injects_load_with_correct_types() -> None:
    injects = load_scenario_injects(_content())
    assert len(injects) == 11

    dispatch = next(e for e in injects if e.id == "evt-dispatch")
    assert dispatch.inject_type == InjectType.INFORMATIONAL
    assert dispatch.scheduled_pt_ms == 0

    mci = next(e for e in injects if e.id == "evt-mci-activation")
    assert mci.inject_type == InjectType.DECISION
    assert "evt-dispatch" in mci.dependencies

    blood = next(e for e in injects if e.id == "evt-blood-shortage")
    assert blood.inject_type == InjectType.DECISION
    assert "iss-blood-supply" in blood.triggered_defects


def test_er_injects_are_chronologically_ordered() -> None:
    injects = load_scenario_injects(_content())
    times = [e.scheduled_pt_ms for e in injects]
    assert times == sorted(times)


# ── Defect loading ────────────────────────────────────────────────────────


def test_er_defects_load_with_correct_triggers() -> None:
    defects = load_scenario_defects(_content())
    assert len(defects) == 7

    inject_based = [i for i in defects if i.trigger_mode == TriggerMode.INJECT_BASED]
    time_based = [i for i in defects if i.trigger_mode == TriggerMode.TIME_BASED]
    assert len(inject_based) == 6
    assert len(time_based) == 1

    pio = next(i for i in defects if i.id == "iss-public-info")
    assert pio.trigger_mode == TriggerMode.TIME_BASED
    assert pio.trigger_time_pt_ms == 28 * 60_000


# ── Decision templates ───────────────────────────────────────────────────


def test_er_decisions_load_correctly() -> None:
    templates = load_decision_templates(_content())
    assert len(templates) == 5

    mci_level = next(t for t in templates if t.id == "dec-mci-level")
    assert len(mci_level.options) == 2
    assert mci_level.question_type == "single_choice"

    or_priority = next(t for t in templates if t.id == "dec-or-priority")
    assert len(or_priority.options) == 3


# ── Full engine round-trip ───────────────────────────────────────────────


def test_er_scenario_round_trip_to_engine() -> None:
    content = _content()
    config = build_engine_config(
        exercise_id=100,
        title="Hospital MCI Exercise",
        content=content,
    )
    assert isinstance(config, EngineConfig)
    assert config.exercise_id == 100
    assert config.time_factor == 1.5
    assert len(config.injects) == 11
    assert len(config.defects) == 7
    assert len(config.decision_templates) == 5

    engine = ExerciseEngine(config)
    snap = engine.snapshot()
    assert snap["exercise_id"] == 100
    assert snap["phase"] == "setup"
    assert len(snap["injects"]) == 11
    assert len(snap["defects"]) == 7


def test_er_scenario_all_defect_refs_valid() -> None:
    """Every triggered_defects ref in injects points to a real defect."""
    content = _content()
    defect_ids = {d.id for d in content.defects}
    for inj in content.injects:
        for ref in inj.triggered_defects:
            assert ref in defect_ids, f"Inject {inj.id} references unknown defect {ref}"


def test_er_scenario_all_dependency_refs_valid() -> None:
    """Every dependency ref in injects points to a real inject."""
    content = _content()
    inject_ids = {inj.id for inj in content.injects}
    for inj in content.injects:
        for dep in inj.dependencies:
            assert dep in inject_ids, f"Inject {inj.id} depends on unknown inject {dep}"


def test_er_scenario_all_decision_defect_refs_valid() -> None:
    """Every decision template references a real defect."""
    content = _content()
    defect_ids = {d.id for d in content.defects}
    for dt in content.decision_templates:
        assert dt.defect_id in defect_ids, f"Decision {dt.id} references unknown defect {dt.defect_id}"


def test_er_scenario_phase_inject_refs_valid() -> None:
    """Every inject listed in a phase exists in the injects list."""
    content = _content()
    inject_ids = {inj.id for inj in content.injects}
    for phase in content.phases:
        for ref in phase.injects:
            assert ref in inject_ids, f"Phase {phase.id} references unknown inject {ref}"
