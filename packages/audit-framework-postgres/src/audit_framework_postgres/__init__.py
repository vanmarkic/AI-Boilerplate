"""audit-framework-postgres — append-only PostgreSQL AuditStore.

The authoritative, queryable system of record for the audit log (as opposed to
the best-effort ``ExternalSink`` fan-out). Ships the ``audit_log`` schema, a
compact ``LISTEN/NOTIFY`` trigger, and append-only guards.
"""

from audit_framework_postgres.plugin import register
from audit_framework_postgres.schema import NOTIFY_CHANNEL, apply_schema, schema_sql
from audit_framework_postgres.store import Executor, PostgresAuditStore

__version__ = "0.1.0"

__all__ = [
    "PostgresAuditStore",
    "Executor",
    "schema_sql",
    "apply_schema",
    "NOTIFY_CHANNEL",
    "register",
    "__version__",
]
