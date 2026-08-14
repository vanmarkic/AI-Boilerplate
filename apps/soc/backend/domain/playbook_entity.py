"""Playbooks: what automated response we chose, and what happened.

Orchestrators generally offer no idempotency guarantee, so we supply our own:
``PlaybookRun.idempotency_key`` is derived in the domain and enforced by a
unique constraint in our own store.  A third party's missing guarantee,
supplied by the core — which is the whole point of the boundary.
"""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from domain.event_entity import AssetCriticality
from domain.observable_entity import ObservableType
from domain.verdict_entity import Disposition, Severity


class PlaybookRunStatus(StrEnum):
    """Lifecycle of one playbook execution."""

    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass(frozen=True, slots=True)
class PlaybookRule:
    """A selection rule. Pure configuration, injected as a catalogue."""

    playbook_id: str
    min_severity: Severity
    dispositions: tuple[Disposition, ...]
    min_criticality: AssetCriticality = AssetCriticality.LOW
    required_labels: tuple[str, ...] = field(default_factory=tuple)
    observable_types: tuple[ObservableType, ...] = field(default_factory=tuple)
    priority: int = 0


@dataclass(frozen=True, slots=True)
class PlaybookCatalog:
    """The set of rules triage consults when choosing a response."""

    rules: tuple[PlaybookRule, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class PlaybookDecision:
    """Which playbook to run, with what inputs, and why."""

    should_run: bool
    playbook_id: str | None
    inputs: Mapping[str, str]
    reason: str
    idempotency_key: str


@dataclass(frozen=True, slots=True)
class PlaybookHandle:
    """An opaque handle to one execution in the orchestrator.

    ``continuation`` carries per-execution credentials some orchestrators
    require to read results back. It is a secret: never log it.
    """

    system: str
    external_id: str
    continuation: str | None = None


@dataclass(frozen=True, slots=True)
class PlaybookSummary:
    """A playbook the orchestrator says it can run."""

    playbook_id: str
    name: str
    description: str = ""


@dataclass(frozen=True, slots=True)
class PlaybookOutcome:
    """What the orchestrator reports about an execution."""

    handle: PlaybookHandle
    status: PlaybookRunStatus
    output: Mapping[str, str] = field(default_factory=dict)
    error: str | None = None
    finished_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class PlaybookRun:
    """Our own record of a response action. Survives orchestrator swaps."""

    run_id: UUID
    idempotency_key: str
    # None for a declined response: there is no playbook to name, and the
    # relational store makes this column NULL rather than "".
    playbook_id: str | None
    status: PlaybookRunStatus
    inputs: Mapping[str, str]
    started_at: datetime
    alert_id: UUID | None = None
    case_id: UUID | None = None
    handle: PlaybookHandle | None = None
    output: Mapping[str, str] = field(default_factory=dict)
    error: str | None = None
    finished_at: datetime | None = None
