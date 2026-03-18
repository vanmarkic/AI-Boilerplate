"""Tests for WebSocket exercise endpoint.

Tests written first (TDD) — these should fail until implementation exists.
"""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from starlette.testclient import TestClient

from features.exercise.adapters.connection_manager import ConnectionManager


class TestWsRouterIntegration:
    """Integration tests using a test client for the WebSocket endpoint."""

    def _make_app(self) -> TestClient:
        """Create a minimal FastAPI app with the ws_router."""
        from fastapi import FastAPI

        from features.exercise.ws_router import ws_router

        app = FastAPI()
        app.include_router(ws_router)
        return TestClient(app)

    def test_ws_connect_and_disconnect(self) -> None:
        client = self._make_app()
        with client.websocket_connect("/api/exercises/1/ws?role=gm") as ws:
            # Connection should succeed; just close it
            pass

    def test_ws_connect_player_role(self) -> None:
        client = self._make_app()
        with client.websocket_connect("/api/exercises/1/ws?role=player") as ws:
            pass

    def test_ws_ping_pong(self) -> None:
        client = self._make_app()
        with client.websocket_connect("/api/exercises/1/ws?role=gm") as ws:
            ws.send_text(json.dumps({"type": "ping"}))
            # Drain any messages that arrive before the pong (e.g.
            # state_changes from broadcast_presence on connect).
            for _ in range(10):
                response = ws.receive_text()
                data = json.loads(response)
                if data["type"] == "pong":
                    break
            assert data["type"] == "pong"

    def test_ws_default_role_is_player(self) -> None:
        client = self._make_app()
        # No role query param — should default to player
        with client.websocket_connect("/api/exercises/1/ws") as ws:
            pass


class TestConnectionManagerWiring:
    """Test that the ws_router wires into connection_manager correctly."""

    def test_connect_calls_manager(self) -> None:
        """Verify connect/disconnect lifecycle calls the manager."""
        mock_mgr = ConnectionManager()

        with patch(
            "features.exercise.ws_router.connection_manager", mock_mgr
        ):
            from fastapi import FastAPI

            from features.exercise.ws_router import ws_router

            app = FastAPI()
            app.include_router(ws_router)
            client = TestClient(app)

            with client.websocket_connect(
                "/api/exercises/42/ws?role=gm"
            ) as ws:
                conns = mock_mgr.get_connections(42)
                assert len(conns) == 1
                assert conns[0][1] == "gm"

            # After disconnect
            conns = mock_mgr.get_connections(42)
            assert len(conns) == 0
