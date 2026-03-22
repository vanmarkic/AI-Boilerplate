"""Idempotent scenario and domain-config seeder.

Reads JSON files from seeds/ and upserts them into the database.

- Scenario seeds: ``*_tutorial.json``, ``silent_wake.json``, etc. (files that
  contain a ``content`` key) → ``tfc_scenarios``
- Domain-config seeds: ``*_domain_config.json`` → ``tfc_domain_configs``

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
from features.domain_config.domain_config_model import DomainConfig
from features.domain_config.domain_config_schema import CreateDomainConfigRequest
from features.scenario.scenario_content import ScenarioContent
from features.scenario.scenario_model import Scenario

logger = logging.getLogger(__name__)
SEEDS_DIR = Path(__file__).parent / "seeds"

DOMAIN_CONFIG_GLOB = "*_domain_config.json"


async def seed_domain_configs() -> None:
    """Load domain-config seed files and upsert by slug."""
    if not SEEDS_DIR.is_dir():
        return

    seed_files = sorted(SEEDS_DIR.glob(DOMAIN_CONFIG_GLOB))
    if not seed_files:
        return

    async with async_session_factory() as session:
        for path in seed_files:
            data = json.loads(path.read_text())
            try:
                payload = CreateDomainConfigRequest.model_validate(data)
            except ValidationError as exc:
                logger.error(
                    "Domain-config seed '%s' invalid — skipping: %s",
                    path.name,
                    exc,
                )
                continue

            slug = payload.slug
            result = await session.execute(
                select(DomainConfig).where(DomainConfig.slug == slug),
            )
            existing = result.scalar_one_or_none()

            if existing is not None:
                existing.name = payload.name
                existing.description = payload.description
                existing.terminology = payload.terminology.model_dump()
                existing.theme = payload.theme.model_dump()
                existing.roles = [r.model_dump() for r in payload.roles]
                existing.severity_levels = [
                    s.model_dump() for s in payload.severity_levels
                ]
                existing.systems = [s.model_dump() for s in payload.systems]
                existing.warfare_domains = [
                    w.model_dump() for w in payload.warfare_domains
                ]
                existing.blue_card_catalog = [
                    c.model_dump() for c in payload.blue_card_catalog
                ]
                await session.commit()
                logger.info(
                    "Updated domain config '%s' from %s", slug, path.name,
                )
                continue

            entity = DomainConfig(
                slug=slug,
                name=payload.name,
                description=payload.description,
                terminology=payload.terminology.model_dump(),
                theme=payload.theme.model_dump(),
                roles=[r.model_dump() for r in payload.roles],
                severity_levels=[s.model_dump() for s in payload.severity_levels],
                systems=[s.model_dump() for s in payload.systems],
                warfare_domains=[w.model_dump() for w in payload.warfare_domains],
                blue_card_catalog=[c.model_dump() for c in payload.blue_card_catalog],
            )
            session.add(entity)
            await session.commit()
            logger.info("Seeded domain config '%s' from %s", slug, path.name)


async def seed_scenarios() -> None:
    """Load scenario seed files and upsert by title."""
    if not SEEDS_DIR.is_dir():
        logger.info("No seeds/ directory found — skipping.")
        return

    # Exclude domain-config files — they are handled by seed_domain_configs
    all_json = set(SEEDS_DIR.glob("*.json"))
    dc_files = set(SEEDS_DIR.glob(DOMAIN_CONFIG_GLOB))
    seed_files = sorted(all_json - dc_files)
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


async def _run_all() -> None:
    await seed_domain_configs()
    await seed_scenarios()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
    asyncio.run(_run_all())


if __name__ == "__main__":
    main()
