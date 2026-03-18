"""Test that all Alembic migrations can upgrade and downgrade cleanly.

Runs upgrade to head, then downgrades step-by-step back to base,
ensuring every migration's downgrade() path works without errors.
"""

from collections.abc import Generator

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory

from alembic import command


def get_alembic_config() -> Config:
    """Build an Alembic Config pointing at the main backend alembic.ini."""
    config = Config("alembic.ini")
    return config


def get_revision_ids(config: Config) -> list[str]:
    """Return all migration revision IDs in upgrade order (oldest first)."""
    script = ScriptDirectory.from_config(config)
    revisions: list[str] = []
    for rev in script.walk_revisions("base", "heads"):
        revisions.append(rev.revision)
    revisions.reverse()
    return revisions


@pytest.fixture()
def alembic_config() -> Generator[Config, None, None]:
    """Provide an Alembic config and ensure the DB is at base after test."""
    config = get_alembic_config()
    command.downgrade(config, "base")
    yield config
    command.downgrade(config, "base")


def test_upgrade_to_head(alembic_config: Config) -> None:
    """Verify that upgrading to head succeeds."""
    command.upgrade(alembic_config, "head")


def test_downgrade_step_by_step(alembic_config: Config) -> None:
    """Upgrade to head, then downgrade one revision at a time to base."""
    config = alembic_config
    revisions = get_revision_ids(config)
    assert len(revisions) > 0, "No migration revisions found"

    # Upgrade to head
    command.upgrade(config, "head")

    # Downgrade one step at a time, from newest to oldest
    for _rev in reversed(revisions):
        command.downgrade(config, "-1")

    # Verify we are at base: upgrading from current should re-apply all
    command.upgrade(config, "head")


def test_upgrade_downgrade_each_revision(alembic_config: Config) -> None:
    """Upgrade and immediately downgrade each revision individually."""
    config = alembic_config
    revisions = get_revision_ids(config)
    assert len(revisions) > 0, "No migration revisions found"

    for rev in revisions:
        command.upgrade(config, rev)
        command.downgrade(config, "-1")
        # Re-upgrade so the next revision can be applied
        command.upgrade(config, rev)

    # Final state: at head
    command.downgrade(config, "base")
