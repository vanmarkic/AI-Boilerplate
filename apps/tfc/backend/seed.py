"""Seed the database with sample scenario data."""
import asyncio

from core.database import async_session_factory
from features.scenario.scenario_model import Scenario
from features.scenario.sample_er_scenario import ER_SCENARIO_CONTENT


async def seed() -> None:
    async with async_session_factory() as session:
        result = await session.execute(
            Scenario.__table__.select().limit(1)
        )
        if result.first() is not None:
            print("Database already seeded, skipping.")
            return

        scenario = Scenario(
            title="Emergency Response — Hospital MCI",
            description="Mass casualty incident triggered by industrial explosion",
            content=ER_SCENARIO_CONTENT,
            version=1,
        )
        session.add(scenario)
        await session.commit()
        print(f"Seeded scenario: {scenario.title}")


if __name__ == "__main__":
    asyncio.run(seed())
