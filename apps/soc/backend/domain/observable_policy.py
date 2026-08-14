"""Canonicalisation and extraction of observables. Pure, stdlib only."""

import ipaddress
import re

from domain.observable_entity import Observable, ObservableType
from domain.soc_error import InvalidIndicatorError

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

# Extraction runs on untrusted text inside a request. Every repeat below is
# bounded, because an unbounded one is not merely slow: "\b" matches at every
# hyphen (a hyphen is not a word character), so an unbounded label pattern gets
# O(n) start positions each backtracking over O(n) characters. On 64 KB of
# "a-a-a..." that measured 50 seconds of CPU inside the event loop.
#
# The bounds are the real protocol limits, so nothing legitimate is lost:
# a DNS label is at most 63 characters (RFC 1035) and a TLD at most 63.
_LABEL = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"

_IPV4_FIND_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
_DOMAIN_FIND_RE = re.compile(rf"\b(?:{_LABEL}\.){{1,32}}[a-z]{{2,63}}\b")
_URL_FIND_RE = re.compile(r"\bhttps?://[^\s\"'<>]{1,2048}", re.IGNORECASE)
_EMAIL_FIND_RE = re.compile(
    r"\b[a-z0-9._%+-]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,63}\b", re.IGNORECASE
)
# Exactly the three lengths _HASH_LENGTHS knows, longest first so the alternation
# never leaves a longer hash half-matched.
_HASH_FIND_RE = re.compile(r"\b(?:[0-9a-f]{64}|[0-9a-f]{40}|[0-9a-f]{32})\b", re.IGNORECASE)

# How much of one string extraction will look at. A syslog line is under 2 KB
# and RFC 5424 caps a transport at 8 KB, so this is generous for real telemetry
# while keeping the worst case bounded regardless of which adapter calls in.
MAX_SCAN_CHARS = 16_384


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


def _scannable(text: str) -> str:
    """Return the leading slice of text extraction is willing to scan.

    Truncation falls back to the last whitespace so a token is never cut in
    half: ``evil.example`` sliced at eight characters is ``evil.exa``, still a
    well-formed domain and a wrong one. Dropping a partial token is safe;
    reporting an artefact nobody sent is not.
    """
    if len(text) <= MAX_SCAN_CHARS:
        return text
    window = text[:MAX_SCAN_CHARS]
    cut = window.rfind(" ")
    return window[:cut] if cut > 0 else window


def extract_observables(text: str) -> tuple[Observable, ...]:
    """Pull every recognisable artefact out of free text, deduplicated.

    Order is stable (URLs, emails, IPs, domains, hashes) so callers and tests
    can rely on it.  A URL's host is emitted as its own DOMAIN observable in
    addition to the URL: the host is worth looking up against threat intel
    independently of the full path.

    Only the first ``MAX_SCAN_CHARS`` characters are scanned. The input is
    untrusted and this runs in a request, so the cost of one string has to be
    bounded; an artefact past the cap is not extracted.
    """
    found: list[Observable] = []
    seen: set[Observable] = set()
    refanged = refang(_scannable(text))

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
