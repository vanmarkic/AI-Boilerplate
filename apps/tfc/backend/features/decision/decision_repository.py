from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.decision.decision_model import Decision, DecisionResponseRecord


class DecisionRepository(CrudRepository[Decision]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, Decision)

    async def list_by_exercise(self, exercise_id: int) -> list[Decision]:
        """List all decisions for an exercise."""
        stmt = select(Decision).where(
            Decision.exercise_id == exercise_id,
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_open_by_exercise(
        self, exercise_id: int,
    ) -> list[Decision]:
        """List only open decisions for an exercise."""
        stmt = select(Decision).where(
            Decision.exercise_id == exercise_id,
            Decision.status == "open",
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_by_exercise_and_status(
        self, exercise_id: int, status: str,
    ) -> list[Decision]:
        """List decisions filtered by exercise and status."""
        stmt = select(Decision).where(
            Decision.exercise_id == exercise_id,
            Decision.status == status,
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def add_response(
        self, decision_id: int, response: DecisionResponseRecord,
    ) -> DecisionResponseRecord:
        """Create a response record for a decision."""
        response.decision_id = decision_id
        self.session.add(response)
        await self.session.flush()
        await self.session.refresh(response)
        return response

    async def get_responses(
        self, decision_id: int,
    ) -> list[DecisionResponseRecord]:
        """List all responses for a decision."""
        stmt = select(DecisionResponseRecord).where(
            DecisionResponseRecord.decision_id == decision_id,
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_responses(self, decision_id: int) -> int:
        """Count responses for a decision."""
        responses = await self.get_responses(decision_id)
        return len(responses)
