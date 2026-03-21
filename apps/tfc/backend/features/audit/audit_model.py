"""Audit log model for exercise event tracking.

Every engine state change, GM action, and player response is recorded
for after-action review and scoring.
"""

from datetime import datetime

from sqlalchemy import JSON, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class AuditEntry(Base):
    __tablename__ = "tfc_audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(Integer, index=True)
    entry_type: Mapped[str] = mapped_column(String(50))
    action: Mapped[str] = mapped_column(String(100))
    actor_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    actor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    play_time_ms: Mapped[float] = mapped_column(default=0.0)
    real_time_ms: Mapped[float] = mapped_column(default=0.0)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
