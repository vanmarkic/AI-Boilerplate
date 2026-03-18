"""HTTP API tests for audit router endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from features.audit.audit_repository import AuditRepository
from features.audit.audit_schema import CreateAuditEntry
from features.audit.audit_service import AuditService


async def _create_exercise(client: AsyncClient) -> int:
    resp = await client.post("/api/exercises", json={"title": "Audit Test Ex"})
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.fixture
async def audit_service(setup_db: None) -> AuditService:
    """Provide an AuditService wired to the test DB session."""
    from core.database import get_session
    from main import app

    session_gen = app.dependency_overrides[get_session]()
    session: AsyncSession = await session_gen.__anext__()
    repo = AuditRepository(session)
    return AuditService(repo)
    # session cleanup handled by setup_db fixture


async def _log_entry(
    service: AuditService,
    exercise_id: int,
    entry_type: str = "phase_change",
    action: str = "started",
) -> None:
    await service.log(
        CreateAuditEntry(
            exercise_id=exercise_id,
            entry_type=entry_type,
            action=action,
        )
    )


@pytest.mark.asyncio
async def test_get_audit_log_empty(client: AsyncClient) -> None:
    eid = await _create_exercise(client)
    resp = await client.get(f"/api/audit/{eid}")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_get_audit_log_returns_entries(
    client: AsyncClient,
    audit_service: AuditService,
) -> None:
    eid = await _create_exercise(client)
    await _log_entry(audit_service, eid, "phase_change", "started")
    await _log_entry(audit_service, eid, "event_change", "activated")

    resp = await client.get(f"/api/audit/{eid}")
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 2


@pytest.mark.asyncio
async def test_get_audit_log_filter_by_entry_type(
    client: AsyncClient,
    audit_service: AuditService,
) -> None:
    eid = await _create_exercise(client)
    await _log_entry(audit_service, eid, "phase_change", "started")
    await _log_entry(audit_service, eid, "event_change", "activated")

    resp = await client.get(f"/api/audit/{eid}?entry_type=phase_change")
    assert resp.status_code == 200
    entries = resp.json()
    assert len(entries) == 1
    assert entries[0]["entry_type"] == "phase_change"


@pytest.mark.asyncio
async def test_get_audit_log_nonexistent_exercise(
    client: AsyncClient,
) -> None:
    resp = await client.get("/api/audit/99999")
    assert resp.status_code == 200
    assert resp.json() == []
