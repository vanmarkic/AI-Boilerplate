"""Integration tests for waiting room + WebSocket broadcast coordination.

Covers the high-value gaps: verifying that REST mutations (join, leave,
role-change) trigger WebSocket broadcasts, multi-client scenarios, game
master flows, and full lifecycle sequences.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from starlette.testclient import TestClient

from features.exercise.adapters.connection_manager import (
    connection_manager,
)

# ── Helpers ──────────────────────────────────────────────────────────────


async def _create_exercise(client: AsyncClient) -> int:
    resp = await client.post(
        "/api/exercises",
        json={"title": "Integration Test Exercise", "game_mode": "simple_collaborative"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _join(
    client: AsyncClient,
    exercise_id: int,
    display_name: str = "Alice",
    role: str = "player",
) -> dict:
    resp = await client.post(
        f"/api/exercises/{exercise_id}/waiting-room/join",
        json={"display_name": display_name, "role": role},
    )
    assert resp.status_code == 200
    return resp.json()


def _ws_client() -> TestClient:
    """Create a sync test client for WebSocket connections."""
    from main import app

    return TestClient(app)


def _recv_type(ws: object, msg_type: str, *, limit: int = 20) -> dict:
    """Receive WS messages until one with the given top-level type arrives.

    Skips interleaved messages (e.g. presence_update broadcasts) so tests
    are not sensitive to message ordering.
    """
    for _ in range(limit):
        data = json.loads(ws.receive_text())  # type: ignore[union-attr]
        if data.get("type") == msg_type:
            return data
    raise AssertionError(f"Did not receive message with type={msg_type!r} within {limit} messages")


# ── Broadcast on Join ────────────────────────────────────────────────────


class TestBroadcastOnJoin:
    """Verify that joining triggers a waiting_room_update broadcast."""

    @pytest.mark.asyncio
    async def test_join_calls_broadcast(self, client: AsyncClient) -> None:
        eid = await _create_exercise(client)
        with patch.object(
            connection_manager,
            "broadcast",
            new_callable=AsyncMock,
        ) as mock_broadcast:
            await _join(client, eid, "Alice", "player")

            mock_broadcast.assert_called_once()
            call_args = mock_broadcast.call_args
            assert call_args[0][0] == eid
            payload = call_args[0][1]
            assert payload["type"] == "waiting_room_update"
            assert payload["exercise_id"] == eid
            assert len(payload["participants"]) == 1
            assert payload["participants"][0]["display_name"] == "Alice"

    @pytest.mark.asyncio
    async def test_second_join_broadcasts_both_participants(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        with patch.object(
            connection_manager,
            "broadcast",
            new_callable=AsyncMock,
        ) as mock_broadcast:
            await _join(client, eid, "Alice", "player")
            await _join(client, eid, "Bob", "observer")

            assert mock_broadcast.call_count == 2
            last_payload = mock_broadcast.call_args_list[1][0][1]
            names = {p["display_name"] for p in last_payload["participants"]}
            assert names == {"Alice", "Bob"}


# ── Broadcast on Role Change ────────────────────────────────────────────


class TestBroadcastOnRoleChange:
    """Verify that role updates trigger broadcasts with correct state."""

    @pytest.mark.asyncio
    async def test_role_change_broadcasts_updated_role(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        with patch.object(
            connection_manager,
            "broadcast",
            new_callable=AsyncMock,
        ) as mock_broadcast:
            resp = await client.put(
                f"/api/exercises/{eid}/waiting-room/participants/{p['id']}/role",
                json={"role": "trainer"},
            )
            assert resp.status_code == 200

            mock_broadcast.assert_called_once()
            payload = mock_broadcast.call_args[0][1]
            assert payload["participants"][0]["role"] == "trainer"

    @pytest.mark.asyncio
    async def test_role_change_does_not_broadcast_on_404(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        with patch.object(
            connection_manager,
            "broadcast",
            new_callable=AsyncMock,
        ) as mock_broadcast:
            resp = await client.put(
                f"/api/exercises/{eid}/waiting-room/participants/bad-id/role",
                json={"role": "observer"},
            )
            assert resp.status_code == 404
            mock_broadcast.assert_not_called()


# ── Broadcast on Leave ──────────────────────────────────────────────────


class TestBroadcastOnLeave:
    """Verify that leaving triggers a broadcast without the removed player."""

    @pytest.mark.asyncio
    async def test_leave_broadcasts_remaining_participants(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p1 = await _join(client, eid, "Alice", "player")
        await _join(client, eid, "Bob", "observer")

        with patch.object(
            connection_manager,
            "broadcast",
            new_callable=AsyncMock,
        ) as mock_broadcast:
            resp = await client.delete(
                f"/api/exercises/{eid}/waiting-room/participants/{p1['id']}",
            )
            assert resp.status_code == 204

            mock_broadcast.assert_called_once()
            payload = mock_broadcast.call_args[0][1]
            names = {p["display_name"] for p in payload["participants"]}
            assert names == {"Bob"}

    @pytest.mark.asyncio
    async def test_leave_last_participant_broadcasts_empty(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        with patch.object(
            connection_manager,
            "broadcast",
            new_callable=AsyncMock,
        ) as mock_broadcast:
            await client.delete(
                f"/api/exercises/{eid}/waiting-room/participants/{p['id']}",
            )

            payload = mock_broadcast.call_args[0][1]
            assert payload["participants"] == []

    @pytest.mark.asyncio
    async def test_leave_does_not_broadcast_on_404(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        with patch.object(
            connection_manager,
            "broadcast",
            new_callable=AsyncMock,
        ) as mock_broadcast:
            resp = await client.delete(
                f"/api/exercises/{eid}/waiting-room/participants/bad-id",
            )
            assert resp.status_code == 404
            mock_broadcast.assert_not_called()


# ── Trainer Flow ────────────────────────────────────────────────────────


class TestTrainerFlow:
    """Integration tests for trainer-specific scenarios."""

    @pytest.mark.asyncio
    async def test_join_as_trainer(self, client: AsyncClient) -> None:
        eid = await _create_exercise(client)
        gm = await _join(client, eid, "GM Lead", "trainer")
        assert gm["role"] == "trainer"
        assert gm["display_name"] == "GM Lead"

    @pytest.mark.asyncio
    async def test_gm_promotes_player(self, client: AsyncClient) -> None:
        """Trainer joins, a player joins, trainer promotes player to trainer."""
        eid = await _create_exercise(client)
        await _join(client, eid, "GM Lead", "trainer")
        player = await _join(client, eid, "Trainee", "player")

        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{player['id']}/role",
            json={"role": "trainer"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "trainer"

        # Verify both are now trainers
        listing = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        roles = [p["role"] for p in listing.json()["participants"]]
        assert roles.count("trainer") == 2

    @pytest.mark.asyncio
    async def test_gm_demotes_self_to_player(
        self,
        client: AsyncClient,
    ) -> None:
        """Trainer can demote themselves to player."""
        eid = await _create_exercise(client)
        gm = await _join(client, eid, "GM Lead", "trainer")

        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{gm['id']}/role",
            json={"role": "player"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "player"

    @pytest.mark.asyncio
    async def test_gm_assigns_diverse_roles(
        self,
        client: AsyncClient,
    ) -> None:
        """Trainer sets up a room with player, observer, and soc-analyst roles."""
        eid = await _create_exercise(client)
        await _join(client, eid, "GM Lead", "trainer")
        p1 = await _join(client, eid, "Alice", "player")
        p2 = await _join(client, eid, "Bob", "player")
        p3 = await _join(client, eid, "Carol", "player")

        for pid, role in [
            (p1["id"], "observer"),
            (p2["id"], "soc-analyst"),
            (p3["id"], "player"),
        ]:
            resp = await client.put(
                f"/api/exercises/{eid}/waiting-room/participants/{pid}/role",
                json={"role": role},
            )
            assert resp.status_code == 200

        listing = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        role_map = {p["display_name"]: p["role"] for p in listing.json()["participants"]}
        assert role_map == {
            "GM Lead": "trainer",
            "Alice": "observer",
            "Bob": "soc-analyst",
            "Carol": "player",
        }


# ── WebSocket Live Broadcast ────────────────────────────────────────────


class TestWsBroadcastLive:
    """End-to-end: WS client connects, REST join triggers real broadcast."""

    def test_ws_client_receives_join_broadcast(self) -> None:
        """A connected WS client gets a waiting_room_update on join."""
        sync_client = _ws_client()

        # Create exercise via sync client
        resp = sync_client.post(
            "/api/exercises",
            json={"title": "WS Live Test", "game_mode": "simple_collaborative"},
        )
        assert resp.status_code == 201
        eid = resp.json()["id"]

        with sync_client.websocket_connect(
            f"/api/exercises/{eid}/ws?role=gm",
        ) as ws:
            # Join via REST — should broadcast to the WS client
            join_resp = sync_client.post(
                f"/api/exercises/{eid}/waiting-room/join",
                json={"display_name": "Alice", "role": "player"},
            )
            assert join_resp.status_code == 200

            msg = _recv_type(ws, "waiting_room_update")
            assert msg["exercise_id"] == eid
            assert len(msg["participants"]) == 1
            assert msg["participants"][0]["display_name"] == "Alice"

    def test_ws_client_receives_role_change_broadcast(self) -> None:
        """WS client sees updated role after PUT /role."""
        sync_client = _ws_client()

        resp = sync_client.post(
            "/api/exercises",
            json={"title": "WS Role Test", "game_mode": "simple_collaborative"},
        )
        eid = resp.json()["id"]

        with sync_client.websocket_connect(
            f"/api/exercises/{eid}/ws?role=player",
        ) as ws:
            join_resp = sync_client.post(
                f"/api/exercises/{eid}/waiting-room/join",
                json={"display_name": "Alice", "role": "player"},
            )
            pid = join_resp.json()["id"]
            # Consume join broadcast (player never gets presence_update)
            _recv_type(ws, "waiting_room_update")

            # Change role
            sync_client.put(
                f"/api/exercises/{eid}/waiting-room/participants/{pid}/role",
                json={"role": "trainer"},
            )

            msg = _recv_type(ws, "waiting_room_update")
            assert msg["participants"][0]["role"] == "trainer"

    def test_ws_client_receives_leave_broadcast(self) -> None:
        """WS client sees participant removed after DELETE."""
        sync_client = _ws_client()

        resp = sync_client.post(
            "/api/exercises",
            json={"title": "WS Leave Test", "game_mode": "simple_collaborative"},
        )
        eid = resp.json()["id"]

        with sync_client.websocket_connect(
            f"/api/exercises/{eid}/ws?role=gm",
        ) as ws:
            join_resp = sync_client.post(
                f"/api/exercises/{eid}/waiting-room/join",
                json={"display_name": "Alice", "role": "player"},
            )
            pid = join_resp.json()["id"]
            _recv_type(ws, "waiting_room_update")  # consume join broadcast

            sync_client.delete(
                f"/api/exercises/{eid}/waiting-room/participants/{pid}",
            )

            msg = _recv_type(ws, "waiting_room_update")
            assert msg["participants"] == []

    def test_multiple_ws_clients_receive_broadcast(self) -> None:
        """Two WS clients both receive the same broadcast on join."""
        sync_client = _ws_client()

        resp = sync_client.post(
            "/api/exercises",
            json={"title": "Multi WS Test", "game_mode": "simple_collaborative"},
        )
        eid = resp.json()["id"]

        with (
            sync_client.websocket_connect(
                f"/api/exercises/{eid}/ws?role=gm",
            ) as ws_gm,
            sync_client.websocket_connect(
                f"/api/exercises/{eid}/ws?role=player",
            ) as ws_player,
        ):
            sync_client.post(
                f"/api/exercises/{eid}/waiting-room/join",
                json={"display_name": "Alice", "role": "player"},
            )

            msg_gm = _recv_type(ws_gm, "waiting_room_update")
            msg_player = _recv_type(ws_player, "waiting_room_update")

            assert msg_gm["participants"] == msg_player["participants"]


# ── Full Lifecycle Integration ──────────────────────────────────────────


class TestFullLifecycle:
    """End-to-end lifecycle: create exercise → join → assign roles → leave."""

    @pytest.mark.asyncio
    async def test_complete_waiting_room_lifecycle(
        self,
        client: AsyncClient,
    ) -> None:
        """Simulate a realistic pre-exercise setup flow."""
        eid = await _create_exercise(client)

        # 1. Trainer joins first
        _gm = await _join(client, eid, "Commander", "trainer")

        # 2. Players join with default role
        p1 = await _join(client, eid, "Alice", "player")
        p2 = await _join(client, eid, "Bob", "player")
        p3 = await _join(client, eid, "Carol", "player")

        # 3. GM assigns specialised roles
        await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p1['id']}/role",
            json={"role": "soc-analyst"},
        )
        await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p2['id']}/role",
            json={"role": "observer"},
        )

        # 4. A late joiner arrives
        _p4 = await _join(client, eid, "Dave", "player")

        # 5. Carol decides to leave before start
        resp = await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/{p3['id']}",
        )
        assert resp.status_code == 204

        # 6. Verify final roster
        listing = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        data = listing.json()
        assert data["exercise_id"] == eid
        assert len(data["participants"]) == 4

        role_map = {p["display_name"]: p["role"] for p in data["participants"]}
        assert role_map == {
            "Commander": "trainer",
            "Alice": "soc-analyst",
            "Bob": "observer",
            "Dave": "player",
        }

    @pytest.mark.asyncio
    async def test_join_across_exercises_isolated(
        self,
        client: AsyncClient,
    ) -> None:
        """Participants in different exercises don't interfere."""
        eid1 = await _create_exercise(client)
        eid2 = await _create_exercise(client)

        gm1 = await _join(client, eid1, "GM-Alpha", "trainer")
        _gm2 = await _join(client, eid2, "GM-Bravo", "trainer")
        await _join(client, eid1, "Alice", "player")
        await _join(client, eid2, "Bob", "player")

        # Leave GM from exercise 1
        await client.delete(
            f"/api/exercises/{eid1}/waiting-room/participants/{gm1['id']}",
        )

        # Exercise 2 should be unaffected
        listing2 = await client.get(
            f"/api/exercises/{eid2}/waiting-room",
        )
        names2 = {p["display_name"] for p in listing2.json()["participants"]}
        assert names2 == {"GM-Bravo", "Bob"}

        # Exercise 1 should only have Alice
        listing1 = await client.get(
            f"/api/exercises/{eid1}/waiting-room",
        )
        names1 = {p["display_name"] for p in listing1.json()["participants"]}
        assert names1 == {"Alice"}

    @pytest.mark.asyncio
    async def test_rapid_join_leave_cycle(
        self,
        client: AsyncClient,
    ) -> None:
        """Rapid join/leave cycles should not corrupt state."""
        eid = await _create_exercise(client)

        ids: list[str] = []
        for i in range(5):
            p = await _join(client, eid, f"User-{i}", "player")
            ids.append(p["id"])

        # Remove all in reverse order
        for pid in reversed(ids):
            resp = await client.delete(
                f"/api/exercises/{eid}/waiting-room/participants/{pid}",
            )
            assert resp.status_code == 204

        listing = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        assert listing.json()["participants"] == []

    @pytest.mark.asyncio
    async def test_broadcast_count_matches_mutations(
        self,
        client: AsyncClient,
    ) -> None:
        """Each mutation (join/leave/role-change) emits exactly one broadcast."""
        eid = await _create_exercise(client)

        with patch.object(
            connection_manager,
            "broadcast",
            new_callable=AsyncMock,
        ) as mock_broadcast:
            p1 = await _join(client, eid, "Alice", "player")  # 1
            p2 = await _join(client, eid, "Bob", "player")  # 2

            await client.put(  # 3
                f"/api/exercises/{eid}/waiting-room/participants/{p1['id']}/role",
                json={"role": "trainer"},
            )
            await client.delete(  # 4
                f"/api/exercises/{eid}/waiting-room/participants/{p2['id']}",
            )

            assert mock_broadcast.call_count == 4
