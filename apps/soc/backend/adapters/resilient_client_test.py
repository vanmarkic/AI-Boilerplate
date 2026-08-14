"""The shared vendor transport: retries, timeouts, and error mapping.

Every request is served by httpx.MockTransport, so these run with no network.
``sleep`` is injected as a no-op, so retry/backoff tests are instant.
"""

import httpx
import pytest

from adapters.resilient_client import HttpConfig, ResilientHttpClient
from domain.soc_error import (
    IntegrationAuthError,
    IntegrationProtocolError,
    IntegrationRejectedError,
    IntegrationUnavailableError,
)


async def _no_sleep(seconds: float) -> None:
    """Skip backoff waits so tests do not spend real time."""
    return None


def build(handler: object, *, max_attempts: int = 3) -> ResilientHttpClient:
    """Build a client whose transport is a canned handler."""
    return ResilientHttpClient(
        HttpConfig(
            system="test_system",
            base_url="https://vendor.invalid",
            max_attempts=max_attempts,
            headers={"X-Fixed": "1"},
        ),
        transport=httpx.MockTransport(handler),  # type: ignore[arg-type]
        sleep=_no_sleep,
    )


class TestSuccessfulRequests:
    """The happy path, and what the client sends."""

    async def test_returns_decoded_json(self) -> None:
        client = build(lambda request: httpx.Response(200, json={"ok": True}))
        assert await client.request_json("GET", "/thing") == {"ok": True}
        await client.aclose()

    async def test_sends_configured_headers(self) -> None:
        seen: dict[str, str] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen.update(request.headers)
            return httpx.Response(200, json={})

        client = build(handler)
        await client.request_json("GET", "/thing")
        assert seen["x-fixed"] == "1"
        await client.aclose()

    async def test_joins_path_onto_the_base_url(self) -> None:
        seen: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(str(request.url))
            return httpx.Response(200, json={})

        client = build(handler)
        await client.request_json("GET", "/a/b")
        assert seen == ["https://vendor.invalid/a/b"]
        await client.aclose()

    async def test_empty_body_decodes_to_none(self) -> None:
        """A 204 is a legitimate answer, not a protocol error."""
        client = build(lambda request: httpx.Response(204))
        assert await client.request_json("DELETE", "/thing") is None
        await client.aclose()


