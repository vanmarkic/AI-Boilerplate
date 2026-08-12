"""The DFIR-IRIS adapter satisfies the CaseManagementPort contract.

Backed by a small in-memory fake IRIS over httpx.MockTransport, including its
success/error envelope — IRIS answers HTTP 200 with ``{"status": "error"}``,
which is exactly the kind of trap an anti-corruption layer exists to absorb.
"""

import json
from typing import Any

import httpx
import pytest

from adapters.contract.case_management_contract import CaseManagementContract, make_draft
from adapters.iris.iris_case_adapter import IrisCaseAdapter
from adapters.iris.iris_client import IrisClient
from adapters.resilient_client import HttpConfig, ResilientHttpClient
from application.case_management_port import CaseManagementPort
from domain.case_entity import CaseNote, CaseRef, CaseStatus
from domain.observable_entity import Observable, ObservableType
from domain.soc_error import IntegrationProtocolError

API_KEY = "test-iris-key"
IP = Observable(ObservableType.IPV4, "203.0.113.9")


async def _no_sleep(seconds: float) -> None:
    return None


class FakeIris:
    """Just enough DFIR-IRIS to exercise the adapter's wire format."""

    def __init__(self) -> None:
        self.cases: dict[str, dict[str, Any]] = {}
        self.notes: dict[str, list[dict[str, Any]]] = {}
        self.iocs: dict[str, list[dict[str, Any]]] = {}
        self._next = 1

    @staticmethod
    def _ok(data: object) -> httpx.Response:
        """IRIS wraps every answer in a success envelope."""
        return httpx.Response(200, json={"status": "success", "message": "", "data": data})

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        body = json.loads(request.read().decode() or "{}")
        parts = [p for p in path.split("/") if p]

        if request.method == "POST" and path == "/api/v2/cases":
            case_id = str(self._next)
            self._next += 1
            self.cases[case_id] = {
                "case_id": int(case_id),
                "case_name": body.get("case_name", ""),
                "case_soc_id": body.get("case_soc_id", ""),
                "status_id": 1,
            }
            self.notes[case_id] = []
            self.iocs[case_id] = []
            return self._ok(self.cases[case_id])

        if request.method == "GET" and path == "/api/v2/cases":
            return self._ok(list(self.cases.values()))

        if len(parts) >= 4 and parts[2] == "cases":
            case_id = parts[3]
            if case_id not in self.cases:
                return httpx.Response(404, json={"status": "error", "message": "not found"})
            if request.method == "GET":
                return self._ok(self.cases[case_id])
            if request.method == "PATCH":
                self.cases[case_id]["status_id"] = body.get("status_id", 1)
                return self._ok(self.cases[case_id])
            if request.method == "POST" and parts[-1] == "notes":
                self.notes[case_id].append(body)
                return self._ok(body)
            if request.method == "POST" and parts[-1] == "iocs":
                self.iocs[case_id].append(body)
                return self._ok(body)

        return httpx.Response(404, json={"status": "error", "message": "no route"})


def build(handler: object) -> IrisCaseAdapter:
    """Build an IRIS adapter over a canned transport."""
    http = ResilientHttpClient(
        HttpConfig(
            system="case_management",
            base_url="https://iris.invalid",
            headers=IrisClient.auth_headers(API_KEY),
        ),
        transport=httpx.MockTransport(handler),  # type: ignore[arg-type]
        sleep=_no_sleep,
    )
    return IrisCaseAdapter(IrisClient(http), customer_id=1)


class TestIrisCaseManagement(CaseManagementContract):
    """Runs the shared contract against the DFIR-IRIS implementation."""

    @pytest.fixture
    def port(self) -> CaseManagementPort:
        return build(FakeIris().handler)


class TestIrisWireFormat:
    """The vendor-specific details the contract cannot express."""

    async def test_api_key_is_sent_as_a_bearer_token(self) -> None:
        headers = IrisClient.auth_headers(API_KEY)
        assert headers["Authorization"] == f"Bearer {API_KEY}"

    async def test_opening_a_case_posts_the_correlation_key_as_soc_id(self) -> None:
        """The SOC id is how IRIS lets us find our own case again."""
        engine = FakeIris()
        ref = await build(engine.handler).open_case(make_draft("corr-abc"))
        assert engine.cases[ref.external_id]["case_soc_id"] == "corr-abc"

    async def test_case_ref_carries_a_navigable_url(self) -> None:
        ref = await build(FakeIris().handler).open_case(make_draft())
        assert ref.url is not None
        assert ref.external_id in ref.url

    async def test_an_error_envelope_on_http_200_is_not_treated_as_success(self) -> None:
        """IRIS reports failure inside a 200; missing that would lose a case."""

        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(200, json={"status": "error", "message": "quota exceeded"})

        with pytest.raises(IntegrationProtocolError):
            await build(handler).open_case(make_draft())

    async def test_notes_are_posted_to_the_case_notes_endpoint(self) -> None:
        engine = FakeIris()
        adapter = build(engine.handler)
        ref = await adapter.open_case(make_draft())

        await adapter.add_note(ref, CaseNote(title="Triage", body="Confirmed", author="alice"))

        assert engine.notes[ref.external_id][0]["note_title"] == "Triage"

    async def test_observables_are_posted_as_iocs(self) -> None:
        engine = FakeIris()
        adapter = build(engine.handler)
        ref = await adapter.open_case(make_draft())

        await adapter.attach_observables(ref, [IP])

        posted = engine.iocs[ref.external_id][0]
        assert posted["ioc_value"] == IP.value
        assert isinstance(posted["ioc_type_id"], int)

    async def test_status_is_translated_to_iris_numeric_ids(self) -> None:
        """IRIS status ids are numbers; the domain speaks names."""
        engine = FakeIris()
        adapter = build(engine.handler)
        ref = await adapter.open_case(make_draft())

        await adapter.transition(ref, CaseStatus.CLOSED_RESOLVED)

        assert engine.cases[ref.external_id]["status_id"] != 1

    async def test_fetching_a_missing_case_returns_none_not_an_error(self) -> None:
        adapter = build(FakeIris().handler)
        assert await adapter.fetch_case(CaseRef(system="iris", external_id="404")) is None
