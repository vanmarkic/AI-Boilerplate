"""Listing cases and moving them through their lifecycle."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from application.transition_case_usecase import TransitionCaseUseCase
from core import registry
from core.dependencies import get_transition_case_usecase
from domain.case_entity import CaseStatus
from domain.soc_error import InvalidIndicatorError, UnknownEntityError
from features.cases.cases_schema import (
    CaseListResponse,
    CaseResponse,
    TransitionCaseRequest,
)

router = APIRouter(prefix="/api/cases", tags=["cases"])


@router.get(
    "",
    response_model=CaseListResponse,
    status_code=status.HTTP_200_OK,
    operation_id="listCases",
)
async def list_cases(
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> CaseListResponse:
    """Return a page of open cases."""
    cases = await registry.case_repository().list_open(limit=limit, offset=offset)
    return CaseListResponse(items=[CaseResponse.of(c) for c in cases])


@router.get(
    "/{case_id}",
    response_model=CaseResponse,
    status_code=status.HTTP_200_OK,
    operation_id="getCase",
)
async def get_case(case_id: UUID) -> CaseResponse:
    """Return one case."""
    case = await registry.case_repository().get(case_id)
    if case is None:
        raise UnknownEntityError(f"unknown case {case_id}")
    return CaseResponse.of(case)


@router.post(
    "/{case_id}/transition",
    response_model=CaseResponse,
    status_code=status.HTTP_200_OK,
    operation_id="transitionCase",
)
async def transition_case(
    case_id: UUID,
    request: TransitionCaseRequest,
    usecase: Annotated[TransitionCaseUseCase, Depends(get_transition_case_usecase)],
) -> CaseResponse:
    """Move a case to a new status, if the transition is legal."""
    try:
        target = CaseStatus(request.status)
    except ValueError as exc:
        raise InvalidIndicatorError(f"unknown case status '{request.status}'") from exc
    return CaseResponse.of(await usecase.execute(case_id, target))
