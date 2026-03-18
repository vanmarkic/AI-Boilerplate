"""Add tfc_domain_configs table, seed presets, add FK to scenarios/exercises.

Revision ID: 002_domain_configs
Revises: 001_initial
Create Date: 2026-03-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision: str = "002_domain_configs"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ---------------------------------------------------------------------------
# Seed data — matches the 4 hardcoded presets being replaced
# ---------------------------------------------------------------------------
PRESETS = [
    {
        "slug": "default",
        "name": "Generic Training",
        "description": "Default domain for general-purpose training exercises.",
        "terminology": {
            "event": "Inject",
            "issue": "Defect",
            "player": "Player",
            "gameMaster": "Game Master",
            "exercise": "Exercise",
            "scenario": "Scenario",
            "decision": "Decision",
        },
        "theme": {
            "colorPrimary": "#3b82f6",
            "colorSecondary": "#6366f1",
            "colorBackground": "#ffffff",
            "colorForeground": "#1e293b",
            "fontFamily": "system-ui, sans-serif",
            "fontFamilyMono": "ui-monospace, monospace",
            "density": "comfortable",
        },
        "roles": [
            {"id": "player", "label": "Player", "description": "Standard participant"},
            {"id": "observer", "label": "Observer", "description": "Read-only observer"},
        ],
        "severity_levels": [
            {"id": "low", "label": "Low", "color": "#22c55e", "order": 1},
            {"id": "medium", "label": "Medium", "color": "#f59e0b", "order": 2},
            {"id": "high", "label": "High", "color": "#ef4444", "order": 3},
            {"id": "critical", "label": "Critical", "color": "#dc2626", "order": 4},
        ],
    },
    {
        "slug": "cybersecurity",
        "name": "Cybersecurity",
        "description": "Cyber incident response and SOC exercises.",
        "terminology": {
            "event": "Incident",
            "issue": "Vulnerability",
            "player": "SOC Analyst",
            "gameMaster": "Exercise Director",
            "exercise": "Cyber Exercise",
            "scenario": "Attack Scenario",
            "decision": "Response Action",
        },
        "theme": {
            "colorPrimary": "#06b6d4",
            "colorSecondary": "#8b5cf6",
            "colorBackground": "#0f172a",
            "colorForeground": "#e2e8f0",
            "fontFamily": "system-ui, sans-serif",
            "fontFamilyMono": "ui-monospace, monospace",
            "density": "compact",
        },
        "roles": [
            {"id": "soc-analyst", "label": "SOC Analyst", "description": "Security operations center analyst"},
            {"id": "incident-commander", "label": "Incident Commander", "description": "Leads incident response"},
            {"id": "forensic-analyst", "label": "Forensic Analyst", "description": "Digital forensics specialist"},
            {"id": "observer", "label": "Observer", "description": "Read-only observer"},
        ],
        "severity_levels": [
            {"id": "info", "label": "Informational", "color": "#3b82f6", "order": 1},
            {"id": "low", "label": "Low", "color": "#22c55e", "order": 2},
            {"id": "medium", "label": "Medium", "color": "#f59e0b", "order": 3},
            {"id": "high", "label": "High", "color": "#ef4444", "order": 4},
            {"id": "critical", "label": "Critical", "color": "#dc2626", "order": 5},
        ],
    },
    {
        "slug": "healthcare",
        "name": "Healthcare",
        "description": "Clinical simulation and medical training.",
        "terminology": {
            "event": "Case",
            "issue": "Complication",
            "player": "Clinician",
            "gameMaster": "Simulation Lead",
            "exercise": "Simulation",
            "scenario": "Clinical Scenario",
            "decision": "Clinical Decision",
        },
        "theme": {
            "colorPrimary": "#059669",
            "colorSecondary": "#0891b2",
            "colorBackground": "#ffffff",
            "colorForeground": "#1e293b",
            "fontFamily": "system-ui, sans-serif",
            "fontFamilyMono": "ui-monospace, monospace",
            "density": "comfortable",
        },
        "roles": [
            {"id": "clinician", "label": "Clinician", "description": "Medical practitioner"},
            {"id": "nurse", "label": "Nurse", "description": "Nursing staff"},
            {"id": "specialist", "label": "Specialist", "description": "Medical specialist consultant"},
            {"id": "observer", "label": "Observer", "description": "Read-only observer"},
        ],
        "severity_levels": [
            {"id": "routine", "label": "Routine", "color": "#22c55e", "order": 1},
            {"id": "urgent", "label": "Urgent", "color": "#f59e0b", "order": 2},
            {"id": "emergent", "label": "Emergent", "color": "#ef4444", "order": 3},
            {"id": "critical", "label": "Critical", "color": "#dc2626", "order": 4},
        ],
    },
    {
        "slug": "military",
        "name": "Military",
        "description": "Tactical and operational military exercises.",
        "terminology": {
            "event": "SITREP",
            "issue": "Operational Issue",
            "player": "Operator",
            "gameMaster": "Exercise Controller",
            "exercise": "Tactical Exercise",
            "scenario": "Operations Order",
            "decision": "Command Decision",
        },
        "theme": {
            "colorPrimary": "#65a30d",
            "colorSecondary": "#ca8a04",
            "colorBackground": "#1a1a1a",
            "colorForeground": "#d4d4d4",
            "fontFamily": "system-ui, sans-serif",
            "fontFamilyMono": "ui-monospace, monospace",
            "density": "compact",
        },
        "roles": [
            {"id": "operator", "label": "Operator", "description": "Military operator"},
            {"id": "commander", "label": "Commander", "description": "Unit commander"},
            {"id": "intelligence", "label": "Intelligence Analyst", "description": "Intel analyst"},
            {"id": "observer", "label": "Observer", "description": "Read-only observer"},
        ],
        "severity_levels": [
            {"id": "routine", "label": "Routine", "color": "#22c55e", "order": 1},
            {"id": "priority", "label": "Priority", "color": "#f59e0b", "order": 2},
            {"id": "immediate", "label": "Immediate", "color": "#ef4444", "order": 3},
            {"id": "flash", "label": "Flash", "color": "#dc2626", "order": 4},
        ],
    },
]


def upgrade() -> None:
    domain_configs = op.create_table(
        "tfc_domain_configs",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("slug", sa.String(100), unique=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, server_default=""),
        sa.Column("terminology", JSON, nullable=False),
        sa.Column("theme", JSON, nullable=False),
        sa.Column("roles", JSON, nullable=False),
        sa.Column("severity_levels", JSON, nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
        sa.Column(
            "updated_at", sa.DateTime,
            server_default=sa.func.now(), onupdate=sa.func.now(),
        ),
    )

    op.bulk_insert(domain_configs, PRESETS)

    op.create_foreign_key(
        "fk_tfc_scenarios_domain_config",
        "tfc_scenarios", "tfc_domain_configs",
        ["domain_id"], ["id"],
    )
    op.create_foreign_key(
        "fk_tfc_exercises_domain_config",
        "tfc_exercises", "tfc_domain_configs",
        ["domain_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_tfc_exercises_domain_config", "tfc_exercises", type_="foreignkey",
    )
    op.drop_constraint(
        "fk_tfc_scenarios_domain_config", "tfc_scenarios", type_="foreignkey",
    )
    op.drop_table("tfc_domain_configs")
