"""Canonicalisation and extraction of observables. Pure, stdlib only."""

import ipaddress
import re

from domain.errors_entity import InvalidIndicatorError
from domain.observable_entity import Observable, ObservableType

_DEFANG_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("[.]", "."),
    ("(.)", "."),
    ("[:]", ":"),
    ("[@]", "@"),
    ("[at]", "@"),
    ("hxxp", "http"),
    ("hxxps", "https"),
)

_HASH_LENGTHS: dict[ObservableType, int] = {
    ObservableType.MD5: 32,
    ObservableType.SHA1: 40,
    ObservableType.SHA256: 64,
}

_HEX_RE = re.compile(r"^[0-9a-f]+$")
_DOMAIN_RE = re.compile(r"^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

_IPV4_FIND_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_DOMAIN_FIND_RE = re.compile(r"\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b")
_URL_FIND_RE = re.compile(r"\bhttps?://[^\s\"'<>]+", re.IGNORECASE)
_EMAIL_FIND_RE = re.compile(r"\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b", re.IGNORECASE)
_HASH_FIND_RE = re.compile(r"\b[0-9a-f]{32}(?:[0-9a-f]{8})?(?:[0-9a-f]{24})?\b", re.IGNORECASE)


def refang(value: str) -> str:
    """Turn a defanged artefact back into its real form."""
    result = value
    for token, replacement in _DEFANG_REPLACEMENTS:
        result = result.replace(token, replacement)
    return result


def defang(value: str) -> str:
    """Render an artefact safe to display or paste."""
    return value.replace("http", "hxxp").replace(".", "[.]")


def canonicalize(observable_type: ObservableType, value: str) -> str:
    """Return the canonical form of a value for its type.

    Canonical means: refanged, whitespace-stripped, lowercased where the type
    is case-insensitive, and free of a trailing dot. Storing anything else
    silently breaks deduplication.
    """
    text = refang(value.strip())
    if observable_type in _HASH_LENGTHS:
        return text.lower()
    if observable_type in (ObservableType.DOMAIN, ObservableType.HOSTNAME):
        return text.rstrip(".").lower()
    if observable_type in (ObservableType.IPV4, ObservableType.IPV6):
        return text.lower()
    if observable_type is ObservableType.EMAIL:
        return text.lower()
    if observable_type is ObservableType.URL:
        scheme, separator, rest = text.partition("://")
        if not separator:
            return text
        host, slash, path = rest.partition("/")
        return f"{scheme.lower()}://{host.lower()}{slash}{path}"
    return text


def _is_valid(observable_type: ObservableType, value: str) -> bool:
    """Return True if a canonical value is well-formed for its type."""
    expected_length = _HASH_LENGTHS.get(observable_type)
    if expected_length is not None:
        return len(value) == expected_length and bool(_HEX_RE.match(value))
    if observable_type is ObservableType.IPV4:
        try:
            return isinstance(ipaddress.ip_address(value), ipaddress.IPv4Address)
        except ValueError:
            return False
    if observable_type is ObservableType.IPV6:
        try:
            return isinstance(ipaddress.ip_address(value), ipaddress.IPv6Address)
        except ValueError:
            return False
    if observable_type in (ObservableType.DOMAIN, ObservableType.HOSTNAME):
        return bool(_DOMAIN_RE.match(value))
    if observable_type is ObservableType.EMAIL:
        return bool(_EMAIL_RE.match(value))
    if observable_type is ObservableType.URL:
        return value.startswith(("http://", "https://"))
    return bool(value)


def parse_observable(observable_type: ObservableType, value: str) -> Observable | None:
    """Canonicalise and validate; return None if the value is malformed."""
    canonical = canonicalize(observable_type, value)
    if not canonical or not _is_valid(observable_type, canonical):
        return None
    return Observable(type=observable_type, value=canonical)


def require_observable(observable_type: ObservableType, value: str) -> Observable:
    """Like ``parse_observable`` but raises instead of returning None."""
    observable = parse_observable(observable_type, value)
    if observable is None:
        raise InvalidIndicatorError(f"malformed {observable_type.value}: {value!r}")
    return observable


def _hash_type_for(value: str) -> ObservableType | None:
    """Return the hash type matching a hex string's length."""
    for hash_type, length in _HASH_LENGTHS.items():
        if len(value) == length:
            return hash_type
    return None


def extract_observables(text: str) -> tuple[Observable, ...]:
    """Pull every recognisable artefact out of free text, deduplicated.

    Order is stable (URLs, emails, IPs, domains, hashes) so callers and tests
    can rely on it.  A URL's host is emitted as its own DOMAIN observable in
    addition to the URL: the host is worth looking up against threat intel
    independently of the full path.
    """
    found: list[Observable] = []
    seen: set[Observable] = set()
    refanged = refang(text)

    def add(observable_type: ObservableType, raw: str) -> None:
        observable = parse_observable(observable_type, raw)
        if observable is not None and observable not in seen:
            seen.add(observable)
            found.append(observable)

    for match in _URL_FIND_RE.findall(refanged):
        add(ObservableType.URL, match)
    for match in _EMAIL_FIND_RE.findall(refanged):
        add(ObservableType.EMAIL, match)
    for match in _IPV4_FIND_RE.findall(refanged):
        add(ObservableType.IPV4, match)
    for match in _DOMAIN_FIND_RE.findall(refanged.lower()):
        add(ObservableType.DOMAIN, match)
    for match in _HASH_FIND_RE.findall(refanged):
        hash_type = _hash_type_for(match)
        if hash_type is not None:
            add(hash_type, match)

    return tuple(found)
