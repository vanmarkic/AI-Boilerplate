"""The Shuffle adapter satisfies the PlaybookOrchestrationPort contract.

Served by an in-memory fake Shuffle over httpx.MockTransport, including its
per-execution ``authorization`` token — a secret the adapter must carry on the
handle and must never log.
"""

import json
from datetime import UTC, datetime
from typing import Any

import httpx
import pytest

from adapters.contract.orchestration_contract import (
    PlaybookOrchestrationContract,
    make_decision,
)
from adapters.memory.fixed_clock_adapter import FixedClockAdapter
from adapters.resilient_client import HttpConfig, ResilientHttpClient
from adapters.shuffle.shuffle_client import ShuffleClient
from adapters.shuffle.shuffle_orchestration_adapter import ShuffleOrchestrationAdapter
from application.orchestration_port import PlaybookOrchestrationPort
from domain.playbook_entity import PlaybookHandle, PlaybookRunStatus
from domain.soc_error import IntegrationAuthError

API_KEY = "test-shuffle-key"
NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
WORKFLOW_ID = "isolate-host"


async def _no_sleep(seconds: float) -> None:
    return None


class FakeShuffle:
    """Just enough Shuffle to exercise the adapter's wire format."""

    def __init__(self, final_status: str = "FINISHED") -> None:
        self.executions: dict[str, dict[str, Any]] = {}
        self.final_status = final_status
        self._next = 1

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        body = json.loads(request.read().decode() or "{}")

        if path == "/api/v1/workflows" and request.method == "GET":
            return httpx.Response(
                200,
                json=[
                    {"id": WORKFLOW_ID, "name": "Isolate host", "description": "Quarantine"},
                    {"id": "block-ip", "name": "Block IP"},
                ],
            )

        if path.endswith("/execute") and request.method == "POST":
            workflow_id = path.split("/")[-2]
            execution_id = f"exec-{self._next}"
            self._next += 1
            self.executions[execution_id] = {
                "workflow_id": workflow_id,
                "authorization": f"auth-{execution_id}",
                "arguments": body,
            }
            return httpx.Response(
                200,
                json={
                    "success": True,
                    "execution_id": execution_id,
                    "authorization": f"auth-{execution_id}",
                },
            )

        if path == "/api/v1/streams/results" and request.method == "POST":
            execution_id = body.get("execution_id", "")
            run = self.executions.get(execution_id)
            if run is None:
                return httpx.Response(404, json={"success": False, "reason": "not found"})
            return httpx.Response(
                200,
                json={
                    "status": self.final_status,
                    "result": json.dumps({"contained": True}),
                    "execution_id": execution_id,
                },
            )

        return httpx.Response(404, json={"success": False})


def build(handler: object) -> ShuffleOrchestrationAdapter:
    """Build a Shuffle adapter over a canned transport."""
    http = ResilientHttpClient(
        HttpConfig(
            system="orchestration",
            base_url="https://shuffle.invalid",
            headers=ShuffleClient.auth_headers(API_KEY),
        ),
        transport=httpx.MockTransport(handler),  # type: ignore[arg-type]
        sleep=_no_sleep,
    )
    return ShuffleOrchestrationAdapter(ShuffleClient(http), FixedClockAdapter(NOW))


class TestShuffleOrchestration(PlaybookOrchestrationContract):
    """Runs the shared contract against the Shuffle implementation."""

    @pytest.fixture
    def port(self) -> PlaybookOrchestrationPort:
        return build(FakeShuffle().handler)

    @pytest.fixture
    def available_playbook_id(self) -> str:
        return WORKFLOW_ID


