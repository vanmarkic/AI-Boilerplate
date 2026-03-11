from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.events.event_model import Event


class EventRepository(CrudRepository[Event]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Event)
