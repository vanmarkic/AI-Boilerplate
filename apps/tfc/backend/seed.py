"""Idempotent scenario seeder.

Reads JSON files from seeds/ and inserts them into tfc_scenarios
if a scenario with the same title does not already exist.

Runs as a standalone script before the app server starts:
    python seed.py
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from sqlalchemy import select, func

from core.database import async_session_factory
from features.scenario.scenario_model import Scenario

logger = logging.getLogger(__name__)
SEEDS_DIR = Path(__file__).parent / "seeds"


async def seed_scenarios() -> None:
    """Load all JSON seed files and insert missing scenarios."""
    if not SEEDS_DIR.is_dir():
        logger.info("No seeds/ directory found — skipping.")
        return

    seed_files = sorted(SEEDS_DIR.glob("*.json"))
    if not seed_files:
        logger.info("No seed files found — skipping.")
        return

    async with async_session_factory() as session:
        for path in seed_files:
            data = json.loads(path.read_text())
            title = data["title"]

            result = await session.execute(
                select(func.count()).select_from(Scenario).where(
                    Scenario.title == title,
                ),
            )
            if result.scalar_one() > 0:
                logger.info("Scenario '%s' already exists — skipping.", title)
                continue

            scenario = Scenario(
                title=title,
                description=data.get("description", ""),
                content=data.get("content"),
            )
            session.add(scenario)
            await session.commit()
            logger.info("Seeded scenario '%s' from %s", title, path.name)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
    asyncio.run(seed_scenarios())


if __name__ == "__main__":
    main()
