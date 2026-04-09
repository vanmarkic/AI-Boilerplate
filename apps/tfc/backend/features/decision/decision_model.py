from datetime import datetime

from sqlalchemy import Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class Decision(Base):
    __tablename__ = "tfc_decisions"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tfc_exercises.id"),
    )
    defect_id: Mapped[str] = mapped_column(String(255))
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    question_type: Mapped[str] = mapped_column(String(50))
    options: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    completion_mode: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(nullable=True)


class DecisionResponseRecord(Base):
    __tablename__ = "tfc_decision_responses"

    id: Mapped[int] = mapped_column(primary_key=True)
    decision_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tfc_decisions.id"),
    )
    participant_id: Mapped[str] = mapped_column(String(255))
    participant_name: Mapped[str] = mapped_column(String(255))
    selected_options: Mapped[list | None] = mapped_column(
        JSON, nullable=True,
    )
    free_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(server_default=func.now())
