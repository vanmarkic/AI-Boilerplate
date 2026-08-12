"""The in-memory orchestrator satisfies the PlaybookOrchestrationPort contract."""

from datetime import UTC, datetime

import pytest

from adapters.contract.orchestration_contract import (
    PlaybookOrchestrationContract,
    make_decision,
)
from adapters.memory.fixed_clock_adapter import FixedClockAdapter
from adapters.memory.memory_orchestration_adapter import MemoryOrchestrationAdapter
from application.orchestration_port import PlaybookOrchestrationPort
from domain.playbook_entity import PlaybookRunStatus, PlaybookSummary

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
CATALOGUE = (
    PlaybookSummary(playbook_id="isolate-host", name="Isolate host"),
    PlaybookSummary(playbook_id="block-ip", name="Block IP"),
)


class TestMemoryOrchestration(PlaybookOrchestrationContract):
    """Runs the shared contract against the in-memory implementation."""

    @pytest.fixture
    def port(self) -> PlaybookOrchestrationPort:
        return MemoryOrchestrationAdapter(CATALOGUE, FixedClockAdapter(NOW))

    @pytest.fixture
    def available_playbook_id(self) -> str:
        return "isolate-host"


class TestMemoryOrchestrationExtras:
    """Behaviour specific to the in-memory implementation."""

    async def test_launched_runs_succeed_immediately(self) -> None:
        adapter = MemoryOrchestrationAdapter(CATALOGUE, FixedClockAdapter(NOW))
        handle = await adapter.launch(make_decision())
        outcome = await adapter.get_outcome(handle)
        assert outcome is not None
        assert outcome.status is PlaybookRunStatus.SUCCEEDED
        assert outcome.finished_at == NOW

    async def test_launch_records_the_decision_inputs(self) -> None:
        """Tests need to assert what the core asked the orchestrator to do."""
        adapter = MemoryOrchestrationAdapter(CATALOGUE, FixedClockAdapter(NOW))
        handle = await adapter.launch(make_decision())
        assert adapter.inputs_for(handle) == {"host": "web01"}

    async def test_launching_an_unknown_playbook_is_rejected(self) -> None:
        adapter = MemoryOrchestrationAdapter(CATALOGUE, FixedClockAdapter(NOW))
        handle = await adapter.launch(make_decision("no-such-playbook"))
        outcome = await adapter.get_outcome(handle)
        assert outcome is not None
        assert outcome.status is PlaybookRunStatus.FAILED
        assert outcome.error
