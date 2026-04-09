"""Typed state change dicts emitted by the engine.

Each TypedDict corresponds to one kind of change that the engine
broadcasts to listeners. Using TypedDict (not dataclass) keeps them
JSON-serialisable and compatible with the existing dict-based API.
"""
from __future__ import annotations

from typing import Any, TypedDict


class PhaseChange(TypedDict):
    type: str          # "phase_change"
    action: str        # started | paused | completed | reset
    phase: str         # setup | running | paused | completed
    time: dict[str, Any]


class InjectChange(TypedDict):
    type: str          # "inject_change"
    inject_id: str
    action: str        # activated | started | completed | force_triggered | cancelled
    lifecycle: str     # scheduled | pending | running | paused | completed | cancelled
    title: str


class DefectChange(TypedDict):
    type: str          # "defect_change"
    defect_id: str
    action: str        # activated | mitigated | resolved | auto_resolve_expired
    lifecycle: str     # inactive | active | mitigated | resolved
    title: str
    released: bool


class DecisionOpened(TypedDict):
    type: str          # "decision_opened"
    decision_id: str
    title: str
    question_type: str
    options: list[dict[str, Any]]
    target_roles: list[str]
    timeout_ms: float


class DecisionClosed(TypedDict):
    type: str          # "decision_closed"
    decision_id: str
    title: str


class SpeedChange(TypedDict):
    type: str          # "speed_change"
    factor: float


# Union of all change types for type-narrowing on `change["type"]`.
StateChange = PhaseChange | InjectChange | DefectChange | DecisionOpened | DecisionClosed | SpeedChange
