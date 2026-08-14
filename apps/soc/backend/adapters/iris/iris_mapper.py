"""The anti-corruption layer for DFIR-IRIS.

IRIS identifies statuses, IOC types and TLP levels by *numeric id*, and those
ids are customised per deployment. Keeping every one of them in this file —
and making them overridable — is what stops a site-specific integer from
leaking into the domain.
"""

from collections.abc import Mapping

from domain.case_entity import CaseStatus
from domain.indicator_entity import TlpLevel
from domain.observable_entity import ObservableType
from domain.verdict_entity import Severity

# Default IRIS case status ids. Override per deployment via settings.
STATUS_IDS: Mapping[CaseStatus, int] = {
    CaseStatus.OPEN: 1,
    CaseStatus.IN_PROGRESS: 2,
    CaseStatus.CONTAINED: 3,
    CaseStatus.CLOSED_RESOLVED: 8,
    CaseStatus.CLOSED_FALSE_POSITIVE: 9,
}

STATUS_BY_ID: Mapping[int, CaseStatus] = {v: k for k, v in STATUS_IDS.items()}

# Default IRIS IOC type ids.
IOC_TYPE_IDS: Mapping[ObservableType, int] = {
    ObservableType.IPV4: 76,
    ObservableType.IPV6: 77,
    ObservableType.DOMAIN: 20,
    ObservableType.HOSTNAME: 43,
    ObservableType.URL: 141,
    ObservableType.MD5: 90,
    ObservableType.SHA1: 111,
    ObservableType.SHA256: 113,
    ObservableType.EMAIL: 22,
    ObservableType.FILENAME: 37,
}
DEFAULT_IOC_TYPE_ID = 96  # IRIS "other"

TLP_IDS: Mapping[TlpLevel, int] = {
    TlpLevel.CLEAR: 1,
    TlpLevel.GREEN: 2,
    TlpLevel.AMBER: 3,
    TlpLevel.AMBER_STRICT: 3,
    TlpLevel.RED: 4,
}

SEVERITY_IDS: Mapping[Severity, int] = {
    Severity.INFO: 1,
    Severity.LOW: 2,
    Severity.MEDIUM: 3,
    Severity.HIGH: 4,
    Severity.CRITICAL: 5,
}


def status_id_for(status: CaseStatus, overrides: Mapping[str, int] | None = None) -> int:
    """Return the IRIS status id for a domain status."""
    if overrides and status.value in overrides:
        return overrides[status.value]
    return STATUS_IDS[status]


def status_from_id(raw: object, overrides: Mapping[str, int] | None = None) -> CaseStatus:
    """Return the domain status for an IRIS status id, defaulting to open."""
    try:
        status_id = int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return CaseStatus.OPEN
    if overrides:
        for name, value in overrides.items():
            if value == status_id:
                try:
                    return CaseStatus(name)
                except ValueError:
                    continue
    return STATUS_BY_ID.get(status_id, CaseStatus.OPEN)


def ioc_type_id_for(
    observable_type: ObservableType,
    overrides: Mapping[str, int] | None = None,
) -> int:
    """Return the IRIS IOC type id for a domain observable type."""
    if overrides and observable_type.value in overrides:
        return overrides[observable_type.value]
    return IOC_TYPE_IDS.get(observable_type, DEFAULT_IOC_TYPE_ID)


def case_id_of(data: object) -> str | None:
    """Read the case identifier out of an IRIS case payload."""
    if not isinstance(data, Mapping):
        return None
    for key in ("case_id", "id", "case_uuid"):
        value = data.get(key)
        if value not in (None, ""):
            return str(value)
    return None
