"""In-memory playbook run storage.

The dict keyed by idempotency key is what supplies the guarantee the
orchestrator does not: the same intended action can only be recorded once.
"""

from uuid import UUID

from adapters.memory.memory_store import MemoryStore
from domain.playbook_entity import PlaybookRun


class MemoryPlaybookRunRepository:
    """Keys runs by id, with a secondary index on the idempotency key."""

    def __init__(self, store: MemoryStore) -> None:
        self._store = store

    async def save(self, run: PlaybookRun) -> PlaybookRun:
        """Insert or replace by id."""
        self._store.playbook_runs[run.run_id] = run
        return run

    async def get(self, run_id: UUID) -> PlaybookRun | None:
        """Return a run, or None."""
        return self._store.playbook_runs.get(run_id)

    async def find_by_idempotency_key(self, key: str) -> PlaybookRun | None:
        """Return the run already recorded for an intended action, if any."""
        for run in self._store.playbook_runs.values():
            if run.idempotency_key == key:
                return run
        return None

    async def list_for_case(self, case_id: UUID) -> tuple[PlaybookRun, ...]:
        """Return every run associated with a case."""
        runs = [r for r in self._store.playbook_runs.values() if r.case_id == case_id]
        runs.sort(key=lambda r: (r.started_at, str(r.run_id)))
        return tuple(runs)
