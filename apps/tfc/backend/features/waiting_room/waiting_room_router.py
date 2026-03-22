"""REST endpoints for waiting room participant management.

Allows participants to join, leave, and change roles before an exercise
starts. Mutations broadcast updates via the existing WebSocket connection
manager so all connected clients see changes in real time.

When the exercise is linked to a scenario with roles, the router enforces:
- unique role assignment (no two participants hold the same role)
- max player capacity (derived from the number of defined roles)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from core.dependencies import get_exercise_service, get_scenario_service
from features.exercise.adapters.connection_manager import connection_manager
from features.exercise.exercise_service import ExerciseService
from features.scenario.scenario_content import ScenarioContent
from features.scenario.scenario_service import ScenarioService
from features.waiting_room.waiting_room_schema import (
    JoinRequest,
    ParticipantResponse,
    UpdateRoleRequest,
    WaitingRoomResponse,
)
from features.waiting_room.waiting_room_store import waiting_room_store

router = APIRouter(
    prefix="/api/exercises/{exercise_id}/waiting-room",
    tags=["waiting-room"],
)


def _participants_payload(exercise_id: int) -> dict:
    """Build the broadcast payload for waiting room updates."""
    participants = waiting_room_store.list_participants(exercise_id)
    return {
        "type": "waiting_room_update",
        "exercise_id": exercise_id,
        "participants": [p.to_dict() for p in participants],
    }


async def _get_exercise_and_scenario_roles(
    exercise_id: int,
    exercise_service: ExerciseService,
    scenario_service: ScenarioService,
) -> tuple[object, list[dict] | None]:
    """Return (exercise, scenario_roles) for the exercise.

    The exercise object is always returned so callers can inspect it
    without issuing a second DB query. Roles are ``None`` when the
    exercise has no linked scenario or the scenario defines no roles.
    """
    exercise = await exercise_service.get_exercise(exercise_id)
    if exercise.scenario_id is None:
        return exercise, None
    scenario = await scenario_service.get_scenario(exercise.scenario_id)
    if scenario.content is None:
        return exercise, None
    content = ScenarioContent.model_validate(scenario.content)
    if not content.roles:
        return exercise, None
    return exercise, [r.model_dump() for r in content.roles]


@router.post("/join", response_model=ParticipantResponse)
async def join_waiting_room(
    exercise_id: int,
    body: JoinRequest,
    exercise_service: ExerciseService = Depends(get_exercise_service),
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> ParticipantResponse:
    """Join the waiting room for an exercise."""
    exercise_obj, roles = await _get_exercise_and_scenario_roles(
        exercise_id,
        exercise_service,
        scenario_service,
    )
    if roles is not None:
        if exercise_obj.practice_mode:
            max_players = 1
        else:
            max_players = len(roles)
        if waiting_room_store.count(exercise_id) >= max_players:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Waiting room is full",
            )
        if (
            not exercise_obj.practice_mode
            and body.role != "player"
            and waiting_room_store.is_role_taken(exercise_id, body.role)
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role '{body.role}' is already taken",
            )

    participant = waiting_room_store.join(
        exercise_id,
        body.display_name,
        body.role,
    )
    await connection_manager.broadcast(
        exercise_id,
        _participants_payload(exercise_id),
    )
    return ParticipantResponse(**participant.to_dict())


@router.get("", response_model=WaitingRoomResponse)
async def list_waiting_room(exercise_id: int) -> WaitingRoomResponse:
    """List all participants in the waiting room."""
    participants = waiting_room_store.list_participants(exercise_id)
    return WaitingRoomResponse(
        exercise_id=exercise_id,
        participants=[ParticipantResponse(**p.to_dict()) for p in participants],
    )


@router.put(
    "/participants/{participant_id}/role",
    response_model=ParticipantResponse,
)
async def update_participant_role(
    exercise_id: int,
    participant_id: str,
    body: UpdateRoleRequest,
    exercise_service: ExerciseService = Depends(get_exercise_service),
    scenario_service: ScenarioService = Depends(get_scenario_service),
) -> ParticipantResponse:
    """Change a participant's role in the waiting room."""
    _, roles = await _get_exercise_and_scenario_roles(
        exercise_id,
        exercise_service,
        scenario_service,
    )
    if roles is not None:
        if waiting_room_store.is_role_taken(
            exercise_id,
            body.role,
            exclude_participant=participant_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Role '{body.role}' is already taken",
            )

    participant = waiting_room_store.update_role(
        exercise_id,
        participant_id,
        body.role,
    )
    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Participant {participant_id} not found",
        )
    await connection_manager.broadcast(
        exercise_id,
        _participants_payload(exercise_id),
    )
    return ParticipantResponse(**participant.to_dict())


@router.delete("/participants/{participant_id}", status_code=204)
async def leave_waiting_room(
    exercise_id: int,
    participant_id: str,
) -> None:
    """Remove a participant from the waiting room."""
    removed = waiting_room_store.leave(exercise_id, participant_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Participant {participant_id} not found",
        )
    await connection_manager.broadcast(
        exercise_id,
        _participants_payload(exercise_id),
    )
