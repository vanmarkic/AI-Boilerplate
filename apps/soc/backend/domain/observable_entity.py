"""Observables: the atoms of security telemetry.

An ``Observable`` is always stored canonical (refanged, lowercased, no
trailing dot).  ``observable_policy`` owns canonicalisation; constructing one
by hand with a non-canonical value is a bug.
"""

from dataclasses import dataclass
from enum import StrEnum


class ObservableType(StrEnum):
    """The kinds of artefact the platform can reason about."""

    IPV4 = "ipv4"
    IPV6 = "ipv6"
    DOMAIN = "domain"
    HOSTNAME = "hostname"
    URL = "url"
    MD5 = "md5"
    SHA1 = "sha1"
    SHA256 = "sha256"
    EMAIL = "email"
    FILENAME = "filename"


HASH_TYPES: frozenset[ObservableType] = frozenset(
    {ObservableType.MD5, ObservableType.SHA1, ObservableType.SHA256}
)

NETWORK_TYPES: frozenset[ObservableType] = frozenset(
    {
        ObservableType.IPV4,
        ObservableType.IPV6,
        ObservableType.DOMAIN,
        ObservableType.HOSTNAME,
        ObservableType.URL,
    }
)


@dataclass(frozen=True, slots=True)
class Observable:
    """A single canonical artefact extracted from an event."""

    type: ObservableType
    value: str

    def __str__(self) -> str:
        return f"{self.type.value}:{self.value}"
