"""Pydantic request/response schemas for the waiting room feature."""

from __future__ import annotations

from pydantic import BaseModel, Field


class JoinRequest(BaseModel):
    """Request to join a waiting room."""

    display_name: str = Field(..., min_length=1, max_length=50)
    role: str = Field(default="player", min_length=1, max_length=50)


class UpdateRoleRequest(BaseModel):
    """Request to change a participant's role."""

    role: str = Field(..., min_length=1, max_length=50)


class ParticipantResponse(BaseModel):
    """A single participant in the waiting room."""

    id: str
    display_name: str
    role: str
    joined_at: str


class WaitingRoomResponse(BaseModel):
    """Full waiting room state for an exercise."""

    exercise_id: int
    participants: list[ParticipantResponse]
