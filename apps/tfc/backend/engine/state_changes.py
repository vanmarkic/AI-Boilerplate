"""Typed state change dicts emitted by the engine.

Each TypedDict corresponds to one kind of change that the engine
broadcasts to listeners. Using TypedDict (not dataclass) keeps them
JSON-serialisable and compatible with the existing dict-based API.
"""

from __future__ import annotations

from typing import TypedDict

# ── Snapshot shapes ──────────────────────────────────────────────


class TimeSnapshot(TypedDict):
    play_time_ms: float
    real_time_ms: float
    factor: float
    paused: bool


class EventSnapshot(TypedDict):
    id: str
    title: str
    description: str
    event_type: str
    scheduled_pt_ms: float
    duration_ms: float | None
    dependencies: list[str]
    triggered_issues: list[str]
    lifecycle: str
    started_at_pt_ms: float | None
    completed_at_pt_ms: float | None
    target_roles: list[str]
    role_descriptions: dict[str, str]


class IssueSnapshot(TypedDict):
    id: str
    title: str
    description: str
    trigger_mode: str
    auto_resolve_ms: float
    lifecycle: str
    activated_at_pt_ms: float | None
    resolved_at_pt_ms: float | None
    released: bool


class DecisionOptionSnapshot(TypedDict):
    id: str
    label: str
    score: float
    role: str | None


class DecisionSnapshot(TypedDict):
    id: str
    event_id: str | None
    issue_id: str | None
    title: str
    description: str
    question_type: str
    options: list[DecisionOptionSnapshot]
    completion_mode: str
    target_roles: list[str]
    timeout_ms: float
    max_selections: int | None
    status: str
    opened_at_pt_ms: float
    closed_at_pt_ms: float | None
    recommendations: dict[str, str]
    selected_option_ids: list[str]


class EngineSnapshot(TypedDict):
    exercise_id: int
    title: str
    phase: str
    time: TimeSnapshot
    events: list[EventSnapshot]
    issues: list[IssueSnapshot]
    decisions: list[DecisionSnapshot]
    score: dict[str, object] | None


class PresenceEntry(TypedDict):
    id: str
    display_name: str
    role: str | None
    connected: bool


# ── State changes ────────────────────────────────────────────────


class PhaseChange(TypedDict):
    type: str  # "phase_change"
    action: str  # started | paused | completed | reset
    phase: str  # setup | running | paused | completed
    time: TimeSnapshot


class EventChange(TypedDict):
    """Domain term: 'inject change'. Code uses 'event_change'."""

    type: str  # "event_change"
    event_id: str  # domain: inject_id
    action: str  # activated | started | completed | force_triggered | cancelled
    lifecycle: str  # scheduled | pending | running | paused | completed | cancelled
    title: str
    target_roles: list[str]
    role_descriptions: dict[str, str]


class IssueChange(TypedDict):
    """Domain term: 'defect change'. Code uses 'issue_change'."""

    type: str  # "issue_change"
    issue_id: str  # domain: defect_id
    action: str  # activated | mitigated | resolved | auto_resolve_expired
    lifecycle: str  # inactive | active | mitigated | resolved
    title: str
    released: bool


class DecisionOpened(TypedDict):
    type: str  # "decision_opened"
    id: str
    decision_id: str
    event_id: str | None
    issue_id: str | None
    title: str
    description: str
    question_type: str
    options: list[DecisionOptionSnapshot]
    completion_mode: str
    target_roles: list[str]
    timeout_ms: float
    max_selections: int | None
    status: str
    opened_at_pt_ms: float
    closed_at_pt_ms: float | None
    recommendations: dict[str, str]


class DecisionClosed(TypedDict):
    type: str  # "decision_closed"
    decision_id: str
    title: str
    selected_option_ids: list[str]


class SpeedChange(TypedDict):
    type: str  # "speed_change"
    factor: float


class ScoreChange(TypedDict):
    type: str  # "score_change"
    total_score: float
    penalty_ms: float
    next_decision_time_ms: int
    turn_number: int


class RecommendationSubmitted(TypedDict):
    type: str  # "recommendation_submitted"
    decision_id: str
    participant_id: str
    option_id: str


class ForcedCardApplied(TypedDict):
    type: str  # "forced_card_applied"
    decision_id: str
    forced_option_id: str
    reason: str


# Union of all change types for type-narrowing on `change["type"]`.
StateChange = (
    PhaseChange
    | EventChange
    | IssueChange
    | DecisionOpened
    | DecisionClosed
    | SpeedChange
    | ScoreChange
    | RecommendationSubmitted
    | ForcedCardApplied
)
