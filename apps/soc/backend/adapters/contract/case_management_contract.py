"""Behaviour every CaseManagementPort implementation must exhibit."""

from datetime import UTC, datetime

import pytest

from application.case_management_port import CaseManagementPort
from domain.case_entity import CaseDraft, CaseNote, CaseRef, CaseStatus
from domain.observable_entity import Observable, ObservableType
from domain.verdict_entity import Severity

NOW = datetime(2026, 8, 12, 12, 0, tzinfo=UTC)
IP = Observable(ObservableType.IPV4, "203.0.113.9")
MISSING = CaseRef(system="nowhere", external_id="does-not-exist")


def make_draft(correlation_key: str = "corr-1") -> CaseDraft:
    """Build a case draft."""
    return CaseDraft(
        title="Suspicious beaconing",
        summary="Host web01 beaconing to a known C2",
        severity=Severity.HIGH,
        correlation_key=correlation_key,
        observables=(IP,),
        tags=("c2",),
    )


class CaseManagementContract:
    """Subclass this and supply ``port``."""

    @pytest.fixture
    def port(self) -> CaseManagementPort:
        """The implementation under test."""
        raise NotImplementedError

    async def test_satisfies_the_port(self, port: CaseManagementPort) -> None:
        assert isinstance(port, CaseManagementPort)

    async def test_opening_a_case_returns_an_identifying_reference(
        self, port: CaseManagementPort
    ) -> None:
        ref = await port.open_case(make_draft())
        assert ref.system
        assert ref.external_id

    async def test_each_case_gets_a_distinct_reference(self, port: CaseManagementPort) -> None:
        first = await port.open_case(make_draft("corr-1"))
        second = await port.open_case(make_draft("corr-2"))
        assert first.external_id != second.external_id

    async def test_an_opened_case_is_findable_by_correlation_key(
        self, port: CaseManagementPort
    ) -> None:
        ref = await port.open_case(make_draft("corr-find"))
        assert await port.find_open_by_correlation("corr-find") == ref

    async def test_unknown_correlation_key_finds_nothing(self, port: CaseManagementPort) -> None:
        assert await port.find_open_by_correlation("never-used") is None

    async def test_an_opened_case_can_be_fetched(self, port: CaseManagementPort) -> None:
        ref = await port.open_case(make_draft())
        snapshot = await port.fetch_case(ref)
        assert snapshot is not None
        assert snapshot.ref == ref
        assert snapshot.status is CaseStatus.OPEN

    async def test_fetching_an_unknown_case_returns_none(self, port: CaseManagementPort) -> None:
        assert await port.fetch_case(MISSING) is None

    async def test_notes_can_be_added_to_an_open_case(self, port: CaseManagementPort) -> None:
        ref = await port.open_case(make_draft())
        await port.add_note(ref, CaseNote(title="Triage", body="Confirmed", author="alice"))

    async def test_observables_can_be_attached_to_an_open_case(
        self, port: CaseManagementPort
    ) -> None:
        ref = await port.open_case(make_draft())
        await port.attach_observables(ref, [IP])

    async def test_transition_is_reflected_in_the_snapshot(self, port: CaseManagementPort) -> None:
        ref = await port.open_case(make_draft())
        await port.transition(ref, CaseStatus.CONTAINED)
        snapshot = await port.fetch_case(ref)
        assert snapshot is not None
        assert snapshot.status is CaseStatus.CONTAINED

    async def test_a_closed_case_is_no_longer_found_as_open(self, port: CaseManagementPort) -> None:
        """Closing must free the correlation key so a recurrence opens a new case."""
        ref = await port.open_case(make_draft("corr-close"))
        await port.transition(ref, CaseStatus.CLOSED_RESOLVED)
        assert await port.find_open_by_correlation("corr-close") is None
