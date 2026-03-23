"""add_domain_config_catalogs

Revision ID: 00fb7a3af6bd
Revises: 006_add_practice_mode
Create Date: 2026-03-22 20:31:48.133680

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "00fb7a3af6bd"
down_revision: str | None = "006_add_practice_mode"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    json_col = postgresql.JSON(astext_type=sa.Text())
    op.add_column(
        "tfc_domain_configs",
        sa.Column(
            "systems",
            json_col,
            server_default="[]",
            nullable=False,
        ),
    )
    op.add_column(
        "tfc_domain_configs",
        sa.Column(
            "warfare_domains",
            json_col,
            server_default="[]",
            nullable=False,
        ),
    )
    op.add_column(
        "tfc_domain_configs",
        sa.Column(
            "blue_card_catalog",
            json_col,
            server_default="[]",
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("tfc_domain_configs", "blue_card_catalog")
    op.drop_column("tfc_domain_configs", "warfare_domains")
    op.drop_column("tfc_domain_configs", "systems")
