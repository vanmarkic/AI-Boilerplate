"""Exhaustive HTTP endpoint tests for the waiting room router.

Tests cover join, list, update role, leave, error handling,
broadcast integration, and edge cases.
"""

from __future__ import annotations

import pytest
from httpx import AsyncClient

# ── Helpers ──────────────────────────────────────────────────────────────


async def _create_exercise(client: AsyncClient) -> int:
    """Create an exercise and return its ID.

    Uses simple_collaborative to avoid classic-mode trainer auto-assign,
    keeping the waiting room empty for tests that verify join/leave mechanics.
    """
    resp = await client.post(
        "/api/exercises",
        json={"title": "WR Test Exercise", "game_mode": "simple_collaborative"},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _join(
    client: AsyncClient,
    exercise_id: int,
    display_name: str = "Alice",
    role: str = "player",
) -> dict:
    """Join the waiting room and return the response."""
    resp = await client.post(
        f"/api/exercises/{exercise_id}/waiting-room/join",
        json={"display_name": display_name, "role": role},
    )
    assert resp.status_code == 200
    return resp.json()


# ── Join ─────────────────────────────────────────────────────────────────


class TestJoinEndpoint:
    @pytest.mark.asyncio
    async def test_join_returns_participant(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        data = await _join(client, eid, "Alice", "player")
        assert data["display_name"] == "Alice"
        assert data["role"] == "player"
        assert "id" in data
        assert "joined_at" in data

    @pytest.mark.asyncio
    async def test_join_assigns_uuid(self, client: AsyncClient) -> None:
        eid = await _create_exercise(client)
        data = await _join(client, eid)
        assert len(data["id"]) == 36

    @pytest.mark.asyncio
    async def test_join_default_role_is_player(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        resp = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Bob"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "player"

    @pytest.mark.asyncio
    async def test_join_custom_role(self, client: AsyncClient) -> None:
        eid = await _create_exercise(client)
        data = await _join(client, eid, "Carol", "trainer")
        assert data["role"] == "trainer"

    @pytest.mark.asyncio
    async def test_join_multiple_participants(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p1 = await _join(client, eid, "Alice", "player")
        p2 = await _join(client, eid, "Bob", "observer")
        p3 = await _join(client, eid, "Carol", "trainer")
        assert p1["id"] != p2["id"] != p3["id"]

    @pytest.mark.asyncio
    async def test_join_empty_name_rejected(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        resp = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "", "role": "player"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_join_missing_name_rejected(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        resp = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"role": "player"},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_join_empty_role_rejected(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        resp = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Alice", "role": ""},
        )
        assert resp.status_code == 422


# ── List ─────────────────────────────────────────────────────────────────


class TestListEndpoint:
    @pytest.mark.asyncio
    async def test_list_empty_room(self, client: AsyncClient) -> None:
        eid = await _create_exercise(client)
        resp = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["exercise_id"] == eid
        assert data["participants"] == []

    @pytest.mark.asyncio
    async def test_list_after_joins(self, client: AsyncClient) -> None:
        eid = await _create_exercise(client)
        await _join(client, eid, "Alice", "player")
        await _join(client, eid, "Bob", "observer")

        resp = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        assert resp.status_code == 200
        participants = resp.json()["participants"]
        assert len(participants) == 2
        names = {p["display_name"] for p in participants}
        assert names == {"Alice", "Bob"}

    @pytest.mark.asyncio
    async def test_list_separate_exercises(
        self,
        client: AsyncClient,
    ) -> None:
        eid1 = await _create_exercise(client)
        eid2 = await _create_exercise(client)
        await _join(client, eid1, "Alice", "player")
        await _join(client, eid2, "Bob", "observer")

        resp1 = await client.get(
            f"/api/exercises/{eid1}/waiting-room",
        )
        resp2 = await client.get(
            f"/api/exercises/{eid2}/waiting-room",
        )
        assert len(resp1.json()["participants"]) == 1
        assert len(resp2.json()["participants"]) == 1
        assert resp1.json()["participants"][0]["display_name"] == "Alice"
        assert resp2.json()["participants"][0]["display_name"] == "Bob"

    @pytest.mark.asyncio
    async def test_list_reflects_role_changes(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}/role",
            json={"role": "trainer"},
        )
        resp = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        participants = resp.json()["participants"]
        assert participants[0]["role"] == "trainer"

    @pytest.mark.asyncio
    async def test_list_reflects_leaves(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p1 = await _join(client, eid, "Alice", "player")
        await _join(client, eid, "Bob", "observer")

        await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/{p1['id']}",
        )
        resp = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        participants = resp.json()["participants"]
        assert len(participants) == 1
        assert participants[0]["display_name"] == "Bob"


# ── Update Role ──────────────────────────────────────────────────────────


class TestUpdateRoleEndpoint:
    @pytest.mark.asyncio
    async def test_update_role_success(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}/role",
            json={"role": "trainer"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "trainer"

    @pytest.mark.asyncio
    async def test_update_role_preserves_other_fields(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}/role",
            json={"role": "observer"},
        )
        data = resp.json()
        assert data["display_name"] == "Alice"
        assert data["id"] == p["id"]
        assert data["joined_at"] == p["joined_at"]

    @pytest.mark.asyncio
    async def test_update_role_unknown_participant_404(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        await _join(client, eid, "Alice", "player")

        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/nonexistent/role",
            json={"role": "observer"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_role_no_room_404(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/any-id/role",
            json={"role": "observer"},
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_update_role_empty_role_rejected(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}/role",
            json={"role": ""},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_update_role_missing_role_rejected(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}/role",
            json={},
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_update_other_participants_role(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p1 = await _join(client, eid, "Alice", "player")
        p2 = await _join(client, eid, "Bob", "player")

        # Alice changes Bob's role
        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p2['id']}/role",
            json={"role": "trainer"},
        )
        assert resp.status_code == 200
        assert resp.json()["role"] == "trainer"
        # Alice's role unchanged
        listing = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        participants = listing.json()["participants"]
        alice = next(p for p in participants if p["id"] == p1["id"])
        assert alice["role"] == "player"

    @pytest.mark.asyncio
    async def test_update_role_multiple_times(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        for role in ["observer", "trainer", "soc-analyst", "player"]:
            resp = await client.put(
                f"/api/exercises/{eid}/waiting-room/participants/{p['id']}/role",
                json={"role": role},
            )
            assert resp.status_code == 200
            assert resp.json()["role"] == role


# ── Leave ────────────────────────────────────────────────────────────────


class TestLeaveEndpoint:
    @pytest.mark.asyncio
    async def test_leave_returns_204(self, client: AsyncClient) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        resp = await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}",
        )
        assert resp.status_code == 204

    @pytest.mark.asyncio
    async def test_leave_removes_from_list(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")
        await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}",
        )
        listing = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        assert len(listing.json()["participants"]) == 0

    @pytest.mark.asyncio
    async def test_leave_unknown_participant_404(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        await _join(client, eid, "Alice", "player")

        resp = await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/nonexistent",
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_leave_no_room_404(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        resp = await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/any-id",
        )
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_leave_twice_404(self, client: AsyncClient) -> None:
        eid = await _create_exercise(client)
        p = await _join(client, eid, "Alice", "player")

        resp1 = await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}",
        )
        assert resp1.status_code == 204

        resp2 = await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}",
        )
        assert resp2.status_code == 404

    @pytest.mark.asyncio
    async def test_leave_does_not_affect_others(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        p1 = await _join(client, eid, "Alice", "player")
        p2 = await _join(client, eid, "Bob", "observer")

        await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/{p1['id']}",
        )
        listing = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        participants = listing.json()["participants"]
        assert len(participants) == 1
        assert participants[0]["id"] == p2["id"]


# ── Full Flow Integration ────────────────────────────────────────────────


class TestFullFlow:
    @pytest.mark.asyncio
    async def test_join_change_role_leave_flow(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)

        # Three participants join
        p1 = await _join(client, eid, "Alice", "player")
        p2 = await _join(client, eid, "Bob", "player")
        p3 = await _join(client, eid, "Carol", "observer")

        # Alice changes Bob's role to trainer
        await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p2['id']}/role",
            json={"role": "trainer"},
        )

        # Carol changes her own role to player
        await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p3['id']}/role",
            json={"role": "player"},
        )

        # Alice leaves
        await client.delete(
            f"/api/exercises/{eid}/waiting-room/participants/{p1['id']}",
        )

        # Verify final state
        listing = await client.get(
            f"/api/exercises/{eid}/waiting-room",
        )
        participants = listing.json()["participants"]
        assert len(participants) == 2
        roles = {p["display_name"]: p["role"] for p in participants}
        assert roles == {"Bob": "trainer", "Carol": "player"}

    @pytest.mark.asyncio
    async def test_multiple_exercises_independent(
        self,
        client: AsyncClient,
    ) -> None:
        eid1 = await _create_exercise(client)
        eid2 = await _create_exercise(client)

        p1 = await _join(client, eid1, "Alice", "player")
        _p2 = await _join(client, eid2, "Bob", "observer")

        # Change role in exercise 1 only
        await client.put(
            f"/api/exercises/{eid1}/waiting-room/participants/{p1['id']}/role",
            json={"role": "trainer"},
        )

        # Verify exercise 2 unaffected
        listing2 = await client.get(
            f"/api/exercises/{eid2}/waiting-room",
        )
        assert listing2.json()["participants"][0]["role"] == "observer"


