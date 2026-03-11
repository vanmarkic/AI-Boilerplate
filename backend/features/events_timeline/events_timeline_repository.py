from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.events_timeline.events_timeline_model import EventsTimeline


class EventsTimelineRepository(CrudRepository[EventsTimeline]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, EventsTimeline)

    # Add custom queries here (e.g., get_by_status, search)
