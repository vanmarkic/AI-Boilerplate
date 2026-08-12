"""The per-request storage handle, and how one is obtained.

``Storage`` is what a repository is constructed around. It is deliberately an
implementation detail of the composition root: it appears in no port signature,
so none of the persistence work below changes the core's interfaces.

Its two shapes have the same lifetime story — long-lived storage, short-lived
handle:

===========  ==========================  ==========================
provider     long-lived                  per-request handle
===========  ==========================  ==========================
memory       ``MemoryStore``             the same store, shared
postgres     engine / sessionmaker       an ``AsyncSession``
===========  ==========================  ==========================
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from adapters.memory.memory_store import MemoryStore
from core.config import settings
from core.database import async_session_factory

MEMORY = "memory"
POSTGRES = "postgres"

Storage = MemoryStore | AsyncSession

# The one long-lived in-process store. Shared on purpose: in memory mode it is
# the database, so its lifetime is the process, exactly as a real one outlives
# any single request.
_MEMORY_STORE = MemoryStore()


def memory_store() -> MemoryStore:
    """Return the process-wide in-memory store."""
    return _MEMORY_STORE


async def get_storage() -> AsyncGenerator[Storage, None]:
    """Yield the storage handle for one request.

    In memory mode this hands back the shared store and **never touches a
    database** — which is what keeps the service able to boot and serve with
    nothing else deployed. Only the relational provider opens a connection.
    """
    if settings.repository_provider == MEMORY:
        yield _MEMORY_STORE
        return

    async with async_session_factory() as session:
        async with session.begin():
            yield session
