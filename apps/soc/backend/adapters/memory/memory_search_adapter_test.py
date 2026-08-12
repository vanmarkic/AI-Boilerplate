"""The in-memory search sink satisfies the DocumentSearchPort contract."""

import pytest

from adapters.contract.search_contract import DocumentSearchContract
from adapters.memory.memory_search_adapter import MemorySearchAdapter
from application.search_port import DocumentSearchPort


class TestMemorySearch(DocumentSearchContract):
    """Runs the shared contract against the in-memory implementation."""

    @pytest.fixture
    def port(self) -> DocumentSearchPort:
        return MemorySearchAdapter()
