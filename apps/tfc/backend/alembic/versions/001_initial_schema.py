"""Initial TFC schema — exercises, scenarios, decisions, audit.

Revision ID: 001_initial
Revises: None
Create Date: 2026-03-16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

from alembic import op

revision: str = "001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "tfc_exercises",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("phase", sa.String(50), server_default="setup"),
        sa.Column("scenario_id", sa.Integer, nullable=True),
        sa.Column("domain_id", sa.Integer, nullable=True),
        sa.Column("time_factor", sa.Float, server_default="1.0"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "tfc_scenarios",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("domain_id", sa.Integer, nullable=True),
        sa.Column("content", JSON, nullable=True),
        sa.Column("version", sa.Integer, server_default="1"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "tfc_decisions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("exercise_id", sa.Integer, sa.ForeignKey("tfc_exercises.id"), nullable=False),
        sa.Column("issue_id", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("question_type", sa.String(50), nullable=False),
        sa.Column("options", JSON, nullable=True),
        sa.Column("completion_mode", sa.String(50), server_default="first_response"),
        sa.Column("status", sa.String(20), server_default="open"),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column("closed_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_tfc_decisions_exercise_id", "tfc_decisions", ["exercise_id"])

    op.create_table(
        "tfc_decision_responses",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "decision_id",
            sa.Integer,
            sa.ForeignKey("tfc_decisions.id"),
            nullable=False,
        ),
        sa.Column("participant_id", sa.String(255), nullable=False),
        sa.Column("participant_name", sa.String(255), nullable=False),
        sa.Column("selected_options", JSON, nullable=True),
        sa.Column("free_text", sa.Text, nullable=True),
        sa.Column("score", sa.Float, nullable=True),
        sa.Column("submitted_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_tfc_decision_responses_decision_id",
        "tfc_decision_responses",
        ["decision_id"],
    )

    op.create_table(
        "tfc_audit_log",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("exercise_id", sa.Integer, nullable=False),
        sa.Column("entry_type", sa.String(50), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("actor_id", sa.String(255), nullable=True),
        sa.Column("actor_name", sa.String(255), nullable=True),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("target_id", sa.String(255), nullable=True),
        sa.Column("play_time_ms", sa.Float, server_default="0"),
        sa.Column("real_time_ms", sa.Float, server_default="0"),
        sa.Column("details", JSON, nullable=True),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index("ix_tfc_audit_log_exercise_id", "tfc_audit_log", ["exercise_id"])


def downgrade() -> None:
    op.drop_table("tfc_audit_log")
    op.drop_table("tfc_decision_responses")
    op.drop_table("tfc_decisions")
    op.drop_table("tfc_scenarios")
    op.drop_table("tfc_exercises")
