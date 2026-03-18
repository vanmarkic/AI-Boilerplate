"""In-memory waiting room store for pre-exercise participant tracking.

Each exercise has a list of participants who have joined the waiting room.
Participants can change roles before the exercise starts.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass
class WaitingRoomParticipant:
    """A participant waiting in the lobby before an exercise starts."""

    id: str
    display_name: str
    role: str
    joined_at: str

    @staticmethod
    def create(display_name: str, role: str) -> WaitingRoomParticipant:
        return WaitingRoomParticipant(
            id=str(uuid.uuid4()),
            display_name=display_name,
            role=role,
            joined_at=datetime.now(UTC).isoformat(),
        )

    def to_dict(self) -> dict[str, str]:
        return {
            "id": self.id,
            "display_name": self.display_name,
            "role": self.role,
            "joined_at": self.joined_at,
        }


class WaitingRoomStore:
    """Manages waiting room participants per exercise."""

    def __init__(self) -> None:
        self._rooms: dict[int, list[WaitingRoomParticipant]] = {}

    def join(
        self,
        exercise_id: int,
        display_name: str,
        role: str,
    ) -> WaitingRoomParticipant:
        """Add a participant to the waiting room."""
        if exercise_id not in self._rooms:
            self._rooms[exercise_id] = []
        participant = WaitingRoomParticipant.create(display_name, role)
        self._rooms[exercise_id].append(participant)
        return participant

    def leave(self, exercise_id: int, participant_id: str) -> bool:
        """Remove a participant. Returns True if found and removed."""
        participants = self._rooms.get(exercise_id)
        if participants is None:
            return False
        before = len(participants)
        self._rooms[exercise_id] = [p for p in participants if p.id != participant_id]
        if not self._rooms[exercise_id]:
            del self._rooms[exercise_id]
        return len(self._rooms.get(exercise_id, [])) < before

    def update_role(
        self,
        exercise_id: int,
        participant_id: str,
        new_role: str,
    ) -> WaitingRoomParticipant | None:
        """Change a participant's role. Returns updated participant or None."""
        for p in self._rooms.get(exercise_id, []):
            if p.id == participant_id:
                p.role = new_role
                return p
        return None

    def list_participants(
        self,
        exercise_id: int,
    ) -> list[WaitingRoomParticipant]:
        """List all participants in a waiting room."""
        return list(self._rooms.get(exercise_id, []))

    def get_participant(
        self,
        exercise_id: int,
        participant_id: str,
    ) -> WaitingRoomParticipant | None:
        """Get a single participant by ID."""
        for p in self._rooms.get(exercise_id, []):
            if p.id == participant_id:
                return p
        return None

    def count(self, exercise_id: int) -> int:
        """Return the number of participants in a waiting room."""
        return len(self._rooms.get(exercise_id, []))

    def is_role_taken(
        self,
        exercise_id: int,
        role: str,
        exclude_participant: str | None = None,
    ) -> bool:
        """Check whether a role is already held by another participant."""
        for p in self._rooms.get(exercise_id, []):
            if p.role == role and p.id != exclude_participant:
                return True
        return False

    def clear(self, exercise_id: int) -> None:
        """Remove all participants from a waiting room."""
        self._rooms.pop(exercise_id, None)


waiting_room_store = WaitingRoomStore()
