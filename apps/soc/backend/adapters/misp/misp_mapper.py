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

# MISP attribute type -> (our observable type, which "|"-separated part holds
# the artefact). Unlisted types are ignored rather than guessed at.
#
# The part index is explicit because MISP's composite types are not consistent
# about it: ``ip-dst|port`` is "203.0.113.9|8443" (artefact first) while
# ``filename|md5`` is "evil.exe|d41d8cd9…" (artefact second). Inferring one rule
# from the other silently discards every file hash MISP publishes.
ATTRIBUTE_TYPES: Mapping[str, tuple[ObservableType, int]] = {
    "ip-src": (ObservableType.IPV4, 0),
    "ip-dst": (ObservableType.IPV4, 0),
    "ip-src|port": (ObservableType.IPV4, 0),
    "ip-dst|port": (ObservableType.IPV4, 0),
    "domain": (ObservableType.DOMAIN, 0),
    "hostname": (ObservableType.HOSTNAME, 0),
    "url": (ObservableType.URL, 0),
    "md5": (ObservableType.MD5, 0),
    "sha1": (ObservableType.SHA1, 0),
    "sha256": (ObservableType.SHA256, 0),
    "filename|md5": (ObservableType.MD5, 1),
    "filename|sha1": (ObservableType.SHA1, 1),
    "filename|sha256": (ObservableType.SHA256, 1),
    "email-src": (ObservableType.EMAIL, 0),
    "email-dst": (ObservableType.EMAIL, 0),
    "filename": (ObservableType.FILENAME, 0),
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
    mapping = ATTRIBUTE_TYPES.get(str(attribute.get("type", "")))
    if mapping is None:
        return None
    observable_type, part = mapping

    # Composite types carry "value1|value2"; which half is the artefact is
    # declared per type in ATTRIBUTE_TYPES, never inferred. A composite missing
    # its artefact half is dropped rather than falling back to the other one.
    parts = str(attribute.get("value", "")).split("|")
    if part >= len(parts):
        return None

    observable = parse_observable(observable_type, parts[part])
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
