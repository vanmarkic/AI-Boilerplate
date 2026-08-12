"""In-memory playbook orchestration.

Production-selectable: with ``SOC_ORCHESTRATION_PROVIDER=memory`` the platform
makes and records response decisions with no SOAR deployed. Runs complete
immediately, which makes the decisioning path testable end to end.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from itertools import count

from application.clock_port import ClockPort
from domain.playbook_entity import (
    PlaybookDecision,
    PlaybookHandle,
    PlaybookOutcome,
    PlaybookRunStatus,
    PlaybookSummary,
)

SYSTEM_NAME = "memory"


@dataclass(frozen=True, slots=True)
class _StoredRun:
    """One execution held in process."""

    playbook_id: str
    inputs: Mapping[str, str]
    status: PlaybookRunStatus
    error: str | None


class MemoryOrchestrationAdapter:
    """Executes playbooks by recording that they were asked for."""

    def __init__(
        self,
        catalogue: Sequence[PlaybookSummary],
        clock: ClockPort,
    ) -> None:
        self._catalogue = tuple(catalogue)
        self._clock = clock
        self._runs: dict[str, _StoredRun] = {}
        self._ids = count(1)

    def inputs_for(self, handle: PlaybookHandle) -> Mapping[str, str]:
        """Return the inputs a run was launched with, so tests can assert on them."""
        run = self._runs.get(handle.external_id)
        return dict(run.inputs) if run else {}

    async def list_available(self) -> tuple[PlaybookSummary, ...]:
        """Return the catalogue this orchestrator was configured with."""
        return self._catalogue

    async def launch(self, decision: PlaybookDecision) -> PlaybookHandle:
        """Record an execution, failing it if the playbook is not in the catalogue."""
        external_id = str(next(self._ids))
        playbook_id = decision.playbook_id or ""
        known = any(p.playbook_id == playbook_id for p in self._catalogue)
        self._runs[external_id] = _StoredRun(
            playbook_id=playbook_id,
            inputs=dict(decision.inputs),
            status=PlaybookRunStatus.SUCCEEDED if known else PlaybookRunStatus.FAILED,
            error=None if known else f"unknown playbook '{playbook_id}'",
        )
        return PlaybookHandle(system=SYSTEM_NAME, external_id=external_id)

    async def get_outcome(self, handle: PlaybookHandle) -> PlaybookOutcome | None:
        """Return the recorded outcome, or None if the handle is unknown."""
        run = self._runs.get(handle.external_id)
        if run is None:
            return None
        return PlaybookOutcome(
            handle=handle,
            status=run.status,
            output={"playbook_id": run.playbook_id},
            error=run.error,
            finished_at=self._clock.now(),
        )
