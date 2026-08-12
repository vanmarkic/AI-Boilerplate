"""Behaviour every PlaybookOrchestrationPort implementation must exhibit.

Note what is deliberately *absent*: the port makes no idempotency promise.
Orchestrators generally offer none, so the core supplies its own via
``domain.playbook_policy.idempotency_key`` plus a unique constraint in its own
store. Requiring it here would be a contract no real adapter could keep.
"""

import pytest

from application.orchestration_port import PlaybookOrchestrationPort
from domain.playbook_entity import (
    PlaybookDecision,
    PlaybookHandle,
    PlaybookRunStatus,
)

MISSING = PlaybookHandle(system="nowhere", external_id="does-not-exist")

TERMINAL = {
    PlaybookRunStatus.SUCCEEDED,
    PlaybookRunStatus.FAILED,
    PlaybookRunStatus.SKIPPED,
}


def make_decision(playbook_id: str = "isolate-host") -> PlaybookDecision:
    """Build a decision to run a playbook."""
    return PlaybookDecision(
        should_run=True,
        playbook_id=playbook_id,
        inputs={"host": "web01"},
        reason="test",
        idempotency_key="idem-1",
    )


class PlaybookOrchestrationContract:
    """Subclass this and supply ``port`` and ``available_playbook_id``."""

    @pytest.fixture
    def port(self) -> PlaybookOrchestrationPort:
        """The implementation under test."""
        raise NotImplementedError

    @pytest.fixture
    def available_playbook_id(self) -> str:
        """A playbook id the implementation can run."""
        raise NotImplementedError

    async def test_satisfies_the_port(self, port: PlaybookOrchestrationPort) -> None:
        assert isinstance(port, PlaybookOrchestrationPort)

    async def test_lists_the_playbooks_it_can_run(
        self, port: PlaybookOrchestrationPort, available_playbook_id: str
    ) -> None:
        available = await port.list_available()
        assert available_playbook_id in {p.playbook_id for p in available}

    async def test_launching_returns_an_identifying_handle(
        self, port: PlaybookOrchestrationPort, available_playbook_id: str
    ) -> None:
        handle = await port.launch(make_decision(available_playbook_id))
        assert handle.system
        assert handle.external_id

    async def test_each_launch_gets_a_distinct_handle(
        self, port: PlaybookOrchestrationPort, available_playbook_id: str
    ) -> None:
        first = await port.launch(make_decision(available_playbook_id))
        second = await port.launch(make_decision(available_playbook_id))
        assert first.external_id != second.external_id

    async def test_outcome_refers_to_the_handle_that_was_launched(
        self, port: PlaybookOrchestrationPort, available_playbook_id: str
    ) -> None:
        handle = await port.launch(make_decision(available_playbook_id))
        outcome = await port.get_outcome(handle)
        assert outcome is not None
        assert outcome.handle == handle

    async def test_outcome_carries_a_known_status(
        self, port: PlaybookOrchestrationPort, available_playbook_id: str
    ) -> None:
        handle = await port.launch(make_decision(available_playbook_id))
        outcome = await port.get_outcome(handle)
        assert outcome is not None
        assert outcome.status in set(PlaybookRunStatus)

    async def test_finished_runs_report_when_they_finished(
        self, port: PlaybookOrchestrationPort, available_playbook_id: str
    ) -> None:
        handle = await port.launch(make_decision(available_playbook_id))
        outcome = await port.get_outcome(handle)
        assert outcome is not None
        if outcome.status in TERMINAL:
            assert outcome.finished_at is not None

    async def test_unknown_handle_has_no_outcome(self, port: PlaybookOrchestrationPort) -> None:
        """A miss is an answer, not an error."""
        assert await port.get_outcome(MISSING) is None