# ── Helpers for scenario-linked exercises ────────────────────────────


async def _create_scenario_with_roles(
    client: AsyncClient,
    roles: list[dict],
    game_mode: str = "simple_collaborative",
) -> int:
    """Create a scenario with roles and return its ID."""
    resp = await client.post(
        "/api/scenarios",
        json={
            "title": "Test Scenario",
            "content": {
                "phases": [],
                "events": [],
                "issues": [],
                "decision_templates": [],
                "default_time_factor": 1.0,
                "briefing": "Test",
                "objectives": [],
                "rules": [],
                "game_mode": game_mode,
                "game_mode_config": {},
                "decision_sequence": [],
                "roles": roles,
            },
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_exercise_with_scenario(
    client: AsyncClient,
    scenario_id: int,
    game_mode: str = "simple_collaborative",
) -> int:
    """Create an exercise linked to a scenario and return its ID."""
    resp = await client.post(
        "/api/exercises",
        json={
            "title": "Test Exercise",
            "scenario_id": scenario_id,
            "game_mode": game_mode,
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


_TWO_ROLES = [
    {"id": "co", "label": "CO", "player_type": "decision_maker"},
    {"id": "nav", "label": "NAV", "player_type": "advisor"},
]


# ── Unique Role Enforcement ──────────────────────────────────────────


class TestUniqueRoleEnforcement:
    @pytest.mark.asyncio
    async def test_join_with_taken_role_returns_409(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, _TWO_ROLES)
        eid = await _create_exercise_with_scenario(client, sid)
        await _join(client, eid, "Alice", "co")
        resp = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Bob", "role": "co"},
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_update_role_to_taken_role_returns_409(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, _TWO_ROLES)
        eid = await _create_exercise_with_scenario(client, sid)
        await _join(client, eid, "Alice", "co")
        p2 = await _join(client, eid, "Bob", "nav")
        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p2['id']}/role",
            json={"role": "co"},
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_update_role_to_own_current_role_succeeds(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, _TWO_ROLES)
        eid = await _create_exercise_with_scenario(client, sid)
        p = await _join(client, eid, "Alice", "co")
        resp = await client.put(
            f"/api/exercises/{eid}/waiting-room/participants/{p['id']}/role",
            json={"role": "co"},
        )
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_join_with_player_placeholder_allows_duplicates(
        self,
        client: AsyncClient,
    ) -> None:
        """Multiple participants can join with the generic 'player' role."""
        sid = await _create_scenario_with_roles(client, _TWO_ROLES)
        eid = await _create_exercise_with_scenario(client, sid)
        p1 = await _join(client, eid, "Alice", "player")
        p2 = await _join(client, eid, "Bob", "player")
        assert p1["role"] == "player"
        assert p2["role"] == "player"

    @pytest.mark.asyncio
    async def test_join_with_available_role_succeeds(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, _TWO_ROLES)
        eid = await _create_exercise_with_scenario(client, sid)
        await _join(client, eid, "Alice", "co")
        p2 = await _join(client, eid, "Bob", "nav")
        assert p2["role"] == "nav"

    @pytest.mark.asyncio
    async def test_exercise_without_scenario_allows_duplicate_roles(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        await _join(client, eid, "Alice", "player")
        p2 = await _join(client, eid, "Bob", "player")
        assert p2["role"] == "player"


# ── Max Players Enforcement ──────────────────────────────────────────


class TestMaxPlayersEnforcement:
    @pytest.mark.asyncio
    async def test_join_when_full_returns_409(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, _TWO_ROLES)
        eid = await _create_exercise_with_scenario(client, sid)
        await _join(client, eid, "Alice", "co")
        await _join(client, eid, "Bob", "nav")
        resp = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Carol", "role": "player"},
        )
        assert resp.status_code == 409

    @pytest.mark.asyncio
    async def test_join_when_slots_available_succeeds(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario_with_roles(client, _TWO_ROLES)
        eid = await _create_exercise_with_scenario(client, sid)
        p = await _join(client, eid, "Alice", "co")
        assert p["display_name"] == "Alice"

    @pytest.mark.asyncio
    async def test_exercise_without_scenario_has_no_limit(
        self,
        client: AsyncClient,
    ) -> None:
        eid = await _create_exercise(client)
        for i in range(10):
            p = await _join(client, eid, f"Player{i}", "player")
            assert p["display_name"] == f"Player{i}"
