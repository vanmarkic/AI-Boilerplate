"""The composition root: which adapter implements each port.

This is the one module allowed to name a vendor. Swapping a third party is a
change to a single builder here — ``domain/`` and ``application/`` do not move.

Every provider defaults to ``memory``, so the platform boots and serves its
full pipeline with no third party deployed at all.
"""

from collections.abc import Callable, Mapping
from functools import lru_cache

from adapters.memory.memory_alert_repository import MemoryAlertRepository
from adapters.memory.memory_allowlist_repository import MemoryAllowlistRepository
from adapters.memory.memory_case_adapter import MemoryCaseAdapter
from adapters.memory.memory_case_repository import MemoryCaseRepository
from adapters.memory.memory_indicator_repository import MemoryIndicatorRepository
from adapters.memory.memory_orchestration_adapter import MemoryOrchestrationAdapter
from adapters.memory.memory_playbook_run_repository import MemoryPlaybookRunRepository
from adapters.memory.memory_search_adapter import MemorySearchAdapter
from adapters.memory.memory_store import MemoryStore
from adapters.memory.memory_threat_intel_adapter import MemoryThreatIntelAdapter
from adapters.system.system_clock_adapter import SystemClockAdapter, UuidIdAdapter
from application.alert_repository_port import AlertRepositoryPort
from application.allowlist_repository_port import AllowlistRepositoryPort
from application.case_management_port import CaseManagementPort
from application.case_repository_port import CaseRepositoryPort
from application.clock_port import ClockPort, IdGeneratorPort
from application.indicator_repository_port import IndicatorRepositoryPort
from application.orchestration_port import PlaybookOrchestrationPort
from application.playbook_run_repository_port import PlaybookRunRepositoryPort
from application.search_port import DocumentSearchPort
from application.threat_intel_port import ThreatIntelPort
from core.config import Settings, settings
from core.storage import MEMORY, Storage
from domain.playbook_entity import PlaybookSummary

# A small default catalogue so the in-memory orchestrator has something to run.
DEFAULT_PLAYBOOKS = (
    PlaybookSummary(playbook_id="isolate-host", name="Isolate host"),
    PlaybookSummary(playbook_id="block-ip", name="Block IP at the perimeter"),
    PlaybookSummary(playbook_id="disable-account", name="Disable user account"),
)


def _unknown(port_name: str, provider: str, known: Mapping[str, object]) -> ValueError:
    """Fail fast and legibly on a misconfigured provider."""
    return ValueError(f"unknown {port_name} provider '{provider}'; expected one of {sorted(known)}")


def _build_memory_threat_intel(_: Settings) -> ThreatIntelPort:
    return MemoryThreatIntelAdapter()


def _build_misp_threat_intel(config: Settings) -> ThreatIntelPort:
    from adapters.misp.misp_client import MispClient
    from adapters.misp.misp_threat_intel_adapter import MispThreatIntelAdapter
    from adapters.resilient_client import HttpConfig, ResilientHttpClient

    http = ResilientHttpClient(
        HttpConfig(
            system="threat_intel",
            base_url=config.misp_url,
            verify_tls=config.misp_verify_tls,
            timeout_seconds=config.http_timeout_seconds,
            max_attempts=config.http_max_retries,
            headers=MispClient.auth_headers(config.misp_api_key),
        )
    )
    return MispThreatIntelAdapter(MispClient(http))


def _build_memory_search(_: Settings) -> DocumentSearchPort:
    return MemorySearchAdapter()


def _build_opensearch_search(config: Settings) -> DocumentSearchPort:
    from adapters.opensearch.opensearch_client import OpenSearchClient
    from adapters.opensearch.opensearch_search_adapter import OpenSearchSearchAdapter
    from adapters.resilient_client import HttpConfig, ResilientHttpClient

    http = ResilientHttpClient(
        HttpConfig(
            system="search",
            base_url=config.opensearch_url,
            verify_tls=config.opensearch_verify_tls,
            timeout_seconds=config.http_timeout_seconds,
            max_attempts=config.http_max_retries,
            headers=OpenSearchClient.basic_auth_headers(
                config.opensearch_username, config.opensearch_password
            ),
        )
    )
    return OpenSearchSearchAdapter(
        OpenSearchClient(http),
        event_index=config.opensearch_event_index,
        indicator_index=config.opensearch_indicator_index,
    )


