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


class EventChange(TypedDict):
    type: str          # "event_change"
    event_id: str
    action: str        # activated | started | completed | force_triggered | cancelled
    lifecycle: str     # scheduled | pending | running | paused | completed | cancelled
    title: str


class IssueChange(TypedDict):
    type: str          # "issue_change"
    issue_id: str
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
    selected_option_ids: list[str]


class SpeedChange(TypedDict):
    type: str          # "speed_change"
    factor: float


class ScoreChange(TypedDict):
    type: str          # "score_change"
    total_score: float
    penalty_ms: float
    next_decision_time_ms: int
    turn_number: int


class RecommendationSubmitted(TypedDict):
    type: str          # "recommendation_submitted"
    decision_id: str
    participant_id: str
    option_id: str


class ForcedCardApplied(TypedDict):
    type: str          # "forced_card_applied"
    decision_id: str
    forced_option_id: str
    reason: str


# Union of all change types for type-narrowing on `change["type"]`.
StateChange = (
    PhaseChange | EventChange | IssueChange
    | DecisionOpened | DecisionClosed | SpeedChange
    | ScoreChange | RecommendationSubmitted | ForcedCardApplied
)
