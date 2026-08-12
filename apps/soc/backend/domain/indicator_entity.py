"""Indicators of compromise, and what we know about them.

``IndicatorIntel`` is what an external source claims.  ``Indicator`` is the
record *we* own — the distinction is deliberate and is what lets the threat
intel platform be swapped without losing our own state.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from domain.observable_entity import Observable
from domain.soc_error import InvalidIndicatorError

CONFIDENCE_MIN = 0
CONFIDENCE_MAX = 100


class TlpLevel(StrEnum):
    """Traffic Light Protocol sharing constraint."""

    CLEAR = "clear"
    GREEN = "green"
    AMBER = "amber"
    AMBER_STRICT = "amber+strict"
    RED = "red"


class IndicatorStatus(StrEnum):
    """Lifecycle state of an indicator we own."""

    ACTIVE = "active"
    EXPIRED = "expired"
    ALLOWLISTED = "allowlisted"
    REVOKED = "revoked"


class MatchKind(StrEnum):
    """How an allowlist entry matches an observable."""

    EXACT = "exact"
    DOMAIN_SUFFIX = "domain_suffix"
    CIDR = "cidr"


@dataclass(frozen=True, slots=True)
class Confidence:
    """A 0-100 confidence score, validated at construction."""

    value: int

    def __post_init__(self) -> None:
        if not CONFIDENCE_MIN <= self.value <= CONFIDENCE_MAX:
            raise InvalidIndicatorError(
                f"confidence must be {CONFIDENCE_MIN}-{CONFIDENCE_MAX}, got {self.value}"
            )


@dataclass(frozen=True, slots=True)
class IndicatorIntel:
    """What an external intel source claims about an observable."""

    observable: Observable
    known: bool
    confidence: Confidence
    threat_labels: tuple[str, ...]
    tlp: TlpLevel
    first_seen: datetime | None
    last_seen: datetime | None
    source: str
    source_ref: str | None = None


@dataclass(frozen=True, slots=True)
class Indicator:
    """An indicator record owned by this platform."""

    indicator_id: UUID
    observable: Observable
    confidence: Confidence
    status: IndicatorStatus
    threat_labels: tuple[str, ...]
    tlp: TlpLevel
    first_seen: datetime
    last_seen: datetime
    sighting_count: int
    source: str
    external_ref: str | None = None


@dataclass(frozen=True, slots=True)
class Sighting:
    """A record that we observed an indicator in our own telemetry."""

    sighting_id: UUID
    indicator_id: UUID
    event_id: UUID
    observed_at: datetime
    source: str
    asset: str | None = None


@dataclass(frozen=True, slots=True)
class AllowlistEntry:
    """A rule suppressing an observable from ever raising severity."""

    entry_id: UUID
    observable: Observable
    match_kind: MatchKind
    reason: str
    created_by: str
    created_at: datetime
    expires_at: datetime | None = None
