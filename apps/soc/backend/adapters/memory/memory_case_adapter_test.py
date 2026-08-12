"""The in-memory case manager satisfies the CaseManagementPort contract."""

import pytest

from adapters.contract.case_management_contract import CaseManagementContract, make_draft
from adapters.memory.memory_case_adapter import MemoryCaseAdapter
from application.case_management_port import CaseManagementPort
from domain.case_entity import CaseNote


class TestMemoryCaseManagement(CaseManagementContract):
    """Runs the shared contract against the in-memory implementation."""

    @pytest.fixture
    def port(self) -> CaseManagementPort:
        return MemoryCaseAdapter()


class TestMemoryCaseAdapterExtras:
    """Behaviour specific to the in-memory implementation."""

    async def test_notes_are_readable_back(self) -> None:
        """Tests need to assert what the core wrote into a case."""
        adapter = MemoryCaseAdapter()
        ref = await adapter.open_case(make_draft())
        await adapter.add_note(ref, CaseNote(title="T", body="B", author="alice"))
        assert [n.title for n in adapter.notes_for(ref)] == ["T"]
