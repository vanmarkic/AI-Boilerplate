"""add_domain_config_catalogs

Revision ID: 00fb7a3af6bd
Revises: 006_add_practice_mode
Create Date: 2026-03-22 20:31:48.133680

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '00fb7a3af6bd'
down_revision: Union[str, None] = '006_add_practice_mode'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tfc_domain_configs', sa.Column('systems', postgresql.JSON(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.add_column('tfc_domain_configs', sa.Column('warfare_domains', postgresql.JSON(astext_type=sa.Text()), server_default='[]', nullable=False))
    op.add_column('tfc_domain_configs', sa.Column('blue_card_catalog', postgresql.JSON(astext_type=sa.Text()), server_default='[]', nullable=False))


def downgrade() -> None:
    op.drop_column('tfc_domain_configs', 'blue_card_catalog')
    op.drop_column('tfc_domain_configs', 'warfare_domains')
    op.drop_column('tfc_domain_configs', 'systems')
