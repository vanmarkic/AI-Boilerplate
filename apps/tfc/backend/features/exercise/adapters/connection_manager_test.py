"""Tests for WebSocket connection manager.

Tests written first (TDD) — these should fail until implementation exists.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from features.exercise.adapters.connection_manager import ConnectionManager, connection_manager


# ── Unit tests ───────────────────────────────────────────────────────────


def _make_ws(name: str = "ws") -> AsyncMock:
    """Create a mock WebSocket with send_text."""
    ws = AsyncMock(name=name)
    ws.send_text = AsyncMock()
    return ws


class TestConnectionManager:
    """Tests for the ConnectionManager class."""

    def test_connect_registers_client(self) -> None:
        mgr = ConnectionManager()
        ws = _make_ws()
        mgr.connect(exercise_id=1, websocket=ws, role="gm")

        conns = mgr.get_connections(1)
        assert len(conns) == 1
        assert conns[0] == (ws, "gm")

    def test_connect_multiple_clients(self) -> None:
        mgr = ConnectionManager()
        ws1 = _make_ws("ws1")
        ws2 = _make_ws("ws2")
        mgr.connect(1, ws1, "gm")
        mgr.connect(1, ws2, "player")

        conns = mgr.get_connections(1)
        assert len(conns) == 2

    def test_disconnect_removes_client(self) -> None:
        mgr = ConnectionManager()
        ws = _make_ws()
        mgr.connect(1, ws, "gm")
        mgr.disconnect(1, ws)

        conns = mgr.get_connections(1)
        assert len(conns) == 0

    def test_disconnect_unknown_client_is_noop(self) -> None:
        mgr = ConnectionManager()
        ws = _make_ws()
        # Should not raise
        mgr.disconnect(1, ws)

    def test_disconnect_unknown_exercise_is_noop(self) -> None:
        mgr = ConnectionManager()
        ws = _make_ws()
        mgr.disconnect(999, ws)

    def test_get_connections_empty_exercise(self) -> None:
        mgr = ConnectionManager()
        assert mgr.get_connections(42) == []

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_all(self) -> None:
        mgr = ConnectionManager()
        ws1 = _make_ws("ws1")
        ws2 = _make_ws("ws2")
        mgr.connect(1, ws1, "gm")
        mgr.connect(1, ws2, "player")

        message = {"type": "state_changes", "changes": [{"a": 1}]}
        await mgr.broadcast(1, message)

        expected = json.dumps(message)
        ws1.send_text.assert_awaited_once_with(expected)
        ws2.send_text.assert_awaited_once_with(expected)

    @pytest.mark.asyncio
    async def test_broadcast_to_role_gm_only(self) -> None:
        mgr = ConnectionManager()
        ws_gm = _make_ws("gm")
        ws_player = _make_ws("player")
        mgr.connect(1, ws_gm, "gm")
        mgr.connect(1, ws_player, "player")

        message = {"type": "state_changes", "changes": []}
        await mgr.broadcast_to_role(1, "gm", message)

        expected = json.dumps(message)
        ws_gm.send_text.assert_awaited_once_with(expected)
        ws_player.send_text.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_broadcast_to_role_player_only(self) -> None:
        mgr = ConnectionManager()
        ws_gm = _make_ws("gm")
        ws_player = _make_ws("player")
        mgr.connect(1, ws_gm, "gm")
        mgr.connect(1, ws_player, "player")

        message = {"type": "snapshot"}
        await mgr.broadcast_to_role(1, "player", message)

        expected = json.dumps(message)
        ws_player.send_text.assert_awaited_once_with(expected)
        ws_gm.send_text.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_broadcast_skips_failed_send(self) -> None:
        mgr = ConnectionManager()
        ws_ok = _make_ws("ok")
        ws_bad = _make_ws("bad")
        ws_bad.send_text.side_effect = RuntimeError("closed")
        mgr.connect(1, ws_ok, "gm")
        mgr.connect(1, ws_bad, "player")

        message = {"type": "state_changes", "changes": []}
        await mgr.broadcast(1, message)

        # The good one should still receive the message
        ws_ok.send_text.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_broadcast_no_connections_is_noop(self) -> None:
        mgr = ConnectionManager()
        # Should not raise
        await mgr.broadcast(999, {"type": "test"})

    def test_module_exports_singleton(self) -> None:
        assert isinstance(connection_manager, ConnectionManager)
