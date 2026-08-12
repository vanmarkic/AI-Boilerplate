"""Transport for a DFIR-IRIS instance.

Owns one trap in particular: IRIS answers HTTP 200 with a
``{"status": "success" | "error"}`` envelope, so a failed operation looks like
a successful request. Unwrapping that here means no caller can mistake an
error for a case that was opened.
"""

from collections.abc import Mapping
from typing import Any

from adapters.resilient_client import ResilientHttpClient
from domain.soc_error import IntegrationProtocolError, IntegrationRejectedError

API_BASE = "/api/v2"
SYSTEM = "case_management"


class IrisClient:
    """Issues DFIR-IRIS REST calls and unwraps its response envelope."""

    def __init__(self, http: ResilientHttpClient, *, api_base: str = API_BASE) -> None:
        self._http = http
        self._api_base = api_base.rstrip("/")

    @staticmethod
    def auth_headers(api_key: str) -> dict[str, str]:
        """Return the headers a DFIR-IRIS instance expects."""
        return {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._http.aclose()

    def _unwrap(self, payload: object, where: str) -> object:
        """Return the envelope's data, raising when it reports an error.

        A bare object is returned as-is: not every IRIS deployment wraps.
        """
        if not isinstance(payload, Mapping):
            return payload
        status = payload.get("status")
        if status is None:
            return payload
        if str(status).lower() != "success":
            message = payload.get("message") or "operation reported failure"
            raise IntegrationProtocolError(SYSTEM, f"{where}: {message}")
        return payload.get("data", {})

    async def request(
        self,
        method: str,
        path: str,
        *,
        json_body: Mapping[str, Any] | None = None,
    ) -> object:
        """Issue a call under the API base and unwrap the envelope."""
        payload = await self._http.request_json(
            method,
            f"{self._api_base}{path}",
            json_body=dict(json_body) if json_body is not None else None,
        )
        return self._unwrap(payload, f"{method} {path}")

    async def try_request(
        self,
        method: str,
        path: str,
        *,
        json_body: Mapping[str, Any] | None = None,
    ) -> object | None:
        """Like ``request`` but treats "not found" as an answer, returning None."""
        try:
            return await self.request(method, path, json_body=json_body)
        except IntegrationRejectedError:
            return None
