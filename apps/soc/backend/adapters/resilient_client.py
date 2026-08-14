"""Shared transport for every vendor adapter.

Absorbs the concerns each integration would otherwise reimplement — timeouts,
bounded retry with backoff, and mapping HTTP failures onto the vendor-neutral
error taxonomy — so an adapter is left with only the part that is genuinely
vendor-specific: endpoints and payload shapes.

Nothing here ever logs a response body, a header or a query string: those carry
API keys and personal data. Errors name the method, the host and the status.
"""

import asyncio
import math
import secrets
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass, field

import httpx

from domain.soc_error import (
    IntegrationAuthError,
    IntegrationProtocolError,
    IntegrationRejectedError,
    IntegrationUnavailableError,
)

RETRYABLE_STATUSES = frozenset({429, 500, 502, 503, 504})
AUTH_STATUSES = frozenset({401, 403})
MAX_JITTER_SECONDS = 0.1

# Methods RFC 9110 §9.2.2 defines as idempotent: replaying one has the same
# effect as issuing it once, so a retry cannot duplicate a side effect. POST and
# PATCH are absent on purpose — see ``request_json``.
IDEMPOTENT_METHODS = frozenset({"GET", "HEAD", "PUT", "DELETE", "OPTIONS", "TRACE"})


@dataclass(frozen=True, slots=True)
class HttpConfig:
    """How one vendor integration should behave on the wire."""

    system: str
    base_url: str
    timeout_seconds: float = 10.0
    connect_timeout_seconds: float = 3.0
    max_attempts: int = 3
    backoff_base_seconds: float = 0.2
    backoff_cap_seconds: float = 4.0
    verify_tls: bool = True
    headers: Mapping[str, str] = field(default_factory=dict)


class ResilientHttpClient:
    """An httpx client that speaks the platform's error taxonomy."""

    def __init__(
        self,
        config: HttpConfig,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Callable[[float], Awaitable[None]] | None = None,
    ) -> None:
        self._config = config
        self._sleep = sleep or asyncio.sleep
        self._client = httpx.AsyncClient(
            base_url=config.base_url,
            timeout=httpx.Timeout(
                config.timeout_seconds,
                connect=config.connect_timeout_seconds,
            ),
            headers=dict(config.headers),
            verify=config.verify_tls,
            transport=transport,
        )

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._client.aclose()

    def _backoff_seconds(self, attempt: int, retry_after: str | None) -> float:
        """Return how long to wait before the next attempt.

        Honours the server's Retry-After when it gives one; otherwise backs off
        exponentially with jitter, capped so a slow dependency cannot stall a
        request indefinitely.
        """
        if retry_after:
            # A vendor-supplied value, so it is input rather than instruction.
            # float() accepts "nan" and "-5"; nan survives min() (min keeps its
            # first argument, since cap < nan is False) and sleeping on nan waits
            # for a deadline that never arrives.
            try:
                seconds = float(retry_after)
            except ValueError:
                pass  # the RFC 9110 HTTP-date form; fall through to exponential
            else:
                if math.isfinite(seconds):
                    return min(max(seconds, 0.0), self._config.backoff_cap_seconds)
        exponential = self._config.backoff_base_seconds * (2**attempt)
        jitter = secrets.randbelow(int(MAX_JITTER_SECONDS * 1000)) / 1000
        return min(exponential + jitter, self._config.backoff_cap_seconds)

    @staticmethod
    def _may_retry(method: str, retry_unsafe: bool) -> bool:
        """Return True if replaying this request cannot duplicate a side effect."""
        return retry_unsafe or method.upper() in IDEMPOTENT_METHODS

    def _describe(self, method: str, path: str, status: int | None = None) -> str:
        """Describe a failed request without leaking its contents."""
        suffix = f" -> {status}" if status is not None else ""
        return f"{method} {self._config.base_url}{path}{suffix}"

    def _raise_for_status(self, response: httpx.Response, method: str, path: str) -> None:
        """Translate a non-2xx response into the shared taxonomy."""
        status = response.status_code
        if status < 400:
            return
        where = self._describe(method, path, status)
        if status in AUTH_STATUSES:
            raise IntegrationAuthError(self._config.system, f"credentials rejected: {where}")
        if status in RETRYABLE_STATUSES:
            raise IntegrationUnavailableError(self._config.system, f"unavailable: {where}")
        if status < 500:
            raise IntegrationRejectedError(self._config.system, f"request rejected: {where}")
        raise IntegrationUnavailableError(self._config.system, f"unavailable: {where}")

    def _decode(self, response: httpx.Response, method: str, path: str) -> object:
        """Decode a JSON body, treating an empty body as no content."""
        if response.status_code == httpx.codes.NO_CONTENT or not response.content:
            return None
        try:
            return response.json()
        except ValueError as exc:
            raise IntegrationProtocolError(
                self._config.system,
                f"unparseable response body: {self._describe(method, path, response.status_code)}",
            ) from exc

    async def request_json(
        self,
        method: str,
        path: str,
        *,
        json_body: object | None = None,
        params: Mapping[str, str] | None = None,
        content: bytes | None = None,
        headers: Mapping[str, str] | None = None,
        retry_unsafe: bool = False,
    ) -> object:
        """Perform a request, retrying transient failures, and decode the body.

        Only methods RFC 9110 defines as idempotent are retried. A transport
        error after the server accepted a request is indistinguishable from one
        it never received, so replaying a POST can perform the write twice —
        and the core's idempotency guards all sit *above* this call, where they
        cannot see it.

        ``retry_unsafe=True`` opts one call site back in, for a POST that is
        idempotent in fact even though the method is not: a bulk index keyed by
        document id, or a search expressed as a POST because the query is too
        big for a query string. It is a claim about that endpoint, so it is made
        per call rather than configured once for a whole vendor.
        """
        attempts = self._config.max_attempts if self._may_retry(method, retry_unsafe) else 1
        last_error: Exception | None = None

        for attempt in range(attempts):
            retry_after: str | None = None
            try:
                response = await self._client.request(
                    method,
                    path,
                    json=json_body,
                    params=dict(params) if params else None,
                    content=content,
                    headers=dict(headers) if headers else None,
                )
            except httpx.TransportError as exc:
                last_error = IntegrationUnavailableError(
                    self._config.system,
                    f"transport failure: {self._describe(method, path)}",
                )
                last_error.__cause__ = exc
            else:
                if response.status_code not in RETRYABLE_STATUSES:
                    self._raise_for_status(response, method, path)
                    return self._decode(response, method, path)
                retry_after = response.headers.get("Retry-After")
                last_error = IntegrationUnavailableError(
                    self._config.system,
                    f"unavailable: {self._describe(method, path, response.status_code)}",
                )

            if attempt + 1 < attempts:
                await self._sleep(self._backoff_seconds(attempt, retry_after))

        raise (
            last_error
            if last_error
            else IntegrationUnavailableError(
                self._config.system, f"no attempt succeeded: {self._describe(method, path)}"
            )
        )
