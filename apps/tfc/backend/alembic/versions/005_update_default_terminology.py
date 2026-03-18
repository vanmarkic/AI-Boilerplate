"""Update default domain preset terminology: Event→Inject, Issue→Defect.

Revision ID: 005_update_default_terminology
Revises: 004_add_session_code
Create Date: 2026-03-18
"""
from typing import Sequence, Union

from alembic import op

revision: str = "005_update_default_terminology"
down_revision: Union[str, None] = "004_add_session_code"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE tfc_domain_configs
        SET terminology = jsonb_set(
            jsonb_set(terminology::jsonb, '{event}', '"Inject"'),
            '{issue}', '"Defect"'
        )
        WHERE slug = 'default'
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE tfc_domain_configs
        SET terminology = jsonb_set(
            jsonb_set(terminology::jsonb, '{event}', '"Event"'),
            '{issue}', '"Issue"'
        )
        WHERE slug = 'default'
    """)
