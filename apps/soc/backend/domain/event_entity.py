"""Events: what arrives, and what it becomes once we understand it."""

from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from domain.observable_entity import Observable


class AssetCriticality(StrEnum):
    """How much we care about the asset an event concerns."""

    LOW = "low"
    STANDARD = "standard"
    HIGH = "high"
    CROWN_JEWEL = "crown_jewel"


CRITICALITY_RANK: Mapping[AssetCriticality, int] = {
    AssetCriticality.LOW: 0,
    AssetCriticality.STANDARD: 1,
    AssetCriticality.HIGH: 2,
    AssetCriticality.CROWN_JEWEL: 3,
}


@dataclass(frozen=True, slots=True)
class RawEvent:
    """An event exactly as a source handed it to us. Never trusted."""

    source: str
    received_at: datetime
    payload: Mapping[str, Any]
    external_id: str | None = None


@dataclass(frozen=True, slots=True)
class SourceProfile:
    """How to read one source's payload. Pure configuration, injected."""

    source: str
    field_map: Mapping[str, str]
    default_category: str = "uncategorized"
    observable_fields: tuple[str, ...] = ()
    criticality_by_host: Mapping[str, AssetCriticality] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class NormalizedEvent:
    """A source-independent event. Everything downstream speaks only this."""

    event_id: UUID
    source: str
    occurred_at: datetime
    received_at: datetime
    category: str
    action: str
    message: str
    host: str | None
    user: str | None
    asset_criticality: AssetCriticality
    observables: tuple[Observable, ...]
    dedup_key: str
    raw: Mapping[str, Any] = field(default_factory=dict)
