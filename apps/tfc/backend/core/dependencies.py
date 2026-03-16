"""Dependency injection factories for feature services.

Each factory wires Session -> Repository -> Service.
Uses lazy imports (inside function body) so features
don't break at module import time.
"""
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session


async def get_exercise_service(
    session: AsyncSession = Depends(get_session),
) -> "ExerciseService":  # noqa: F821
    """Wire up the ExerciseService with its repository."""
    from features.exercise.exercise_repository import ExerciseRepository
    from features.exercise.exercise_service import ExerciseService

    repository = ExerciseRepository(session)
    return ExerciseService(repository)


async def get_scenario_service(
    session: AsyncSession = Depends(get_session),
) -> "ScenarioService":  # noqa: F821
    """Wire up the ScenarioService with its repository."""
    from features.scenario.scenario_repository import ScenarioRepository
    from features.scenario.scenario_service import ScenarioService

    repository = ScenarioRepository(session)
    return ScenarioService(repository)
