"""Transport for a MISP instance.

Vendor vocabulary lives here and stops here: this module speaks attributes,
restSearch and sightings. Translating any of that into domain terms is the
adapter's job, not this one's.
"""

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from adapters.resilient_client import ResilientHttpClient

REST_SEARCH_PATH = "/attributes/restSearch"
SIGHTINGS_PATH = "/sightings/add"
DEFAULT_PAGE_SIZE = 100
MAX_PAGES = 50


class MispClient:
    """Issues MISP REST calls and returns raw attribute dicts."""

    def __init__(self, http: ResilientHttpClient) -> None:
        self._http = http

    @staticmethod
    def auth_headers(api_key: str) -> dict[str, str]:
        """Return the headers a MISP instance expects.

        The key is sent bare. MISP does *not* use a ``Bearer`` scheme, and
        adding one produces an opaque 403 — a classic mis-integration.
        """
        return {
            "Authorization": api_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._http.aclose()

    @staticmethod
    def _attributes_of(payload: object) -> list[dict[str, Any]]:
        """Pull the attribute list out of MISP's response envelope."""
        if not isinstance(payload, Mapping):
            return []
        response = payload.get("response")
        if not isinstance(response, Mapping):
            return []
        attributes = response.get("Attribute")
        if not isinstance(attributes, list):
            return []
        return [a for a in attributes if isinstance(a, dict)]

    async def _search(self, criteria: dict[str, Any], limit: int) -> list[dict[str, Any]]:
        """Page through restSearch until a short page or the page cap."""
        collected: list[dict[str, Any]] = []
        page_size = min(limit, DEFAULT_PAGE_SIZE)
        for page in range(1, MAX_PAGES + 1):
            body = {
                "returnFormat": "json",
                "limit": page_size,
                "page": page,
                "includeEventTags": True,
                "enforceWarninglist": True,
                **criteria,
            }
            payload = await self._http.request_json("POST", REST_SEARCH_PATH, json_body=body)
            attributes = self._attributes_of(payload)
            collected.extend(attributes)
            if len(attributes) < page_size or len(collected) >= limit:
                break
        return collected[:limit]

    async def search_values(
        self,
        values: Sequence[str],
        *,
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> list[dict[str, Any]]:
        """Return attributes matching any of these values."""
        if not values:
            return []
        return await self._search({"value": list(values)}, limit)

    async def search_since(self, since: datetime, *, limit: int) -> list[dict[str, Any]]:
        """Return attributes updated at or after an instant."""
        return await self._search({"timestamp": str(int(since.timestamp()))}, limit)

    async def add_sighting(self, value: str, observed_at: datetime) -> None:
        """Report that we saw a value in our own telemetry."""
        await self._http.request_json(
            "POST",
            SIGHTINGS_PATH,
            json_body={"value": value, "timestamp": int(observed_at.timestamp())},
        )
