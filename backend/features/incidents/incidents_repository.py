from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.incidents.incidents_model import Incident


class IncidentRepository(CrudRepository[Incident]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Incident)

    async def list_by_filters(
        self,
        severity: str | None = None,
        status: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> list[Incident]:
        stmt = select(Incident)
        if severity:
            stmt = stmt.where(Incident.severity == severity)
        if status:
            stmt = stmt.where(Incident.status == status)
        if date_from:
            stmt = stmt.where(Incident.started_at >= date_from)
        if date_to:
            stmt = stmt.where(Incident.started_at <= date_to)
        stmt = stmt.order_by(Incident.started_at.desc())
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def get_histogram_data(
        self,
        period: str = "day",
        severity: str | None = None,
    ) -> list[dict]:
        """Get incident counts grouped by time period."""
        stmt = select(
            func.date_trunc(period, Incident.started_at).label("period"),
            func.count(Incident.id).label("count"),
        ).group_by(func.date_trunc(period, Incident.started_at))

        if severity:
            stmt = stmt.where(Incident.severity == severity)

        stmt = stmt.order_by("period")
        result = await self.session.execute(stmt)
        return [{"period": row[0], "count": row[1]} for row in result.all()]
