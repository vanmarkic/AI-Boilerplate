from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.audit.audit_model import AuditEntry


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, entry: AuditEntry) -> AuditEntry:
        self.session.add(entry)
        await self.session.flush()
        await self.session.refresh(entry)
        return entry

    async def list_by_exercise(
        self,
        exercise_id: int,
        entry_type: str | None = None,
        limit: int = 500,
    ) -> list[AuditEntry]:
        stmt = (
            select(AuditEntry)
            .where(AuditEntry.exercise_id == exercise_id)
            .order_by(AuditEntry.play_time_ms)
            .limit(limit)
        )
        if entry_type:
            stmt = stmt.where(AuditEntry.entry_type == entry_type)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
