import pytest
from fastapi import status
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_event(client: AsyncClient) -> None:
    response = await client.post(
        "/api/events",
        json={
            "title": "Team standup",
            "description": "Daily sync with engineering team",
            "event_time": "Today at 10:00 AM",
            "status": "upcoming",
            "event_type": "meeting",
            "badge_variant": "outline",
        },
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["title"] == "Team standup"
    assert data["event_type"] == "meeting"


@pytest.mark.asyncio
async def test_list_events(client: AsyncClient) -> None:
    # Create an event first
    await client.post(
        "/api/events",
        json={
            "title": "Release v2.5.0",
            "description": "Production deployment scheduled",
            "event_time": "Today at 2:00 PM",
            "status": "upcoming",
            "event_type": "milestone",
            "badge_variant": "default",
        },
    )

    response = await client.get("/api/events")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) >= 1


@pytest.mark.asyncio
async def test_get_event(client: AsyncClient) -> None:
    # Create an event first
    create_response = await client.post(
        "/api/events",
        json={
            "title": "Database maintenance",
            "description": "Scheduled backup and optimization",
            "event_time": "Today at 6:00 PM",
            "status": "upcoming",
            "event_type": "deadline",
            "badge_variant": "secondary",
        },
    )
    event_id = create_response.json()["id"]

    response = await client.get(f"/api/events/{event_id}")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == event_id
    assert data["title"] == "Database maintenance"


@pytest.mark.asyncio
async def test_delete_event(client: AsyncClient) -> None:
    # Create an event first
    create_response = await client.post(
        "/api/events",
        json={
            "title": "Code review complete",
            "description": "PR #1247 approved and merged",
            "event_time": "2 hours ago",
            "status": "completed",
            "event_type": "notification",
            "badge_variant": "default",
        },
    )
    event_id = create_response.json()["id"]

    # Delete the event
    response = await client.delete(f"/api/events/{event_id}")
    assert response.status_code == status.HTTP_204_NO_CONTENT

    # Verify it's deleted
    get_response = await client.get(f"/api/events/{event_id}")
    assert get_response.status_code == status.HTTP_404_NOT_FOUND
