import random
import string
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


def _generate_session_code() -> str:
    """Generate a 6-character uppercase alphanumeric session code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=6))  # noqa: S311 — not crypto, just human-readable codes


class Exercise(Base):
    __tablename__ = "tfc_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    phase: Mapped[str] = mapped_column(String(50), default="setup")
    scenario_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    domain_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("tfc_domain_configs.id"),
        nullable=True,
    )
    time_factor: Mapped[float] = mapped_column(default=1.0)
    game_mode: Mapped[str] = mapped_column(String(50), default="classic")
    practice_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    session_code: Mapped[str] = mapped_column(
        String(6),
        default=_generate_session_code,
        unique=True,
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
    )
