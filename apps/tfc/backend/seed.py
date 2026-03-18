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

from pydantic import ValidationError
from sqlalchemy import select

from core.database import async_session_factory
from features.domain_config.domain_config_model import DomainConfig  # noqa: F401
from features.scenario.scenario_content import ScenarioContent
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
            content_raw = data.get("content")
            if content_raw is not None:
                try:
                    ScenarioContent.model_validate(content_raw)
                except ValidationError as exc:
                    logger.error(
                        "Seed '%s' has invalid content — skipping: %s",
                        path.name,
                        exc,
                    )
                    continue
            title = data["title"]

            result = await session.execute(
                select(Scenario).where(Scenario.title == title),
            )
            existing = result.scalar_one_or_none()
            if existing is not None:
                existing.description = data.get("description", "")
                existing.content = data.get("content")
                await session.commit()
                logger.info("Updated scenario '%s' from %s", title, path.name)
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
