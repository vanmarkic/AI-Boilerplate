"""Align terminology: issue_id → defect_id, drop domain_id columns.

Revision ID: 002_terminology
Revises: 001_initial
Create Date: 2026-04-09
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002_terminology"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("tfc_decisions", "issue_id", new_column_name="defect_id")
    op.drop_column("tfc_exercises", "domain_id")
    op.drop_column("tfc_scenarios", "domain_id")


def downgrade() -> None:
    op.add_column("tfc_scenarios", sa.Column("domain_id", sa.Integer, nullable=True))
    op.add_column("tfc_exercises", sa.Column("domain_id", sa.Integer, nullable=True))
    op.alter_column("tfc_decisions", "defect_id", new_column_name="issue_id")
