from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(index=True)
    event_type: Mapped[str] = mapped_column(String(50), index=True)
    severity: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(String(500))
    created_by: Mapped[str] = mapped_column(String(100), index=True)
    metadata: Mapped[dict] = mapped_column(default=dict)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
