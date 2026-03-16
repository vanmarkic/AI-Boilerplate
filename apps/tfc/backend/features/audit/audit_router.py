from fastapi import APIRouter, Depends

from core.dependencies import get_audit_service
from features.audit.audit_schema import AuditEntryResponse
from features.audit.audit_service import AuditService

router = APIRouter(prefix="/api/audit", tags=["audit"])


@router.get(
    "/{exercise_id}",
    response_model=list[AuditEntryResponse],
    operation_id="getAuditLog",
)
async def get_audit_log(
    exercise_id: int,
    entry_type: str | None = None,
    service: AuditService = Depends(get_audit_service),
) -> list[AuditEntryResponse]:
    return await service.get_exercise_log(exercise_id, entry_type=entry_type)
