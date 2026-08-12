"""Allowlist matching: exact, domain-suffix and CIDR. Pure, stdlib only."""

import ipaddress
from collections.abc import Sequence
from datetime import datetime

from domain.indicator_entity import AllowlistEntry, MatchKind
from domain.observable_entity import Observable, ObservableType

_IP_TYPES = (ObservableType.IPV4, ObservableType.IPV6)
_HOST_TYPES = (ObservableType.DOMAIN, ObservableType.HOSTNAME)


def is_active(entry: AllowlistEntry, now: datetime) -> bool:
    """Return True if an entry has not expired."""
    return entry.expires_at is None or entry.expires_at > now


def _matches_domain_suffix(entry_value: str, observable: Observable) -> bool:
    """Return True if the observable is the domain or a subdomain of it."""
    if observable.type not in _HOST_TYPES:
        return False
    return observable.value == entry_value or observable.value.endswith(f".{entry_value}")


def _matches_cidr(entry_value: str, observable: Observable) -> bool:
    """Return True if the observable is an address inside the entry's network."""
    if observable.type not in _IP_TYPES:
        return False
    try:
        network = ipaddress.ip_network(entry_value, strict=False)
        address = ipaddress.ip_address(observable.value)
    except ValueError:
        return False
    return address in network


def matches(entry: AllowlistEntry, observable: Observable, now: datetime) -> bool:
    """Return True if an active allowlist entry covers this observable."""
    if not is_active(entry, now):
        return False
    if entry.match_kind is MatchKind.EXACT:
        return entry.observable == observable
    if entry.match_kind is MatchKind.DOMAIN_SUFFIX:
        return _matches_domain_suffix(entry.observable.value, observable)
    if entry.match_kind is MatchKind.CIDR:
        return _matches_cidr(entry.observable.value, observable)
    return False


def is_allowlisted(
    observable: Observable,
    entries: Sequence[AllowlistEntry],
    now: datetime,
) -> bool:
    """Return True if any active entry covers this observable."""
    return any(matches(entry, observable, now) for entry in entries)


def allowlisted_set(
    observables: Sequence[Observable],
    entries: Sequence[AllowlistEntry],
    now: datetime,
) -> frozenset[Observable]:
    """Return the subset of observables that are allowlisted."""
    return frozenset(o for o in observables if is_allowlisted(o, entries, now))
