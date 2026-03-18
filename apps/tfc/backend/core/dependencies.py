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


async def get_decision_service(
    session: AsyncSession = Depends(get_session),
) -> "DecisionService":  # noqa: F821
    """Wire up the DecisionService with its repository."""
    from features.decision.decision_repository import DecisionRepository
    from features.decision.decision_service import DecisionService

    repository = DecisionRepository(session)
    return DecisionService(repository)


async def get_audit_service(
    session: AsyncSession = Depends(get_session),
) -> "AuditService":  # noqa: F821
    """Wire up the AuditService with its repository."""
    from features.audit.audit_repository import AuditRepository
    from features.audit.audit_service import AuditService

    repository = AuditRepository(session)
    return AuditService(repository)


async def get_domain_config_service(
    session: AsyncSession = Depends(get_session),
) -> "DomainConfigService":  # noqa: F821
    """Wire up the DomainConfigService with its repository."""
    from features.domain_config.domain_config_repository import (
        DomainConfigRepository,
    )
    from features.domain_config.domain_config_service import (
        DomainConfigService,
    )

    repository = DomainConfigRepository(session)
    return DomainConfigService(repository)
