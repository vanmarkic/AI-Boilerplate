from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.exercise.exercise_model import Exercise


class ExerciseRepository(CrudRepository[Exercise]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Exercise)

    async def list_by_phase(self, phase: str) -> list[Exercise]:
        """List exercises filtered by phase."""
        stmt = select(Exercise).where(Exercise.phase == phase)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_by_session_code(
        self,
        session_code: str,
    ) -> Exercise | None:
        """Look up an exercise by its session code."""
        stmt = select(Exercise).where(
            Exercise.session_code == session_code,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()
