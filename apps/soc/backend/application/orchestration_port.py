"""Outbound port for the response orchestrator (SOAR).

Note what this port does *not* promise: idempotency. Orchestrators generally
offer no such guarantee, so the core supplies its own via
``domain.playbook_policy.idempotency_key`` plus a unique constraint in its own
store. Demanding it here would be a contract no real adapter could keep — and a
port whose contract cannot be met is worse than no port at all.
"""

from typing import Protocol, runtime_checkable

from domain.playbook_entity import (
    PlaybookDecision,
    PlaybookHandle,
    PlaybookOutcome,
    PlaybookSummary,
)


@runtime_checkable
class PlaybookOrchestrationPort(Protocol):
    """What the core needs from any response orchestrator."""

    async def list_available(self) -> tuple[PlaybookSummary, ...]:
        """Return the playbooks the orchestrator can run."""
        ...

    async def launch(self, decision: PlaybookDecision) -> PlaybookHandle:
        """Start a playbook execution and return a handle to it."""
        ...

    async def get_outcome(self, handle: PlaybookHandle) -> PlaybookOutcome | None:
        """Return the current outcome for a handle, or None if unknown."""
        ...
