from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class EventsTimeline(Base):
    __tablename__ = "events_timelines"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str]
    description: Mapped[str]
    event_date: Mapped[datetime]
    event_type: Mapped[str]  # e.g., conference, webinar, meetup, workshop
    location: Mapped[str | None] = mapped_column(nullable=True)
    url: Mapped[str | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(default="upcoming")  # upcoming, completed, cancelled
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
