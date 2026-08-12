"""The in-memory repositories satisfy the repository contracts."""

import pytest

from adapters.contract.repository_contract import (
    AlertRepositoryContract,
    AllowlistRepositoryContract,
    CaseRepositoryContract,
    IndicatorRepositoryContract,
    PlaybookRunRepositoryContract,
)
from adapters.memory.memory_alert_repository import MemoryAlertRepository
from adapters.memory.memory_allowlist_repository import MemoryAllowlistRepository
from adapters.memory.memory_case_repository import MemoryCaseRepository
from adapters.memory.memory_indicator_repository import MemoryIndicatorRepository
from adapters.memory.memory_playbook_run_repository import MemoryPlaybookRunRepository
from application.alert_repository_port import AlertRepositoryPort
from application.allowlist_repository_port import AllowlistRepositoryPort
from application.case_repository_port import CaseRepositoryPort
from application.indicator_repository_port import IndicatorRepositoryPort
from application.playbook_run_repository_port import PlaybookRunRepositoryPort


class TestMemoryIndicatorRepository(IndicatorRepositoryContract):
    @pytest.fixture
    def repo(self) -> IndicatorRepositoryPort:
        return MemoryIndicatorRepository()


class TestMemoryAllowlistRepository(AllowlistRepositoryContract):
    @pytest.fixture
    def repo(self) -> AllowlistRepositoryPort:
        return MemoryAllowlistRepository()


class TestMemoryAlertRepository(AlertRepositoryContract):
    @pytest.fixture
    def repo(self) -> AlertRepositoryPort:
        return MemoryAlertRepository()


class TestMemoryCaseRepository(CaseRepositoryContract):
    @pytest.fixture
    def repo(self) -> CaseRepositoryPort:
        return MemoryCaseRepository()


class TestMemoryPlaybookRunRepository(PlaybookRunRepositoryContract):
    @pytest.fixture
    def repo(self) -> PlaybookRunRepositoryPort:
        return MemoryPlaybookRunRepository()
