"""The MISP adapter satisfies the ThreatIntelPort contract.

Served entirely by httpx.MockTransport against handcrafted response fixtures
matching MISP's documented REST shapes. No MISP instance is involved, and none
is required to run this suite.
"""

from datetime import UTC, datetime

import httpx
import pytest

from adapters.contract.threat_intel_contract import ThreatIntelContract
from adapters.misp.misp_client import MispClient
from adapters.misp.misp_threat_intel_adapter import MispThreatIntelAdapter
from adapters.resilient_client import HttpConfig, ResilientHttpClient
from application.threat_intel_port import ThreatIntelPort
from domain.observable_entity import Observable, ObservableType
from domain.soc_error import IntegrationAuthError

API_KEY = "test-misp-key"
KNOWN = Observable(ObservableType.IPV4, "203.0.113.9")
SEEDED_AT = datetime(2026, 1, 1, tzinfo=UTC)

# One attribute, in the shape MISP's /attributes/restSearch returns.
ATTRIBUTE = {
    "id": "12345",
    "event_id": "42",
    "type": "ip-dst",
    "category": "Network activity",
    "to_ids": True,
    "value": KNOWN.value,
    "timestamp": str(int(SEEDED_AT.timestamp())),
    "Event": {
        "id": "42",
        "info": "C2 infrastructure",
        "threat_level_id": "1",
        "Tag": [{"name": "tlp:amber"}, {"name": "malware:c2"}],
    },
}


async def _no_sleep(seconds: float) -> None:
    return None


def _handler(request: httpx.Request) -> httpx.Response:
    """Answer the MISP endpoints the adapter uses."""
    path = request.url.path
    if path == "/attributes/restSearch":
        body = request.read().decode() or "{}"
        wanted = KNOWN.value in body
        timestamp_only = '"value"' not in body
        matched = [ATTRIBUTE] if (wanted or timestamp_only) else []
        return httpx.Response(200, json={"response": {"Attribute": matched}})
    if path == "/sightings/add":
        return httpx.Response(200, json={"message": "1 sighting added"})
    return httpx.Response(404, json={"message": "not found"})


def build(handler: object = _handler) -> MispThreatIntelAdapter:
    """Build a MISP adapter over a canned transport."""
    transport = httpx.MockTransport(handler)  # type: ignore[arg-type]
    http = ResilientHttpClient(
        HttpConfig(
            system="threat_intel",
            base_url="https://misp.invalid",
            headers=MispClient.auth_headers(API_KEY),
        ),
        transport=transport,
        sleep=_no_sleep,
    )
    return MispThreatIntelAdapter(MispClient(http))


class TestMispThreatIntel(ThreatIntelContract):
    """Runs the shared contract against the MISP implementation."""

    @pytest.fixture
    def port(self) -> ThreatIntelPort:
        return build()

    @pytest.fixture
    def known(self) -> Observable:
        return KNOWN

    @pytest.fixture
    def seeded_at(self) -> datetime:
        return datetime(2025, 1, 1, tzinfo=UTC)


class TestMispWireFormat:
    """The vendor-specific details the contract cannot express."""

    async def test_api_key_is_sent_bare_without_a_bearer_scheme(self) -> None:
        """MISP expects the raw key; adding "Bearer " silently 403s."""
        headers = MispClient.auth_headers(API_KEY)
        assert headers["Authorization"] == API_KEY
        assert headers["Accept"] == "application/json"

    async def test_lookup_posts_to_rest_search(self) -> None:
        seen: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen["path"] = request.url.path
            seen["method"] = request.method
            seen["body"] = request.read().decode()
            return httpx.Response(200, json={"response": {"Attribute": [ATTRIBUTE]}})

        await build(handler).lookup(KNOWN)

        assert seen["method"] == "POST"
        assert seen["path"] == "/attributes/restSearch"
        assert "returnFormat" in seen["body"]
        assert KNOWN.value in seen["body"]

    async def test_threat_level_maps_to_confidence(self) -> None:
        """threat_level_id 1 (High) scores 80, plus 10 because to_ids is set."""
        intel = await build().lookup(KNOWN)
        assert intel is not None
        assert intel.confidence.value == 90

    async def test_to_ids_flag_raises_confidence(self) -> None:
        """to_ids is MISP saying "act on this", which is worth more than a label."""

        def handler(request: httpx.Request) -> httpx.Response:
            passive = {**ATTRIBUTE, "to_ids": False}
            return httpx.Response(200, json={"response": {"Attribute": [passive]}})

        intel = await build(handler).lookup(KNOWN)
        assert intel is not None
        assert intel.confidence.value == 80

    @pytest.mark.parametrize(
        ("threat_level", "expected"),
        [("1", 80), ("2", 60), ("3", 35), ("4", 25), ("", 25)],
    )
    async def test_each_threat_level_has_a_confidence(
        self, threat_level: str, expected: int
    ) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            event = {**ATTRIBUTE["Event"], "threat_level_id": threat_level}  # type: ignore[dict-item]
            attribute = {**ATTRIBUTE, "to_ids": False, "Event": event}
            return httpx.Response(200, json={"response": {"Attribute": [attribute]}})

        intel = await build(handler).lookup(KNOWN)
        assert intel is not None
        assert intel.confidence.value == expected

    async def test_tlp_tag_is_honoured(self) -> None:
        intel = await build().lookup(KNOWN)
        assert intel is not None
        assert intel.tlp.value == "amber"

    async def test_threat_labels_come_from_tags(self) -> None:
        intel = await build().lookup(KNOWN)
        assert intel is not None
        assert "c2" in intel.threat_labels

    async def test_attribute_type_maps_to_our_observable_type(self) -> None:
        """ip-dst is MISP's vocabulary; ipv4 is ours."""
        intel = await build().lookup(KNOWN)
        assert intel is not None
        assert intel.observable.type is ObservableType.IPV4

    async def test_source_is_reported_as_the_capability_not_the_product(self) -> None:
        intel = await build().lookup(KNOWN)
        assert intel is not None
        assert intel.source_ref == "12345"

    async def test_unparseable_attribute_is_skipped_not_fatal(self) -> None:
        """One malformed row must not lose the whole page."""

        def handler(request: httpx.Request) -> httpx.Response:
            junk = {"type": "ip-dst", "value": "not-an-ip", "Event": {}}
            return httpx.Response(200, json={"response": {"Attribute": [junk, ATTRIBUTE]}})

        results = await build(handler).bulk_lookup([KNOWN])
        assert set(results) == {KNOWN}

    async def test_rejected_credentials_surface_as_an_auth_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(403, json={"message": "Authentication failed"})

        with pytest.raises(IntegrationAuthError):
            await build(handler).lookup(KNOWN)

    async def test_pull_since_filters_by_timestamp(self) -> None:
        seen: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen["body"] = request.read().decode()
            return httpx.Response(200, json={"response": {"Attribute": [ATTRIBUTE]}})

        await build(handler).pull_since(SEEDED_AT)
        assert "timestamp" in seen["body"]

    async def test_publishing_a_sighting_posts_the_value(self) -> None:
        seen: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen["path"] = request.url.path
            seen["body"] = request.read().decode()
            return httpx.Response(200, json={"message": "1 sighting added"})

        await build(handler).publish_sighting(KNOWN, SEEDED_AT)
        assert seen["path"] == "/sightings/add"
        assert KNOWN.value in seen["body"]

    async def test_empty_response_means_unknown_not_broken(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"response": {"Attribute": []}})

        assert await build(handler).lookup(KNOWN) is None
