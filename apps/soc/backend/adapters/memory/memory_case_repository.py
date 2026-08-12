"""In-memory case storage."""

from uuid import UUID

from domain.case_entity import TERMINAL_STATUSES, Case


class MemoryCaseRepository:
    """Keys cases by id."""

    def __init__(self) -> None:
        self._cases: dict[UUID, Case] = {}

    async def save(self, case: Case) -> Case:
        """Insert or replace by id."""
        self._cases[case.case_id] = case
        return case

    async def get(self, case_id: UUID) -> Case | None:
        """Return a case, or None."""
        return self._cases.get(case_id)

    async def find_open_by_correlation_key(self, correlation_key: str) -> Case | None:
        """Return the open case for a correlation key, if any."""
        for case in self._cases.values():
            if case.correlation_key != correlation_key:
                continue
            if case.status in TERMINAL_STATUSES:
                continue
            return case
        return None

    async def list_open(self, *, limit: int, offset: int = 0) -> tuple[Case, ...]:
        """Return a page of open cases, newest first."""
        open_cases = [c for c in self._cases.values() if c.status not in TERMINAL_STATUSES]
        open_cases.sort(key=lambda c: (c.opened_at, str(c.case_id)), reverse=True)
        return tuple(open_cases[offset : offset + limit])
