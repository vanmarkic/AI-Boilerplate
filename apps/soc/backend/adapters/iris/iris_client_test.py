"""Unwrapping the case system's response envelope.

The trap this class exists for: IRIS answers HTTP 200 with a
``{"status": ..., "data": ...}`` envelope, so a failed operation looks like a
successful request. The trap it introduced: deciding "this is an envelope" from
the presence of ``status`` alone, when a *case* has a status of its own.
"""

import httpx
import pytest

from adapters.iris.iris_client import IrisClient
from adapters.resilient_client import HttpConfig, ResilientHttpClient
from domain.soc_error import IntegrationProtocolError

# Stands in for anything a vendor might echo back on rejection: a
# credential we sent, or a value out of the case body.
ECHOED_BACK = "aW5uZXItdmFsdWU"


async def _no_sleep(seconds: float) -> None:
    return None


def build(payload: object, *, status_code: int = 200) -> IrisClient:
    """Build a client whose single endpoint returns one canned body."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json=payload)

    return IrisClient(
        ResilientHttpClient(
            HttpConfig(system="case_management", base_url="https://iris.invalid"),
            transport=httpx.MockTransport(handler),
            sleep=_no_sleep,
        )
    )


class TestEnvelopeDetection:
    """An envelope is recognised by its shape, not by one key."""

    async def test_a_wrapped_success_yields_its_data(self) -> None:
        client = build({"status": "success", "data": {"case_id": 42}})
        assert await client.request("GET", "/cases/42") == {"case_id": 42}

    async def test_a_wrapped_error_raises(self) -> None:
        client = build({"status": "error", "data": {}})
        with pytest.raises(IntegrationProtocolError):
            await client.request("POST", "/cases")

    async def test_an_unwrapped_case_is_returned_as_is(self) -> None:
        """The regression: a case carries its own status, and "open" is not "success".

        Reading this as a failed envelope reported a successfully opened case as
        a protocol error — in exactly the deployment the bare-object branch
        exists to support.
        """
        case = {"case_id": 42, "case_name": "Suspicious login", "status": "open"}
        assert await build(case).request("GET", "/cases/42") == case

    @pytest.mark.parametrize(
        "payload",
        [
            {"status": "success"},
            {"data": {"case_id": 1}},
            {"status": "closed", "case_name": "c"},
            {"status": 3, "owner": "analyst"},
        ],
        ids=["status-only", "data-only", "case-like", "numeric-status"],
    )
    async def test_a_half_shaped_body_is_not_treated_as_an_envelope(
        self, payload: dict[str, object]
    ) -> None:
        assert await build(payload).request("GET", "/cases/1") == payload

    async def test_a_non_mapping_body_is_returned_as_is(self) -> None:
        assert await build([1, 2, 3]).request("GET", "/cases") == [1, 2, 3]


class TestErrorsDoNotLeakTheBody:
    """The transport promises never to log a response body. So does this."""

    async def test_an_envelope_message_stays_out_of_the_error(self) -> None:
        client = build({"status": "error", "data": {}, "message": f"rejected: {ECHOED_BACK}"})
        with pytest.raises(IntegrationProtocolError) as caught:
            await client.request("POST", "/cases")
        assert ECHOED_BACK not in str(caught.value)

    async def test_the_error_still_names_where_it_happened(self) -> None:
        client = build({"status": "error", "data": {}, "message": "whatever"})
        with pytest.raises(IntegrationProtocolError) as caught:
            await client.request("POST", "/cases")
        assert "POST /cases" in str(caught.value)
