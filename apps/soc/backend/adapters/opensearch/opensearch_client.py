"""Transport for an OpenSearch cluster.

Speaks _bulk, _search and _count; knows nothing about what the documents mean.
"""

import json
from collections.abc import Mapping, Sequence
from typing import Any

from adapters.resilient_client import ResilientHttpClient

BULK_PATH = "/_bulk"
NDJSON_CONTENT_TYPE = "application/x-ndjson"


class OpenSearchClient:
    """Issues OpenSearch REST calls and returns raw response bodies."""

    def __init__(self, http: ResilientHttpClient) -> None:
        self._http = http

    @staticmethod
    def basic_auth_headers(username: str, password: str) -> dict[str, str]:
        """Return a Basic auth header, or nothing when the cluster is open."""
        if not username:
            return {}
        import base64

        token = base64.b64encode(f"{username}:{password}".encode()).decode()
        return {"Authorization": f"Basic {token}"}

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._http.aclose()

    async def bulk_index(
        self,
        index: str,
        documents: Sequence[tuple[str, Mapping[str, Any]]],
    ) -> Mapping[str, Any]:
        """Index (doc_id, source) pairs via the bulk API.

        The body is newline-delimited JSON and *must* end with a newline —
        OpenSearch rejects the request outright otherwise.
        """
        lines: list[str] = []
        for doc_id, source in documents:
            lines.append(json.dumps({"index": {"_index": index, "_id": doc_id}}))
            lines.append(json.dumps(source, default=str))
        body = "\n".join(lines) + "\n"

        payload = await self._http.request_json(
            "POST",
            BULK_PATH,
            content=body.encode(),
            headers={"Content-Type": NDJSON_CONTENT_TYPE},
            # Every action above carries an explicit "_id", so a replay
            # overwrites the same documents rather than adding duplicates.
            retry_unsafe=True,
        )
        return payload if isinstance(payload, Mapping) else {}

    async def search(self, index: str, body: Mapping[str, Any]) -> Mapping[str, Any]:
        """Run a search against one index."""
        # A POST only because the query is too large for a query string; this
        # reads and writes nothing.
        payload = await self._http.request_json(
            "POST", f"/{index}/_search", json_body=body, retry_unsafe=True
        )
        return payload if isinstance(payload, Mapping) else {}

    async def count(self, index: str, body: Mapping[str, Any]) -> int:
        """Count documents matching a query."""
        payload = await self._http.request_json(
            "POST", f"/{index}/_count", json_body=body, retry_unsafe=True
        )
        if isinstance(payload, Mapping):
            raw = payload.get("count", 0)
            if isinstance(raw, int):
                return raw
        return 0
