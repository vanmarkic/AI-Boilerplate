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
    defect_id: str | None = None  # linked defect
    question_type: str  # single_choice, multi_choice, free_text, scale
    options: list[DecisionOptionDef] = []
    completion_mode: str = "first_response"
    timeout_ms: float = 0  # 0 = no timeout


class ScenarioInjectDef(BaseModel):
    """Definition of a single inject within a scenario."""
    id: str
    title: str
    description: str = ""
    inject_type: str  # informational, operational, decision
    scheduled_pt_ms: float  # when to trigger in play time
    duration_ms: float | None = None  # auto-complete after duration
    dependencies: list[str] = []  # inject IDs that must complete first
    triggered_defects: list[str] = []  # defect IDs activated on completion
    execution_mode: str = "automatic"  # automatic | manual


class ScenarioDefectDef(BaseModel):
    """Definition of a single defect within a scenario."""
    id: str
    title: str
    description: str = ""
    trigger_mode: str  # time-based, inject-based, manual
    trigger_time_pt_ms: float | None = None
    trigger_inject_id: str | None = None
    auto_resolve_pt_ms: float = 0  # 0 = no PT auto-resolve
    auto_resolve_rt_ms: float = 0  # 0 = no RT auto-resolve


class ScenarioPhaseDef(BaseModel):
    """Definition of a phase grouping injects within a scenario."""
    id: str
    title: str
    description: str = ""
    duration_ms: float | None = None  # auto-advance after duration
    injects: list[str] = []  # inject IDs in this phase


class ScenarioContent(BaseModel):
    """Top-level scenario definition validated against this schema.

    This is the structured JSON stored in the ``tfc_scenarios.content``
    column. The GM authors this via the scenario editor; the engine
    loader converts it into runtime objects at exercise start.
    """
    phases: list[ScenarioPhaseDef] = []
    injects: list[ScenarioInjectDef] = []
    defects: list[ScenarioDefectDef] = []
    decision_templates: list[DecisionTemplateDef] = []
    default_time_factor: float = 1.0
    briefing: str = ""
    objectives: list[str] = []
    rules: list[str] = []

    def validate(self) -> list[str]:
        """Return a list of referential integrity errors; empty means valid."""
        errors: list[str] = []
        inject_ids = {inj.id for inj in self.injects}
        defect_ids = {d.id for d in self.defects}

        for inj in self.injects:
            for dep in inj.dependencies:
                if dep not in inject_ids:
                    errors.append(
                        f"Inject '{inj.id}' depends on unknown inject '{dep}'"
                    )
            for td in inj.triggered_defects:
                if td not in defect_ids:
                    errors.append(
                        f"Inject '{inj.id}' triggers unknown defect '{td}'"
                    )

        for d in self.defects:
            if d.trigger_inject_id and d.trigger_inject_id not in inject_ids:
                errors.append(
                    f"Defect '{d.id}' trigger_inject_id references unknown inject"
                    f" '{d.trigger_inject_id}'"
                )

        for dt in self.decision_templates:
            if dt.defect_id and dt.defect_id not in defect_ids:
                errors.append(
                    f"Decision '{dt.id}' defect_id references unknown defect"
                    f" '{dt.defect_id}'"
                )

        return errors
