"""FastAPI dependency factories.

Assembles use cases from the adapters the registry selected. Routers depend on
these, never on an adapter directly — which is what the architecture linter
enforces.
"""

from collections.abc import Mapping
from typing import Annotated

from fastapi import Depends

from application.alert_repository_port import AlertRepositoryPort
from application.case_repository_port import CaseRepositoryPort
from application.escalate_alert_usecase import EscalateAlertUseCase
from application.ingest_event_usecase import IngestEventUseCase
from application.respond_to_alert_usecase import RespondToAlertUseCase
from application.transition_case_usecase import TransitionCaseUseCase
from core import registry
from core.storage import Storage, get_storage
from domain.event_entity import AssetCriticality, SourceProfile
from domain.playbook_entity import PlaybookCatalog, PlaybookRule
from domain.rules_entity import DEFAULT_DISPOSITION_RULES, DEFAULT_SCORING_RULES
from domain.verdict_entity import Disposition, Severity

# Source profiles describe how to read each shipper's payload. Configuration,
# not code: a new log source is a new entry here, never a new branch in the core.
SOURCE_PROFILES: Mapping[str, SourceProfile] = {
    "edr": SourceProfile(
        source="edr",
        field_map={
            "occurred_at": "event.time",
            "category": "event.category",
            "action": "event.action",
            "message": "event.message",
            "host": "agent.hostname",
            "user": "user.name",
        },
        default_category="uncategorized",
        observable_fields=("network.remote_ip", "process.hash", "url.full"),
    ),
    "firewall": SourceProfile(
        source="firewall",
        field_map={
            "occurred_at": "timestamp",
            "category": "rule.category",
            "action": "action",
            "message": "message",
            "host": "source.host",
        },
        default_category="network",
        observable_fields=("destination.ip", "source.ip"),
    ),
    "syslog": SourceProfile(
        source="syslog",
        field_map={
            "occurred_at": "timestamp",
            "message": "message",
            "host": "hostname",
        },
        default_category="uncategorized",
        observable_fields=("message",),
    ),
}

PLAYBOOK_CATALOG = PlaybookCatalog(
    rules=(
        PlaybookRule(
            playbook_id="isolate-host",
            min_severity=Severity.HIGH,
            dispositions=(Disposition.ESCALATE,),
            priority=100,
        ),
        PlaybookRule(
            playbook_id="block-ip",
            min_severity=Severity.MEDIUM,
            dispositions=(Disposition.ALERT, Disposition.ESCALATE),
            priority=50,
        ),
        PlaybookRule(
            playbook_id="disable-account",
            min_severity=Severity.HIGH,
            dispositions=(Disposition.ESCALATE,),
            min_criticality=AssetCriticality.HIGH,
            priority=75,
        ),
    )
)


def get_ingest_event_usecase(
    storage: Annotated[Storage, Depends(get_storage)],
) -> IngestEventUseCase:
    """Build the triage use case from the configured adapters."""
    return IngestEventUseCase(
        threat_intel=registry.threat_intel_port(),
        search=registry.search_port(),
        indicators=registry.indicator_repository(storage),
        allowlist=registry.allowlist_repository(storage),
        alerts=registry.alert_repository(storage),
        clock=registry.clock(),
        ids=registry.ids(),
        profiles=SOURCE_PROFILES,
        scoring_rules=DEFAULT_SCORING_RULES,
        disposition_rules=DEFAULT_DISPOSITION_RULES,
    )


def get_escalate_alert_usecase(
    storage: Annotated[Storage, Depends(get_storage)],
) -> EscalateAlertUseCase:
    """Build the escalation use case from the configured adapters."""
    return EscalateAlertUseCase(
        alerts=registry.alert_repository(storage),
        cases=registry.case_repository(storage),
        case_manager=registry.case_management_port(),
        clock=registry.clock(),
        ids=registry.ids(),
    )


def get_respond_to_alert_usecase(
    storage: Annotated[Storage, Depends(get_storage)],
) -> RespondToAlertUseCase:
    """Build the response use case from the configured adapters."""
    return RespondToAlertUseCase(
        alerts=registry.alert_repository(storage),
        runs=registry.playbook_run_repository(storage),
        orchestrator=registry.orchestration_port(),
        catalog=PLAYBOOK_CATALOG,
        clock=registry.clock(),
        ids=registry.ids(),
    )


def get_transition_case_usecase(
    storage: Annotated[Storage, Depends(get_storage)],
) -> TransitionCaseUseCase:
    """Build the case transition use case from the configured adapters."""
    return TransitionCaseUseCase(
        cases=registry.case_repository(storage),
        case_manager=registry.case_management_port(),
        clock=registry.clock(),
    )


def get_alert_repository(
    storage: Annotated[Storage, Depends(get_storage)],
) -> AlertRepositoryPort:
    """Build the alert repository for this request.

    Read-only routes need a repository too. They go through here rather than
    calling the registry directly, so every route in the app gets its storage
    the same way.
    """
    return registry.alert_repository(storage)


def get_case_repository(
    storage: Annotated[Storage, Depends(get_storage)],
) -> CaseRepositoryPort:
    """Build the case repository for this request."""
    return registry.case_repository(storage)
