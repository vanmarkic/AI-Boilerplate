"""Move a case through its lifecycle.

Extracted from the router the moment the architecture linter caught the router
calling a domain policy directly. Deciding whether a transition is legal is
business logic, and business logic does not live at the HTTP edge.
"""

from uuid import UUID

from application.case_management_port import CaseManagementPort
from application.case_repository_port import CaseRepositoryPort
from application.clock_port import ClockPort
from domain.case_entity import Case, CaseStatus
from domain.case_policy import transition
from domain.soc_error import IntegrationError, UnknownEntityError


class TransitionCaseUseCase:
    """Applies a case state change, then mirrors it outward."""

    def __init__(
        self,
        *,
        cases: CaseRepositoryPort,
        case_manager: CaseManagementPort,
        clock: ClockPort,
    ) -> None:
        self._cases = cases
        self._case_manager = case_manager
        self._clock = clock

    async def execute(self, case_id: UUID, target: CaseStatus) -> Case:
        """Move a case to a new status, or raise if that is illegal.

        Our own state changes first. Mirroring outward is best-effort: a case
        manager outage must not leave our record disagreeing with the decision
        an analyst already made.
        """
        case = await self._cases.get(case_id)
        if case is None:
            raise UnknownEntityError(f"unknown case {case_id}")

        moved = await self._cases.save(transition(case, target, self._clock.now()))

        if moved.external_ref is not None:
            try:
                await self._case_manager.transition(moved.external_ref, target)
            except IntegrationError:
                return moved
        return moved
