"""Transport for a Shuffle instance."""

from collections.abc import Mapping
from typing import Any

from adapters.resilient_client import ResilientHttpClient
from domain.soc_error import IntegrationRejectedError

WORKFLOWS_PATH = "/api/v1/workflows"
RESULTS_PATH = "/api/v1/streams/results"


class ShuffleClient:
    """Issues Shuffle REST calls and returns raw response bodies."""

    def __init__(self, http: ResilientHttpClient) -> None:
        self._http = http

    @staticmethod
    def auth_headers(api_key: str) -> dict[str, str]:
        """Return the headers a Shuffle instance expects."""
        return {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._http.aclose()

    async def list_workflows(self) -> list[dict[str, Any]]:
        """Return every workflow the instance exposes."""
        payload = await self._http.request_json("GET", WORKFLOWS_PATH)
        if not isinstance(payload, list):
            return []
        return [w for w in payload if isinstance(w, dict)]

    async def execute_workflow(
        self,
        workflow_id: str,
        arguments: Mapping[str, str],
    ) -> Mapping[str, Any]:
        """Start a workflow execution.

        Never retried, and this is the call the rule exists for. A read timeout
        after Shuffle accepted the request looks exactly like one it never
        received — and replaying it launches containment twice, below the
        idempotency guard in ``RespondToAlertUseCase``, which sits above this
        call and cannot see a second attempt.
        """
        payload = await self._http.request_json(
            "POST",
            f"{WORKFLOWS_PATH}/{workflow_id}/execute",
            json_body=dict(arguments),
        )
        return payload if isinstance(payload, Mapping) else {}

    async def execution_result(
        self,
        execution_id: str,
        authorization: str | None,
    ) -> Mapping[str, Any] | None:
        """Return an execution's current result, or None if it is unknown.

        The per-execution ``authorization`` token is required alongside the id;
        it is a secret and is never logged.
        """
        body = {"execution_id": execution_id, "authorization": authorization or ""}
        try:
            # Reading an execution's state changes nothing, so a replay is safe.
            payload = await self._http.request_json(
                "POST", RESULTS_PATH, json_body=body, retry_unsafe=True
            )
        except IntegrationRejectedError:
            return None
        return payload if isinstance(payload, Mapping) else None