def _build_memory_case_manager(_: Settings) -> CaseManagementPort:
    return MemoryCaseAdapter()


def _build_iris_case_manager(config: Settings) -> CaseManagementPort:
    from adapters.iris.iris_case_adapter import IrisCaseAdapter
    from adapters.iris.iris_client import IrisClient
    from adapters.resilient_client import HttpConfig, ResilientHttpClient

    http = ResilientHttpClient(
        HttpConfig(
            system="case_management",
            base_url=config.iris_url,
            verify_tls=config.iris_verify_tls,
            timeout_seconds=config.http_timeout_seconds,
            max_attempts=config.http_max_retries,
            headers=IrisClient.auth_headers(config.iris_api_key),
        )
    )
    return IrisCaseAdapter(
        IrisClient(http),
        customer_id=config.iris_customer_id,
        base_url=config.iris_url,
    )


def _build_memory_orchestrator(_: Settings) -> PlaybookOrchestrationPort:
    return MemoryOrchestrationAdapter(DEFAULT_PLAYBOOKS, SystemClockAdapter())


def _build_shuffle_orchestrator(config: Settings) -> PlaybookOrchestrationPort:
    from adapters.resilient_client import HttpConfig, ResilientHttpClient
    from adapters.shuffle.shuffle_client import ShuffleClient
    from adapters.shuffle.shuffle_orchestration_adapter import ShuffleOrchestrationAdapter

    http = ResilientHttpClient(
        HttpConfig(
            system="orchestration",
            base_url=config.shuffle_url,
            verify_tls=config.shuffle_verify_tls,
            timeout_seconds=config.http_timeout_seconds,
            max_attempts=config.http_max_retries,
            headers=ShuffleClient.auth_headers(config.shuffle_api_key),
        )
    )
    return ShuffleOrchestrationAdapter(ShuffleClient(http), SystemClockAdapter())


THREAT_INTEL_BUILDERS: Mapping[str, Callable[[Settings], ThreatIntelPort]] = {
    MEMORY: _build_memory_threat_intel,
    "misp": _build_misp_threat_intel,
}
SEARCH_BUILDERS: Mapping[str, Callable[[Settings], DocumentSearchPort]] = {
    MEMORY: _build_memory_search,
    "opensearch": _build_opensearch_search,
}
CASE_BUILDERS: Mapping[str, Callable[[Settings], CaseManagementPort]] = {
    MEMORY: _build_memory_case_manager,
    "iris": _build_iris_case_manager,
}
ORCHESTRATION_BUILDERS: Mapping[str, Callable[[Settings], PlaybookOrchestrationPort]] = {
    MEMORY: _build_memory_orchestrator,
    "shuffle": _build_shuffle_orchestrator,
}


@lru_cache(maxsize=1)
def threat_intel_port() -> ThreatIntelPort:
    """Return the configured threat intel implementation."""
    builder = THREAT_INTEL_BUILDERS.get(settings.threat_intel_provider)
    if builder is None:
        raise _unknown("threat intel", settings.threat_intel_provider, THREAT_INTEL_BUILDERS)
    return builder(settings)


@lru_cache(maxsize=1)
def search_port() -> DocumentSearchPort:
    """Return the configured document search implementation."""
    builder = SEARCH_BUILDERS.get(settings.search_provider)
    if builder is None:
        raise _unknown("search", settings.search_provider, SEARCH_BUILDERS)
    return builder(settings)


@lru_cache(maxsize=1)
def case_management_port() -> CaseManagementPort:
    """Return the configured case management implementation."""
    builder = CASE_BUILDERS.get(settings.case_provider)
    if builder is None:
        raise _unknown("case management", settings.case_provider, CASE_BUILDERS)
    return builder(settings)


@lru_cache(maxsize=1)
def orchestration_port() -> PlaybookOrchestrationPort:
    """Return the configured playbook orchestration implementation."""
    builder = ORCHESTRATION_BUILDERS.get(settings.orchestration_provider)
    if builder is None:
        raise _unknown("orchestration", settings.orchestration_provider, ORCHESTRATION_BUILDERS)
    return builder(settings)


