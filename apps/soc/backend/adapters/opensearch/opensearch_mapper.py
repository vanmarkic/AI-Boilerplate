"""The anti-corruption layer for OpenSearch.

Owns the document shape (ECS-flavoured field names) and the query DSL. Every
OpenSearch-specific string lives here, so pointing the platform at a different
search engine means writing a sibling of this file.
"""

import base64
import binascii
from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from domain.event_entity import AssetCriticality, NormalizedEvent
from domain.indicator_entity import Indicator
from domain.observable_entity import Observable, ObservableType
from domain.search_entity import EventQuery

TIMESTAMP_FIELD = "@timestamp"
OBSERVABLE_FIELD = "soc.observables"
MESSAGE_FIELD = "message"


def event_to_document(event: NormalizedEvent) -> Mapping[str, Any]:
    """Project an event onto the indexed document shape."""
    return {
        TIMESTAMP_FIELD: event.occurred_at.isoformat(),
        "received_at": event.received_at.isoformat(),
        "event.id": str(event.event_id),
        "event.category": event.category,
        "event.action": event.action,
        "event.source": event.source,
        MESSAGE_FIELD: event.message,
        "host.name": event.host,
        "user.name": event.user,
        "soc.asset_criticality": event.asset_criticality.value,
        OBSERVABLE_FIELD: [str(o) for o in event.observables],
        "soc.observable_values": [o.value for o in event.observables],
        "soc.dedup_key": event.dedup_key,
    }


def indicator_to_document(indicator: Indicator) -> Mapping[str, Any]:
    """Project an indicator onto the indexed document shape."""
    return {
        TIMESTAMP_FIELD: indicator.last_seen.isoformat(),
        "indicator.id": str(indicator.indicator_id),
        "indicator.type": indicator.observable.type.value,
        "indicator.value": indicator.observable.value,
        "indicator.confidence": indicator.confidence.value,
        "indicator.status": indicator.status.value,
        "indicator.labels": list(indicator.threat_labels),
        "indicator.tlp": indicator.tlp.value,
        "indicator.source": indicator.source,
        "first_seen": indicator.first_seen.isoformat(),
    }


def _observable_from(text: str) -> Observable | None:
    """Rebuild an observable from its "type:value" indexed form."""
    kind, separator, value = text.partition(":")
    if not separator:
        return None
    try:
        return Observable(type=ObservableType(kind), value=value)
    except ValueError:
        return None


def _parse_timestamp(raw: object, fallback: datetime) -> datetime:
    """Read an ISO timestamp out of a document, tolerating a bad value."""
    if not isinstance(raw, str):
        return fallback
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return fallback


def document_to_event(source: Mapping[str, Any]) -> NormalizedEvent | None:
    """Rebuild an event from an indexed document, or None if unusable."""
    raw_id = source.get("event.id")
    if not isinstance(raw_id, str):
        return None
    try:
        event_id = UUID(raw_id)
    except ValueError:
        return None

    epoch = datetime.fromtimestamp(0, tz=UTC)
    occurred_at = _parse_timestamp(source.get(TIMESTAMP_FIELD), epoch)
    observables = tuple(
        o
        for o in (_observable_from(str(t)) for t in source.get(OBSERVABLE_FIELD, []) or [])
        if o is not None
    )

    try:
        criticality = AssetCriticality(str(source.get("soc.asset_criticality", "standard")))
    except ValueError:
        criticality = AssetCriticality.STANDARD

    return NormalizedEvent(
        event_id=event_id,
        source=str(source.get("event.source", "")),
        occurred_at=occurred_at,
        received_at=_parse_timestamp(source.get("received_at"), occurred_at),
        category=str(source.get("event.category", "")),
        action=str(source.get("event.action", "")),
        message=str(source.get(MESSAGE_FIELD, "")),
        host=source.get("host.name"),
        user=source.get("user.name"),
        asset_criticality=criticality,
        observables=observables,
        dedup_key=str(source.get("soc.dedup_key", "")),
    )


def query_to_dsl(query: EventQuery) -> Mapping[str, Any]:
    """Translate a domain query into the OpenSearch DSL."""
    filters: list[Mapping[str, Any]] = []

    if query.hosts:
        filters.append({"terms": {"host.name": list(query.hosts)}})
    if query.observables:
        filters.append({"terms": {OBSERVABLE_FIELD: [str(o) for o in query.observables]}})
    if query.text:
        filters.append({"match": {MESSAGE_FIELD: query.text}})

    bounds: dict[str, str] = {}
    if query.since:
        bounds["gte"] = query.since.isoformat()
    if query.until:
        bounds["lte"] = query.until.isoformat()
    if bounds:
        filters.append({"range": {TIMESTAMP_FIELD: bounds}})

    body: dict[str, Any] = {
        "query": {"bool": {"filter": filters}},
        "size": query.limit,
        "track_total_hits": True,
        "sort": [{TIMESTAMP_FIELD: "desc"}],
    }
    after = decode_cursor(query.cursor)
    if after is not None:
        body["search_after"] = after
    return body


def observable_count_dsl(value: str, since: datetime) -> Mapping[str, Any]:
    """Build a count query for one observable value since an instant."""
    return {
        "query": {
            "bool": {
                "filter": [
                    {"term": {"soc.observable_values": value}},
                    {"range": {TIMESTAMP_FIELD: {"gte": since.isoformat()}}},
                ]
            }
        }
    }


def encode_cursor(sort_values: Sequence[Any]) -> str:
    """Encode a hit's sort values as an opaque paging token.

    Paging on ``search_after`` rather than from/size, so deep pages do not hit
    the index.max_result_window ceiling.
    """
    import json

    return base64.urlsafe_b64encode(json.dumps(list(sort_values), default=str).encode()).decode()


def decode_cursor(cursor: str | None) -> list[Any] | None:
    """Decode a paging token, treating anything unreadable as the first page."""
    if not cursor:
        return None
    import json

    try:
        decoded = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
    except (ValueError, binascii.Error, UnicodeDecodeError):
        return None
    return decoded if isinstance(decoded, list) else None
