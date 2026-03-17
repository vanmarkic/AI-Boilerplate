"""REST endpoints for waiting room participant management.

Allows participants to join, leave, and change roles before an exercise
starts. Mutations broadcast updates via the existing WebSocket connection
manager so all connected clients see changes in real time.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from features.exercise.adapters.connection_manager import connection_manager
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


@router.post("/join", response_model=ParticipantResponse)
async def join_waiting_room(
    exercise_id: int, body: JoinRequest,
) -> ParticipantResponse:
    """Join the waiting room for an exercise."""
    participant = waiting_room_store.join(
        exercise_id, body.display_name, body.role,
    )
    await connection_manager.broadcast(
        exercise_id, _participants_payload(exercise_id),
    )
    return ParticipantResponse(**participant.to_dict())


@router.get("", response_model=WaitingRoomResponse)
async def list_waiting_room(exercise_id: int) -> WaitingRoomResponse:
    """List all participants in the waiting room."""
    participants = waiting_room_store.list_participants(exercise_id)
    return WaitingRoomResponse(
        exercise_id=exercise_id,
        participants=[
            ParticipantResponse(**p.to_dict()) for p in participants
        ],
    )


@router.put(
    "/participants/{participant_id}/role",
    response_model=ParticipantResponse,
)
async def update_participant_role(
    exercise_id: int,
    participant_id: str,
    body: UpdateRoleRequest,
) -> ParticipantResponse:
    """Change a participant's role in the waiting room."""
    participant = waiting_room_store.update_role(
        exercise_id, participant_id, body.role,
    )
    if participant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Participant {participant_id} not found",
        )
    await connection_manager.broadcast(
        exercise_id, _participants_payload(exercise_id),
    )
    return ParticipantResponse(**participant.to_dict())


@router.delete("/participants/{participant_id}", status_code=204)
async def leave_waiting_room(
    exercise_id: int, participant_id: str,
) -> None:
    """Remove a participant from the waiting room."""
    removed = waiting_room_store.leave(exercise_id, participant_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Participant {participant_id} not found",
        )
    await connection_manager.broadcast(
        exercise_id, _participants_payload(exercise_id),
    )
