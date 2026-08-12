"""DFIR-IRIS as a CaseManagementPort."""

from collections.abc import Mapping, Sequence
from typing import Any

from adapters.iris.iris_client import IrisClient
from adapters.iris.iris_mapper import (
    SEVERITY_IDS,
    TLP_IDS,
    case_id_of,
    ioc_type_id_for,
    status_from_id,
    status_id_for,
)
from domain.case_entity import (
    TERMINAL_STATUSES,
    CaseDraft,
    CaseNote,
    CaseRef,
    CaseStatus,
    ExternalCaseSnapshot,
)
from domain.indicator_entity import TlpLevel
from domain.observable_entity import Observable
from domain.soc_error import IntegrationProtocolError

SYSTEM_NAME = "iris"


class IrisCaseAdapter:
    """Mirrors investigations into a DFIR-IRIS instance."""

    def __init__(
        self,
        client: IrisClient,
        *,
        customer_id: int = 1,
        base_url: str = "",
        status_overrides: Mapping[str, int] | None = None,
        ioc_type_overrides: Mapping[str, int] | None = None,
    ) -> None:
        self._client = client
        self._customer_id = customer_id
        self._base_url = base_url.rstrip("/")
        self._status_overrides = status_overrides
        self._ioc_type_overrides = ioc_type_overrides

    async def aclose(self) -> None:
        """Release the underlying connection pool."""
        await self._client.aclose()

    def _ref_for(self, case_id: str) -> CaseRef:
        """Build a domain handle for an IRIS case."""
        return CaseRef(
            system=SYSTEM_NAME,
            external_id=case_id,
            url=f"{self._base_url}/case?cid={case_id}" if self._base_url else f"case/{case_id}",
        )

    async def open_case(self, draft: CaseDraft) -> CaseRef:
        """Open a case in IRIS and return a handle to it."""
        data = await self._client.request(
            "POST",
            "/cases",
            json_body={
                "case_name": draft.title,
                "case_description": draft.summary,
                "case_customer": self._customer_id,
                "case_soc_id": draft.correlation_key,
                "case_severity_id": SEVERITY_IDS.get(draft.severity, 3),
                "case_tags": ",".join(draft.tags),
            },
        )
        case_id = case_id_of(data)
        if case_id is None:
            raise IntegrationProtocolError(
                "case_management", "case created but no identifier was returned"
            )
        return self._ref_for(case_id)

    async def find_open_by_correlation(self, correlation_key: str) -> CaseRef | None:
        """Return the open IRIS case carrying this SOC id, if any."""
        data = await self._client.request("GET", "/cases")
        rows: Sequence[Any] = data if isinstance(data, list) else []
        for row in rows:
            if not isinstance(row, Mapping):
                continue
            if str(row.get("case_soc_id", "")) != correlation_key:
                continue
            status = status_from_id(row.get("status_id"), self._status_overrides)
            if status in TERMINAL_STATUSES:
                continue
            case_id = case_id_of(row)
            if case_id is not None:
                return self._ref_for(case_id)
        return None

    async def add_note(self, ref: CaseRef, note: CaseNote) -> None:
        """Append a note to an IRIS case."""
        await self._client.request(
            "POST",
            f"/cases/{ref.external_id}/notes",
            json_body={
                "note_title": note.title,
                "note_content": f"{note.body}\n\n— {note.author}",
            },
        )

    async def attach_observables(self, ref: CaseRef, observables: Sequence[Observable]) -> None:
        """Attach observables to an IRIS case as IOCs."""
        for observable in observables:
            await self._client.request(
                "POST",
                f"/cases/{ref.external_id}/iocs",
                json_body={
                    "ioc_value": observable.value,
                    "ioc_type_id": ioc_type_id_for(observable.type, self._ioc_type_overrides),
                    "ioc_tlp_id": TLP_IDS[TlpLevel.AMBER],
                    "ioc_description": f"Observed during triage ({observable.type.value})",
                },
            )

    async def transition(self, ref: CaseRef, status: CaseStatus) -> None:
        """Move an IRIS case to a new status."""
        await self._client.request(
            "PATCH",
            f"/cases/{ref.external_id}",
            json_body={"status_id": status_id_for(status, self._status_overrides)},
        )

    async def fetch_case(self, ref: CaseRef) -> ExternalCaseSnapshot | None:
        """Return what IRIS currently believes about a case, or None."""
        data = await self._client.try_request("GET", f"/cases/{ref.external_id}")
        if not isinstance(data, Mapping):
            return None
        return ExternalCaseSnapshot(
            ref=ref,
            status=status_from_id(data.get("status_id"), self._status_overrides),
            owner=data.get("owner"),
        )
