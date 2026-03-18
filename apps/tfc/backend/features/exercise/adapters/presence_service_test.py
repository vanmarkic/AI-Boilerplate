"""Tests for presence broadcast service.

Verifies that presence_service correctly cross-references connected
WebSocket participant IDs with waiting room participants.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from features.exercise.adapters.connection_manager import ConnectionManager
from features.waiting_room.waiting_room_store import WaitingRoomStore


def _make_ws(name: str = "ws") -> AsyncMock:
    ws = AsyncMock(name=name)
    ws.send_text = AsyncMock()
    return ws


class TestBuildPresenceList:
    """Tests for the _build_presence_list helper."""

    def test_empty_when_no_participants(self) -> None:
        from features.exercise.adapters.presence_service import _build_presence_list

        mgr = ConnectionManager()
        store = WaitingRoomStore()

        with (
            patch("features.exercise.adapters.presence_service.connection_manager", mgr),
            patch("features.exercise.adapters.presence_service.waiting_room_store", store),
        ):
            result = _build_presence_list(1)
            assert result == []

    def test_marks_connected_participants(self) -> None:
        from features.exercise.adapters.presence_service import _build_presence_list

        mgr = ConnectionManager()
        store = WaitingRoomStore()

        p1 = store.join(1, "Alice", "player")
        _p2 = store.join(1, "Bob", "player")

        ws1 = _make_ws("ws1")
        mgr.connect(1, ws1, "player", participant_id=p1.id)

        with (
            patch("features.exercise.adapters.presence_service.connection_manager", mgr),
            patch("features.exercise.adapters.presence_service.waiting_room_store", store),
        ):
            result = _build_presence_list(1)

        assert len(result) == 2
        alice = next(r for r in result if r["display_name"] == "Alice")
        bob = next(r for r in result if r["display_name"] == "Bob")
        assert alice["connected"] is True
        assert bob["connected"] is False

    def test_includes_role_and_id(self) -> None:
        from features.exercise.adapters.presence_service import _build_presence_list

        mgr = ConnectionManager()
        store = WaitingRoomStore()

        p = store.join(1, "Charlie", "observer")

        with (
            patch("features.exercise.adapters.presence_service.connection_manager", mgr),
            patch("features.exercise.adapters.presence_service.waiting_room_store", store),
        ):
            result = _build_presence_list(1)

        assert len(result) == 1
        assert result[0]["id"] == p.id
        assert result[0]["display_name"] == "Charlie"
        assert result[0]["role"] == "observer"
        assert result[0]["connected"] is False

    def test_gm_not_in_waiting_room_not_listed(self) -> None:
        """GM connects but is not in the waiting room store — not in the list."""
        from features.exercise.adapters.presence_service import _build_presence_list

        mgr = ConnectionManager()
        store = WaitingRoomStore()

        ws_gm = _make_ws("gm")
        mgr.connect(1, ws_gm, "gm")

        with (
            patch("features.exercise.adapters.presence_service.connection_manager", mgr),
            patch("features.exercise.adapters.presence_service.waiting_room_store", store),
        ):
            result = _build_presence_list(1)

        assert result == []


class TestBroadcastPresence:
    """Tests for the broadcast_presence function."""

    @pytest.mark.asyncio
    async def test_broadcasts_to_gm_role(self) -> None:
        from features.exercise.adapters.presence_service import broadcast_presence

        mgr = ConnectionManager()
        store = WaitingRoomStore()

        ws_gm = _make_ws("gm")
        ws_player = _make_ws("player")
        mgr.connect(1, ws_gm, "gm")
        mgr.connect(1, ws_player, "player", participant_id="p-1")

        store.join(1, "Alice", "player")

        with (
            patch("features.exercise.adapters.presence_service.connection_manager", mgr),
            patch("features.exercise.adapters.presence_service.waiting_room_store", store),
        ):
            await broadcast_presence(1)

        # GM should receive the message
        ws_gm.send_text.assert_awaited_once()
        msg = json.loads(ws_gm.send_text.call_args[0][0])
        assert msg["type"] == "presence_update"
        assert isinstance(msg["participants"], list)

        # Player should NOT receive presence updates
        ws_player.send_text.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_broadcasts_empty_list_when_no_participants(self) -> None:
        from features.exercise.adapters.presence_service import broadcast_presence

        mgr = ConnectionManager()
        store = WaitingRoomStore()

        ws_gm = _make_ws("gm")
        mgr.connect(1, ws_gm, "gm")

        with (
            patch("features.exercise.adapters.presence_service.connection_manager", mgr),
            patch("features.exercise.adapters.presence_service.waiting_room_store", store),
        ):
            await broadcast_presence(1)

        ws_gm.send_text.assert_awaited_once()
        msg = json.loads(ws_gm.send_text.call_args[0][0])
        assert msg["type"] == "presence_update"
        assert msg["participants"] == []

    @pytest.mark.asyncio
    async def test_no_error_when_no_connections(self) -> None:
        from features.exercise.adapters.presence_service import broadcast_presence

        mgr = ConnectionManager()
        store = WaitingRoomStore()

        with (
            patch("features.exercise.adapters.presence_service.connection_manager", mgr),
            patch("features.exercise.adapters.presence_service.waiting_room_store", store),
        ):
            # Should not raise
            await broadcast_presence(999)
