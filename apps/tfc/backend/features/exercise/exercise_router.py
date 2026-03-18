from fastapi import APIRouter, Depends, HTTPException, status

from core.dependencies import get_exercise_service, get_scenario_service
from features.exercise.exercise_schema import (
    CreateExerciseRequest,
    ExerciseResponse,
    UpdateExerciseRequest,
)
from features.exercise.exercise_service import ExerciseService
from features.scenario.scenario_content import ScenarioContent
from features.scenario.scenario_service import ScenarioService
from features.waiting_room.waiting_room_store import waiting_room_store

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
    "/joinable",
    operation_id="getJoinableExercise",
)
async def get_joinable_exercise(
    service: ExerciseService = Depends(get_exercise_service),
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> dict:
    """Return the first joinable exercise with available slots, or 404."""
    exercises = await service.list_exercises(phase="setup")
    for exercise in exercises:
        if exercise.scenario_id is None:
            continue
        try:
            scenario = await scenario_service.get_scenario(
                exercise.scenario_id,
            )
        except HTTPException:
            continue
        if scenario.content is None:
            continue
        content = ScenarioContent.model_validate(scenario.content)
        if not content.roles:
            continue

        requires_gm = content.game_mode == "classic"
        max_players = len(content.roles) + (1 if requires_gm else 0)
        current = waiting_room_store.count(exercise.id)
        if current >= max_players:
            continue

        participants = waiting_room_store.list_participants(exercise.id)
        return {
            "exercise": exercise.model_dump(),
            "participants": [p.to_dict() for p in participants],
            "roles": [r.model_dump() for r in content.roles],
            "max_players": max_players,
            "requires_gm": requires_gm,
        }

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="No joinable exercise found",
    )


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
