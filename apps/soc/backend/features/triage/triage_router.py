"""Event ingestion and triage."""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from application.ingest_dto import IngestEventCommand
from application.ingest_event_usecase import IngestEventUseCase
from core.dependencies import get_ingest_event_usecase
from features.triage.triage_schema import (
    AlertResponse,
    IngestEventRequest,
    TriageResponse,
    VerdictResponse,
)

router = APIRouter(prefix="/api/triage", tags=["triage"])


@router.post(
    "/events",
    response_model=TriageResponse,
    status_code=status.HTTP_201_CREATED,
    operation_id="ingestEvent",
)
async def ingest_event(
    request: IngestEventRequest,
    usecase: Annotated[IngestEventUseCase, Depends(get_ingest_event_usecase)],
) -> TriageResponse:
    """Normalize, enrich, score and dispose of one raw event."""
    outcome = await usecase.execute(
        IngestEventCommand(
            source=request.source,
            payload=request.payload,
            external_id=request.external_id,
        )
    )
    return TriageResponse(
        verdict=VerdictResponse.of(outcome.verdict),
        alert=AlertResponse.of(outcome.alert) if outcome.alert else None,
        deduplicated=outcome.deduplicated,
        enrichment_degraded=outcome.enrichment_degraded,
    )
