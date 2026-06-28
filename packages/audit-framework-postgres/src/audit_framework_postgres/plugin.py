"""Plugin registration for the PostgreSQL audit store."""

from __future__ import annotations

from typing import Any

from audit_framework_postgres.store import PostgresAuditStore

__all__ = ["register"]


def register(registry: Any) -> None:
    """Register :class:`PostgresAuditStore` as the ``postgres`` audit store."""
    registry.register("audit_store", "postgres", PostgresAuditStore)
