"""The anti-corruption layer for MISP.

Every piece of MISP-specific vocabulary is translated here and nowhere else:
attribute types, threat levels, TLP tags. Swapping MISP for another intel
platform means writing a sibling of this file — the domain never changes.
"""

from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

from domain.indicator_entity import Confidence, IndicatorIntel, TlpLevel
from domain.observable_entity import ObservableType
from domain.observable_policy import parse_observable

# MISP attribute type -> our observable type. Unlisted types are ignored
# rather than guessed at.
ATTRIBUTE_TYPES: Mapping[str, ObservableType] = {
    "ip-src": ObservableType.IPV4,
    "ip-dst": ObservableType.IPV4,
    "ip-src|port": ObservableType.IPV4,
    "ip-dst|port": ObservableType.IPV4,
    "domain": ObservableType.DOMAIN,
    "hostname": ObservableType.HOSTNAME,
    "url": ObservableType.URL,
    "md5": ObservableType.MD5,
    "sha1": ObservableType.SHA1,
    "sha256": ObservableType.SHA256,
    "filename|md5": ObservableType.MD5,
    "filename|sha1": ObservableType.SHA1,
    "filename|sha256": ObservableType.SHA256,
    "email-src": ObservableType.EMAIL,
    "email-dst": ObservableType.EMAIL,
    "filename": ObservableType.FILENAME,
}

# MISP threat_level_id -> base confidence. 1 is High, 4 is Undefined.
THREAT_LEVEL_CONFIDENCE: Mapping[str, int] = {
    "1": 80,
    "2": 60,
    "3": 35,
    "4": 25,
}
DEFAULT_CONFIDENCE = 25
TO_IDS_BONUS = 10
CONFIDENCE_CEILING = 100

TLP_TAGS: Mapping[str, TlpLevel] = {
    "tlp:clear": TlpLevel.CLEAR,
    "tlp:white": TlpLevel.CLEAR,
    "tlp:green": TlpLevel.GREEN,
    "tlp:amber": TlpLevel.AMBER,
    "tlp:amber+strict": TlpLevel.AMBER_STRICT,
    "tlp:red": TlpLevel.RED,
}

SOURCE_NAME = "threat_intel"


def _tags_of(event: Mapping[str, Any]) -> list[str]:
    """Return the lowercased tag names on a MISP event."""
    raw = event.get("Tag")
    if not isinstance(raw, list):
        return []
    return [str(tag["name"]).lower() for tag in raw if isinstance(tag, Mapping) and tag.get("name")]


def _tlp_of(tags: list[str]) -> TlpLevel:
    """Return the TLP level a tag set declares, defaulting to amber."""
    for tag in tags:
        level = TLP_TAGS.get(tag)
        if level is not None:
            return level
    return TlpLevel.AMBER


def _labels_of(tags: list[str]) -> tuple[str, ...]:
    """Return threat labels, stripping any namespace prefix.

    MISP tags are namespaced (``malware:c2``); the domain wants the bare
    label, because that is what scoring rules are written against.
    """
    labels: set[str] = set()
    for tag in tags:
        if tag.startswith("tlp:"):
            continue
        labels.add(tag.rsplit(":", 1)[-1])
    return tuple(sorted(labels))


def _confidence_of(event: Mapping[str, Any], to_ids: object) -> Confidence:
    """Derive confidence from threat level, raised when MISP marks it actionable."""
    level = str(event.get("threat_level_id", ""))
    score = THREAT_LEVEL_CONFIDENCE.get(level, DEFAULT_CONFIDENCE)
    if to_ids is True or to_ids == "1":
        score = min(CONFIDENCE_CEILING, score + TO_IDS_BONUS)
    return Confidence(score)


def _timestamp_of(attribute: Mapping[str, Any]) -> datetime | None:
    """Read MISP's epoch-seconds timestamp, tolerating a missing or bad value."""
    raw = attribute.get("timestamp")
    if raw is None:
        return None
    try:
        return datetime.fromtimestamp(int(raw), tz=UTC)
    except (TypeError, ValueError):
        return None


def to_indicator_intel(attribute: Mapping[str, Any]) -> IndicatorIntel | None:
    """Translate one MISP attribute into domain terms.

    Returns None for anything we cannot faithfully represent — an unknown
    attribute type or a malformed value — so one bad row never loses a page.
    """
    observable_type = ATTRIBUTE_TYPES.get(str(attribute.get("type", "")))
    if observable_type is None:
        return None

    raw_value = str(attribute.get("value", ""))
    # Composite types carry "value1|value2"; the artefact is the first part.
    observable = parse_observable(observable_type, raw_value.split("|")[0])
    if observable is None:
        return None

    event = attribute.get("Event")
    event_map: Mapping[str, Any] = event if isinstance(event, Mapping) else {}
    tags = _tags_of(event_map)
    seen_at = _timestamp_of(attribute)

    return IndicatorIntel(
        observable=observable,
        known=True,
        confidence=_confidence_of(event_map, attribute.get("to_ids")),
        threat_labels=_labels_of(tags),
        tlp=_tlp_of(tags),
        first_seen=seen_at,
        last_seen=seen_at,
        source=SOURCE_NAME,
        source_ref=str(attribute["id"]) if attribute.get("id") else None,
    )