class TestErrorMapping:
    """Vendor HTTP failures become the shared, vendor-neutral taxonomy."""

    @pytest.mark.parametrize("status", [401, 403])
    async def test_auth_failures(self, status: int) -> None:
        client = build(lambda request: httpx.Response(status, json={}))
        with pytest.raises(IntegrationAuthError):
            await client.request_json("GET", "/thing")
        await client.aclose()

    @pytest.mark.parametrize("status", [400, 404, 409, 422])
    async def test_client_errors_are_rejections(self, status: int) -> None:
        client = build(lambda request: httpx.Response(status, json={}))
        with pytest.raises(IntegrationRejectedError):
            await client.request_json("GET", "/thing")
        await client.aclose()

    async def test_server_errors_become_unavailable(self) -> None:
        client = build(lambda request: httpx.Response(503, json={}))
        with pytest.raises(IntegrationUnavailableError):
            await client.request_json("GET", "/thing")
        await client.aclose()

    async def test_transport_failure_becomes_unavailable(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("refused", request=request)

        client = build(handler)
        with pytest.raises(IntegrationUnavailableError):
            await client.request_json("GET", "/thing")
        await client.aclose()

    async def test_unparseable_body_becomes_a_protocol_error(self) -> None:
        client = build(lambda request: httpx.Response(200, content=b"<html>nope"))
        with pytest.raises(IntegrationProtocolError):
            await client.request_json("GET", "/thing")
        await client.aclose()

    async def test_errors_name_the_logical_system_not_the_vendor(self) -> None:
        """The core learns which capability failed, never which product."""
        client = build(lambda request: httpx.Response(503, json={}))
        with pytest.raises(IntegrationUnavailableError) as caught:
            await client.request_json("GET", "/thing")
        assert caught.value.system == "test_system"
        await client.aclose()

    async def test_error_text_never_includes_the_response_body(self) -> None:
        """Bodies can carry credentials or personal data; they must not leak."""
        secret = "super-secret-token-value"  # noqa: S105 - a fixture, not a credential
        client = build(lambda request: httpx.Response(500, json={"token": secret}))
        with pytest.raises(IntegrationUnavailableError) as caught:
            await client.request_json("GET", "/thing")
        assert secret not in str(caught.value)
        await client.aclose()


class TestRetries:
    """Transient failures are retried; permanent ones are not."""

    async def test_retries_until_success(self) -> None:
        attempts = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            attempts["n"] += 1
            if attempts["n"] < 3:
                return httpx.Response(503, json={})
            return httpx.Response(200, json={"ok": True})

        client = build(handler)
        assert await client.request_json("GET", "/thing") == {"ok": True}
        assert attempts["n"] == 3
        await client.aclose()

    async def test_gives_up_after_max_attempts(self) -> None:
        attempts = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            attempts["n"] += 1
            return httpx.Response(503, json={})

        client = build(handler, max_attempts=2)
        with pytest.raises(IntegrationUnavailableError):
            await client.request_json("GET", "/thing")
        assert attempts["n"] == 2
        await client.aclose()

    async def test_rate_limiting_is_retried(self) -> None:
        attempts = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            attempts["n"] += 1
            if attempts["n"] == 1:
                return httpx.Response(429, headers={"Retry-After": "1"}, json={})
            return httpx.Response(200, json={"ok": True})

        client = build(handler)
        assert await client.request_json("GET", "/thing") == {"ok": True}
        assert attempts["n"] == 2
        await client.aclose()

    async def test_client_errors_are_not_retried(self) -> None:
        """Retrying a 400 just repeats our own mistake."""
        attempts = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            attempts["n"] += 1
            return httpx.Response(400, json={})

        client = build(handler)
        with pytest.raises(IntegrationRejectedError):
            await client.request_json("GET", "/thing")
        assert attempts["n"] == 1
        await client.aclose()

    async def test_auth_failures_are_not_retried(self) -> None:
        attempts = {"n": 0}

        def handler(request: httpx.Request) -> httpx.Response:
            attempts["n"] += 1
            return httpx.Response(401, json={})

        client = build(handler)
        with pytest.raises(IntegrationAuthError):
            await client.request_json("GET", "/thing")
        assert attempts["n"] == 1
        await client.aclose()


class TestRetryIsMethodAware:
    """Retrying a write can perform it twice. Only safe methods are replayed.

    A transport error after the server accepted the request is indistinguishable
    from one it never received. For GET that is harmless; for the POST that
    launches containment it is a second launch, below every idempotency guard
    the core has.
    """

    def _counting(self, outcome: str) -> tuple[object, list[str]]:
        """Return a handler recording each attempt, and the record."""
        seen: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            seen.append(request.method)
            if outcome == "transport":
                raise httpx.ConnectError("boom")
            return httpx.Response(503, json={})

        return handler, seen

    @pytest.mark.parametrize("outcome", ["transport", "unavailable"])
    @pytest.mark.parametrize("method", ["GET", "HEAD", "PUT", "DELETE"])
    async def test_a_safe_method_is_retried(self, method: str, outcome: str) -> None:
        handler, seen = self._counting(outcome)
        with pytest.raises(IntegrationUnavailableError):
            await build(handler).request_json(method, "/thing")
        assert len(seen) == 3

    @pytest.mark.parametrize("outcome", ["transport", "unavailable"])
    @pytest.mark.parametrize("method", ["POST", "PATCH"])
    async def test_an_unsafe_method_is_not_retried(self, method: str, outcome: str) -> None:
        """The whole point: one attempt, so the write happens at most once."""
        handler, seen = self._counting(outcome)
        with pytest.raises(IntegrationUnavailableError):
            await build(handler).request_json(method, "/thing")
        assert seen == [method]

    @pytest.mark.parametrize("outcome", ["transport", "unavailable"])
    async def test_an_unsafe_method_may_opt_in(self, outcome: str) -> None:
        """A caller that knows its POST is idempotent can ask for retries."""
        handler, seen = self._counting(outcome)
        with pytest.raises(IntegrationUnavailableError):
            await build(handler).request_json("POST", "/thing", retry_unsafe=True)
        assert len(seen) == 3

    async def test_the_method_check_is_case_insensitive(self) -> None:
        handler, seen = self._counting("transport")
        with pytest.raises(IntegrationUnavailableError):
            await build(handler).request_json("post", "/thing")
        assert len(seen) == 1

    async def test_a_declined_retry_still_reports_unavailable(self) -> None:
        """Not retrying must not change what the caller is told."""
        handler, _ = self._counting("transport")
        with pytest.raises(IntegrationUnavailableError, match="transport failure"):
            await build(handler).request_json("POST", "/thing")
