"""Shuffle as a PlaybookOrchestrationPort.

Shuffle offers no idempotency guarantee, and this adapter does not pretend
otherwise — the core enforces it with its own key and store. What this file
does own is the translation of Shuffle's execution vocabulary into ours.
"""

import json
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from adapters.shuffle.shuffle_client import ShuffleClient
from application.clock_port import ClockPort
from domain.playbook_entity import (
    PlaybookDecision,
    PlaybookHandle,
    PlaybookOutcome,
    PlaybookRunStatus,
    PlaybookSummary,
)
from domain.soc_error import IntegrationProtocolError

SYSTEM_NAME = "shuffle"

# Shuffle execution status -> our run status. Anything unrecognised is treated
# as still running: guessing "succeeded" would silently hide a failed response.
EXECUTION_STATUSES: Mapping[str, PlaybookRunStatus] = {
    "FINISHED": PlaybookRunStatus.SUCCEEDED,
    "SUCCESS": PlaybookRunStatus.SUCCEEDED,
    "EXECUTING": PlaybookRunStatus.RUNNING,
    "WAITING": PlaybookRunStatus.RUNNING,
    "ABORTED": PlaybookRunStatus.FAILED,
    "FAILURE": PlaybookRunStatus.FAILED,
    "FAILED": PlaybookRunStatus.FAILED,
}


TERMINAL_STATUSES = frozenset(
    {PlaybookRunStatus.SUCCEEDED, PlaybookRunStatus.FAILED, PlaybookRunStatus.SKIPPED}
)


def _status_of(raw: object) -> PlaybookRunStatus:
    """Translate a Shuffle execution status into a run status."""
    return EXECUTION_STATUSES.get(str(raw).upper(), PlaybookRunStatus.RUNNING)


def _completed_at(payload: Mapping[str, Any]) -> datetime | None:
    """Read Shuffle's completion time, which may be epoch seconds or ISO text."""
    raw = payload.get("completed_at") or payload.get("completedAt")
    if raw in (None, "", 0):
        return None
    if isinstance(raw, int | float):
        return datetime.fromtimestamp(float(raw), tz=UTC)
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None


def _output_of(payload: Mapping[str, Any]) -> dict[str, str]:
    """Flatten Shuffle's result field into string pairs.

    The result may be a JSON string, an object, or a bare value; all three are
    rendered as strings so the domain never has to parse vendor output.
    """
    raw = payload.get("result")
    if raw in (None, ""):
        return {}
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except ValueError:
            return {"result": raw}
    else:
        parsed = raw
    if isinstance(parsed, Mapping):
        return {str(k): str(v) for k, v in parsed.items()}
    return {"result": str(parsed)}


class ShuffleOrchestrationAdapter:
    """Runs playbooks on a Shuffle instance."""

    def __init__(self, client: ShuffleClient, clock: ClockPort) -> None:
        self._client = client
        self._clock = clock

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._client.aclose()

    async def list_available(self) -> tuple[PlaybookSummary, ...]:
        """Return the workflows Shuffle can run."""
        workflows = await self._client.list_workflows()
        return tuple(
            PlaybookSummary(
                playbook_id=str(w.get("id", "")),
                name=str(w.get("name", "")),
                description=str(w.get("description", "")),
            )
            for w in workflows
            if w.get("id")
        )

    async def launch(self, decision: PlaybookDecision) -> PlaybookHandle:
        """Start a workflow execution and return a handle to it."""
        if not decision.playbook_id:
            raise IntegrationProtocolError("orchestration", "decision names no playbook")

        payload = await self._client.execute_workflow(decision.playbook_id, decision.inputs)
        execution_id = payload.get("execution_id")
        if not execution_id:
            raise IntegrationProtocolError(
                "orchestration", "workflow started but no execution id was returned"
            )
        return PlaybookHandle(
            system=SYSTEM_NAME,
            external_id=str(execution_id),
            continuation=str(payload["authorization"]) if payload.get("authorization") else None,
        )

    async def get_outcome(self, handle: PlaybookHandle) -> PlaybookOutcome | None:
        """Return the current outcome for a handle, or None if unknown."""
        payload = await self._client.execution_result(handle.external_id, handle.continuation)
        if payload is None:
            return None

        status = _status_of(payload.get("status"))
        error = payload.get("reason") or payload.get("error")

        # Prefer Shuffle's own completion time. When it does not report one, a
        # finished run still has to say when it finished, so we record the
        # moment we observed completion rather than leaving it unanswered.
        finished_at = _completed_at(payload)
        if finished_at is None and status in TERMINAL_STATUSES:
            finished_at = self._clock.now()

        return PlaybookOutcome(
            handle=handle,
            status=status,
            output=_output_of(payload),
            error=str(error) if error else None,
            finished_at=finished_at,
        )
