"""Which vendor calls may be replayed, and which may not.

``ResilientHttpClient`` retries idempotent methods and declines the rest, but
the interesting decisions are the exceptions: the POSTs that are reads in
disguise and opt back in, and the POSTs that perform an action and must not.

Those choices live one per call site, spread across four clients, and each is a
claim about somebody else's API. This file is where they are all visible at
once, so adding a vendor call means adding a line here rather than inheriting a
default nobody looked at.
"""

from datetime import UTC, datetime

import httpx
import pytest

from adapters.iris.iris_client import IrisClient
from adapters.misp.misp_client import MispClient
from adapters.opensearch.opensearch_client import OpenSearchClient
from adapters.resilient_client import HttpConfig, ResilientHttpClient
from adapters.shuffle.shuffle_client import ShuffleClient
from domain.soc_error import IntegrationError

MAX_ATTEMPTS = 3
WHEN = datetime(2026, 1, 1, tzinfo=UTC)


async def _no_sleep(seconds: float) -> None:
    return None


class Counter:
    """A transport that always fails, recording how many attempts it saw."""

    def __init__(self) -> None:
        self.attempts = 0

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.attempts += 1
        raise httpx.ConnectError("boom")


def _transport(counter: Counter) -> ResilientHttpClient:
    return ResilientHttpClient(
        HttpConfig(system="vendor", base_url="https://vendor.invalid", max_attempts=MAX_ATTEMPTS),
        transport=httpx.MockTransport(counter),  # type: ignore[arg-type]
        sleep=_no_sleep,
    )


async def _launch(http: ResilientHttpClient) -> None:
    await ShuffleClient(http).execute_workflow("wf-1", {"alert": "a"})


async def _sighting(http: ResilientHttpClient) -> None:
    await MispClient(http).add_sighting("203.0.113.9", WHEN)


async def _open_case(http: ResilientHttpClient) -> None:
    await IrisClient(http).request("POST", "/cases", json_body={"case_name": "c"})


async def _bulk_index(http: ResilientHttpClient) -> None:
    await OpenSearchClient(http).bulk_index("soc-events", [("id-1", {"a": 1})])


async def _search(http: ResilientHttpClient) -> None:
    await OpenSearchClient(http).search("soc-events", {"query": {"match_all": {}}})


async def _count(http: ResilientHttpClient) -> None:
    await OpenSearchClient(http).count("soc-events", {"query": {"match_all": {}}})


async def _intel_lookup(http: ResilientHttpClient) -> None:
    await MispClient(http).search_values(["203.0.113.9"])


async def _list_playbooks(http: ResilientHttpClient) -> None:
    await ShuffleClient(http).list_workflows()


async def _read_outcome(http: ResilientHttpClient) -> None:
    await ShuffleClient(http).execution_result("exec-1", "token")


# Each entry is a claim about the vendor's endpoint, not about our code.
PERFORMS_AN_ACTION = [
    pytest.param(_launch, id="shuffle: launch a playbook"),
    pytest.param(_sighting, id="misp: add a sighting"),
    pytest.param(_open_case, id="iris: open a case"),
]

READS_ONLY = [
    pytest.param(_search, id="opensearch: search"),
    pytest.param(_count, id="opensearch: count"),
    pytest.param(_intel_lookup, id="misp: restSearch"),
    pytest.param(_list_playbooks, id="shuffle: list workflows"),
    pytest.param(_read_outcome, id="shuffle: read an execution result"),
    pytest.param(_bulk_index, id="opensearch: bulk index (keyed by _id)"),
]


class TestActionsAreNotReplayed:
    """A retry here would perform the action a second time."""

    @pytest.mark.parametrize("call", PERFORMS_AN_ACTION)
    async def test_exactly_one_attempt(self, call: object) -> None:
        counter = Counter()
        with pytest.raises(IntegrationError):
            await call(_transport(counter))  # type: ignore[operator]
        assert counter.attempts == 1


class TestReadsAreReplayed:
    """Declining to retry these would cost resilience and buy nothing.

    Bulk indexing is in this list rather than the one above because every action
    it sends carries an explicit ``_id``: a replay overwrites the same documents
    instead of adding more.
    """

    @pytest.mark.parametrize("call", READS_ONLY)
    async def test_retried_to_the_attempt_limit(self, call: object) -> None:
        counter = Counter()
        with pytest.raises(IntegrationError):
            await call(_transport(counter))  # type: ignore[operator]
        assert counter.attempts == MAX_ATTEMPTS