# --- repositories --------------------------------------------------------
#
# Unlike the ports above, a repository is NOT a singleton: it is constructed
# per request around the storage handle for that request. Both providers follow
# that one rule, which is why none of these needs a provider branch beyond the
# builder lookup.


def _require_memory(storage: Storage) -> MemoryStore:
    """Narrow a storage handle to the in-memory store."""
    if not isinstance(storage, MemoryStore):
        raise TypeError(f"memory repositories need a MemoryStore, got {type(storage).__name__}")
    return storage


INDICATOR_BUILDERS: Mapping[str, Callable[[Storage], IndicatorRepositoryPort]] = {
    MEMORY: lambda s: MemoryIndicatorRepository(_require_memory(s)),
}
ALLOWLIST_BUILDERS: Mapping[str, Callable[[Storage], AllowlistRepositoryPort]] = {
    MEMORY: lambda s: MemoryAllowlistRepository(_require_memory(s)),
}
ALERT_BUILDERS: Mapping[str, Callable[[Storage], AlertRepositoryPort]] = {
    MEMORY: lambda s: MemoryAlertRepository(_require_memory(s)),
}
CASE_REPOSITORY_BUILDERS: Mapping[str, Callable[[Storage], CaseRepositoryPort]] = {
    MEMORY: lambda s: MemoryCaseRepository(_require_memory(s)),
}
PLAYBOOK_RUN_BUILDERS: Mapping[str, Callable[[Storage], PlaybookRunRepositoryPort]] = {
    MEMORY: lambda s: MemoryPlaybookRunRepository(_require_memory(s)),
}


def indicator_repository(storage: Storage) -> IndicatorRepositoryPort:
    """Return the configured indicator repository for this request."""
    builder = INDICATOR_BUILDERS.get(settings.repository_provider)
    if builder is None:
        raise _unknown("repository", settings.repository_provider, INDICATOR_BUILDERS)
    return builder(storage)


def allowlist_repository(storage: Storage) -> AllowlistRepositoryPort:
    """Return the configured allowlist repository for this request."""
    builder = ALLOWLIST_BUILDERS.get(settings.repository_provider)
    if builder is None:
        raise _unknown("repository", settings.repository_provider, ALLOWLIST_BUILDERS)
    return builder(storage)


def alert_repository(storage: Storage) -> AlertRepositoryPort:
    """Return the configured alert repository for this request."""
    builder = ALERT_BUILDERS.get(settings.repository_provider)
    if builder is None:
        raise _unknown("repository", settings.repository_provider, ALERT_BUILDERS)
    return builder(storage)


def case_repository(storage: Storage) -> CaseRepositoryPort:
    """Return the configured case repository for this request."""
    builder = CASE_REPOSITORY_BUILDERS.get(settings.repository_provider)
    if builder is None:
        raise _unknown("repository", settings.repository_provider, CASE_REPOSITORY_BUILDERS)
    return builder(storage)


def playbook_run_repository(storage: Storage) -> PlaybookRunRepositoryPort:
    """Return the configured playbook run repository for this request."""
    builder = PLAYBOOK_RUN_BUILDERS.get(settings.repository_provider)
    if builder is None:
        raise _unknown("repository", settings.repository_provider, PLAYBOOK_RUN_BUILDERS)
    return builder(storage)


@lru_cache(maxsize=1)
def clock() -> ClockPort:
    """Return the system clock."""
    return SystemClockAdapter()


@lru_cache(maxsize=1)
def ids() -> IdGeneratorPort:
    """Return the id generator."""
    return UuidIdAdapter()


def bound_providers() -> Mapping[str, str]:
    """Report which implementation is bound to each port.

    Exposed on the health endpoint so an operator can see at a glance whether
    they are talking to real systems or running self-contained.
    """
    return {
        "threatIntel": settings.threat_intel_provider,
        "search": settings.search_provider,
        "caseManagement": settings.case_provider,
        "orchestration": settings.orchestration_provider,
        "repositories": settings.repository_provider,
    }


def reset() -> None:
    """Clear cached adapters. Used by tests that change configuration."""
    for cached in (
        threat_intel_port,
        search_port,
        case_management_port,
        orchestration_port,
        clock,
        ids,
    ):
        cached.cache_clear()
