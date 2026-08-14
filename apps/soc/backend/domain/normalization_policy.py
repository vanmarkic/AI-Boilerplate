"""Turn a source-shaped RawEvent into a source-independent NormalizedEvent."""

import hashlib
from collections.abc import Mapping
from datetime import datetime
from typing import Any
from uuid import UUID

from domain.event_entity import (
    AssetCriticality,
    NormalizedEvent,
    RawEvent,
    SourceProfile,
)
from domain.observable_entity import Observable
from domain.observable_policy import extract_observables

_UNSET = object()


def read_path(payload: Mapping[str, object], path: str) -> object:
    """Read a dotted path out of a nested mapping, or None if absent."""
    current: object = payload
    for segment in path.split("."):
        if not isinstance(current, Mapping):
            return None
        current = current.get(segment, _UNSET)
        if current is _UNSET:
            return None
    return current


def _as_text(value: object) -> str | None:
    """Render a payload value as text, or None when it is absent/empty."""
    if value is None:
        return None
    if isinstance(value, str):
        return value or None
    return str(value)


def _mapped(payload: Mapping[str, Any], profile: SourceProfile, field: str) -> str | None:
    """Read a logical field through the profile's field map."""
    path = profile.field_map.get(field)
    if path is None:
        return None
    return _as_text(read_path(payload, path))


def _occurred_at(raw: RawEvent, profile: SourceProfile) -> datetime:
    """Resolve the event time, falling back to when we received it."""
    text = _mapped(raw.payload, profile, "occurred_at")
    if text is None:
        return raw.received_at
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return raw.received_at
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=raw.received_at.tzinfo)
    return parsed


def dedup_key(raw: RawEvent, profile: SourceProfile) -> str:
    """Return a stable identity for an event.

    Prefers the source's own identifier; otherwise derives one from the
    fields that make an event the same event to a human analyst.
    """
    if raw.external_id:
        material = f"{raw.source}|{raw.external_id}"
    else:
        occurred = _occurred_at(raw, profile).isoformat()
        host = _mapped(raw.payload, profile, "host") or ""
        action = _mapped(raw.payload, profile, "action") or ""
        material = f"{raw.source}|{occurred}|{host}|{action}"
    return hashlib.sha256(material.encode()).hexdigest()


def _collect_observables(
    raw: RawEvent,
    profile: SourceProfile,
) -> tuple[Observable, ...]:
    """Extract observables from the profile's declared fields, plus the message."""
    fragments: list[str] = []
    for path in profile.observable_fields:
        text = _as_text(read_path(raw.payload, path))
        if text:
            fragments.append(text)
    message = _mapped(raw.payload, profile, "message")
    if message:
        fragments.append(message)
    if not fragments:
        return ()
    return extract_observables(" ".join(fragments))


def normalize(
    raw: RawEvent,
    profile: SourceProfile,
    event_id: UUID,
) -> NormalizedEvent:
    """Project a raw event onto the platform's own event shape."""
    host = _mapped(raw.payload, profile, "host")
    criticality = profile.criticality_by_host.get(
        host or "",
        AssetCriticality.STANDARD,
    )
    return NormalizedEvent(
        event_id=event_id,
        source=raw.source,
        occurred_at=_occurred_at(raw, profile),
        received_at=raw.received_at,
        category=_mapped(raw.payload, profile, "category") or profile.default_category,
        action=_mapped(raw.payload, profile, "action") or "",
        message=_mapped(raw.payload, profile, "message") or "",
        host=host,
        user=_mapped(raw.payload, profile, "user"),
        asset_criticality=criticality,
        observables=_collect_observables(raw, profile),
        dedup_key=dedup_key(raw, profile),
        raw=dict(raw.payload),
    )