class TestShuffleWireFormat:
    """The vendor-specific details the contract cannot express."""

    async def test_api_key_is_sent_as_a_bearer_token(self) -> None:
        headers = ShuffleClient.auth_headers(API_KEY)
        assert headers["Authorization"] == f"Bearer {API_KEY}"

    async def test_launch_posts_to_the_workflow_execute_endpoint(self) -> None:
        seen: dict[str, str] = {}
        engine = FakeShuffle()

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/execute"):
                seen["path"] = request.url.path
                seen["body"] = request.read().decode()
            return engine.handler(request)

        await build(handler).launch(make_decision(WORKFLOW_ID))

        assert seen["path"] == f"/api/v1/workflows/{WORKFLOW_ID}/execute"
        assert "web01" in seen["body"]

    async def test_the_execution_authorization_is_carried_on_the_handle(self) -> None:
        """Shuffle requires this per-execution token to read results back."""
        handle = await build(FakeShuffle().handler).launch(make_decision(WORKFLOW_ID))
        assert handle.continuation is not None
        assert handle.continuation.startswith("auth-")

    async def test_reading_results_sends_the_execution_authorization(self) -> None:
        engine = FakeShuffle()
        seen: dict[str, Any] = {}

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path == "/api/v1/streams/results":
                seen["body"] = json.loads(request.read().decode())
            return engine.handler(request)

        adapter = build(handler)
        handle = await adapter.launch(make_decision(WORKFLOW_ID))
        await adapter.get_outcome(handle)

        assert seen["body"]["authorization"] == handle.continuation
        assert seen["body"]["execution_id"] == handle.external_id

    @pytest.mark.parametrize(
        ("shuffle_status", "expected"),
        [
            ("FINISHED", PlaybookRunStatus.SUCCEEDED),
            ("EXECUTING", PlaybookRunStatus.RUNNING),
            ("ABORTED", PlaybookRunStatus.FAILED),
            ("FAILURE", PlaybookRunStatus.FAILED),
            ("WAITING", PlaybookRunStatus.RUNNING),
        ],
    )
    async def test_execution_status_is_translated(
        self, shuffle_status: str, expected: PlaybookRunStatus
    ) -> None:
        engine = FakeShuffle(final_status=shuffle_status)
        adapter = build(engine.handler)
        handle = await adapter.launch(make_decision(WORKFLOW_ID))

        outcome = await adapter.get_outcome(handle)

        assert outcome is not None
        assert outcome.status is expected

    async def test_unknown_status_is_treated_as_running_not_success(self) -> None:
        """Guessing "succeeded" from an unrecognised status would hide failures."""
        engine = FakeShuffle(final_status="SOMETHING_NEW")
        adapter = build(engine.handler)
        handle = await adapter.launch(make_decision(WORKFLOW_ID))

        outcome = await adapter.get_outcome(handle)

        assert outcome is not None
        assert outcome.status is PlaybookRunStatus.RUNNING

    async def test_workflows_are_listed_with_names(self) -> None:
        available = await build(FakeShuffle().handler).list_available()
        by_id = {p.playbook_id: p.name for p in available}
        assert by_id[WORKFLOW_ID] == "Isolate host"

    async def test_rejected_credentials_surface_as_an_auth_error(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(401, json={"success": False})

        with pytest.raises(IntegrationAuthError):
            await build(handler).list_available()

    async def test_outcome_for_an_unknown_execution_is_none(self) -> None:
        adapter = build(FakeShuffle().handler)
        missing = PlaybookHandle(system="shuffle", external_id="nope", continuation="x")
        assert await adapter.get_outcome(missing) is None

    async def test_shuffle_completion_time_is_preferred_when_reported(self) -> None:
        """When Shuffle says when it finished, that beats our observation time."""
        completed = datetime(2026, 8, 12, 9, 30, tzinfo=UTC)

        def handler(request: httpx.Request) -> httpx.Response:
            if request.url.path.endswith("/execute"):
                return httpx.Response(
                    200,
                    json={"success": True, "execution_id": "e1", "authorization": "a1"},
                )
            return httpx.Response(
                200,
                json={
                    "status": "FINISHED",
                    "result": "{}",
                    "completed_at": int(completed.timestamp()),
                },
            )

        adapter = build(handler)
        handle = await adapter.launch(make_decision(WORKFLOW_ID))
        outcome = await adapter.get_outcome(handle)

        assert outcome is not None
        assert outcome.finished_at == completed

    async def test_a_finished_run_without_a_reported_time_uses_observation_time(self) -> None:
        adapter = build(FakeShuffle().handler)
        handle = await adapter.launch(make_decision(WORKFLOW_ID))

        outcome = await adapter.get_outcome(handle)

        assert outcome is not None
        assert outcome.finished_at == NOW

    async def test_a_running_execution_has_no_finish_time(self) -> None:
        adapter = build(FakeShuffle(final_status="EXECUTING").handler)
        handle = await adapter.launch(make_decision(WORKFLOW_ID))

        outcome = await adapter.get_outcome(handle)

        assert outcome is not None
        assert outcome.finished_at is None
