"""Add session_code column to tfc_exercises.

Revision ID: 004_add_session_code
Revises: 003_add_game_mode
Create Date: 2026-03-17
"""

import random
import string
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "004_add_session_code"
down_revision: str | None = "003_add_game_mode"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _generate_code() -> str:
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=6))


def upgrade() -> None:
    # Add column as nullable first so existing rows don't fail
    op.add_column(
        "tfc_exercises",
        sa.Column("session_code", sa.String(6), nullable=True),
    )

    # Backfill existing rows with unique codes
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id FROM tfc_exercises")).fetchall()
    used: set[str] = set()
    for (row_id,) in rows:
        code = _generate_code()
        while code in used:
            code = _generate_code()
        used.add(code)
        conn.execute(
            sa.text("UPDATE tfc_exercises SET session_code = :code WHERE id = :id"),
            {"code": code, "id": row_id},
        )

    # Now make it NOT NULL + UNIQUE
    op.alter_column("tfc_exercises", "session_code", nullable=False)
    op.create_unique_constraint(
        "uq_tfc_exercises_session_code",
        "tfc_exercises",
        ["session_code"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_tfc_exercises_session_code", "tfc_exercises", type_="unique")
    op.drop_column("tfc_exercises", "session_code")
