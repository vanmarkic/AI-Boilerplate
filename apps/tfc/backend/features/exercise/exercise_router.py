from fastapi import APIRouter, Depends, status

from core.dependencies import get_exercise_service
from features.exercise.exercise_schema import (
    CreateExerciseRequest,
    ExerciseResponse,
    UpdateExerciseRequest,
)
from features.exercise.exercise_service import ExerciseService

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ExerciseResponse,
    operation_id="createExercise",
)
async def create_exercise(
    request: CreateExerciseRequest,
    service: ExerciseService = Depends(get_exercise_service),
) -> ExerciseResponse:
    return await service.create_exercise(request)


@router.get(
    "",
    response_model=list[ExerciseResponse],
    operation_id="listExercises",
)
async def list_exercises(
    phase: str | None = None,
    service: ExerciseService = Depends(get_exercise_service),
) -> list[ExerciseResponse]:
    return await service.list_exercises(phase)


@router.get(
    "/by-code/{session_code}",
    response_model=ExerciseResponse,
    operation_id="getExerciseByCode",
)
async def get_exercise_by_code(
    session_code: str,
    service: ExerciseService = Depends(get_exercise_service),
) -> ExerciseResponse:
    return await service.get_exercise_by_code(session_code.upper())


@router.get(
    "/{exercise_id}",
    response_model=ExerciseResponse,
    operation_id="getExercise",
)
async def get_exercise(
    exercise_id: int,
    service: ExerciseService = Depends(get_exercise_service),
) -> ExerciseResponse:
    return await service.get_exercise(exercise_id)


@router.put(
    "/{exercise_id}",
    response_model=ExerciseResponse,
    operation_id="updateExercise",
)
async def update_exercise(
    exercise_id: int,
    request: UpdateExerciseRequest,
    service: ExerciseService = Depends(get_exercise_service),
) -> ExerciseResponse:
    return await service.update_exercise(exercise_id, request)


@router.delete(
    "/{exercise_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteExercise",
)
async def delete_exercise(
    exercise_id: int,
    service: ExerciseService = Depends(get_exercise_service),
) -> None:
    await service.delete_exercise(exercise_id)
