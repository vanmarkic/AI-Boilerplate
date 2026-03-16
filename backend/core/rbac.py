"""RBAC middleware — enforces database-driven route-level authorization.

Checks the authenticated user's Keycloak roles against the role_permissions
table. Public routes are skipped via an allowlist. Permissions are cached
in-process with a configurable TTL to avoid per-request DB queries.
"""

import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.database import async_session_factory
from core.rbac_model import RolePermission

PUBLIC_PATH_PREFIXES: tuple[str, ...] = (
    "/docs",
    "/openapi.json",
    "/redoc",
)

PUBLIC_EXACT_PATHS: frozenset[str] = frozenset({
    "/api/health",
    "/api/canary/ping",
    "/api/users",  # registration endpoint (no auth required)
    "/api/events",  # SSE channel listing (no auth required)
})

PUBLIC_API_PREFIXES: tuple[str, ...] = (
    "/api/events/",  # SSE subscriptions (intentionally unauthenticated)
)

_DEFAULT_TTL: float = 60.0


@dataclass(frozen=True)
class PermissionRule:
    """A single route permission entry."""

    route_pattern: str
    method: str


# Module-level cache
_cache: dict[str, list[PermissionRule]] = {}
_cache_loaded_at: float = 0.0
_cache_ttl: float = _DEFAULT_TTL


def _match_pattern(pattern: str, path: str) -> bool:
    """Match a route pattern against a request path.

    Supports:
      - ``**`` matches any number of path segments (including zero)
      - ``*``  matches exactly one path segment
      - literal segments must match exactly
    """
    pattern_parts = [p for p in pattern.split("/") if p]
    path_parts = [p for p in path.split("/") if p]
    return _match_parts(pattern_parts, 0, path_parts, 0)


def _match_parts(
    pat: list[str], pi: int, path: list[str], xi: int
) -> bool:
    """Recursive segment matcher for route patterns."""
    while pi < len(pat) and xi < len(path):
        seg = pat[pi]
        if seg == "**":
            # ** can match zero or more remaining segments
            for skip in range(xi, len(path) + 1):
                if _match_parts(pat, pi + 1, path, skip):
                    return True
            return False
        if seg == "*":
            # * matches exactly one segment
            pi += 1
            xi += 1
            continue
        if seg != path[xi]:
            return False
        pi += 1
        xi += 1

    # Skip trailing ** patterns (they match zero segments)
    while pi < len(pat) and pat[pi] == "**":
        pi += 1

    return pi == len(pat) and xi == len(path)


def _check_permission(
    roles: list[str],
    request_path: str,
    request_method: str,
) -> bool:
    """Check whether any of the user's roles grant access."""
    for role in roles:
        for rule in _cache.get(role, []):
            method_ok = rule.method == "*" or rule.method == request_method
            if method_ok and _match_pattern(rule.route_pattern, request_path):
                return True
    return False


async def _load_permissions() -> dict[str, list[PermissionRule]]:
    """Load all permissions from DB, grouped by role."""
    async with async_session_factory() as session:
        result = await session.execute(select(RolePermission))
        permissions = result.scalars().all()

    grouped: dict[str, list[PermissionRule]] = {}
    for perm in permissions:
        grouped.setdefault(perm.role, []).append(
            PermissionRule(
                route_pattern=perm.route_pattern,
                method=perm.method,
            )
        )
    return grouped


async def get_permissions_cache() -> dict[str, list[PermissionRule]]:
    """Return the cached permission matrix, reloading if stale."""
    global _cache, _cache_loaded_at
    now = time.monotonic()
    if not _cache or (now - _cache_loaded_at) > _cache_ttl:
        _cache = await _load_permissions()
        _cache_loaded_at = now
    return _cache


def clear_permissions_cache() -> None:
    """Force-clear the in-memory permission cache."""
    global _cache, _cache_loaded_at
    _cache = {}
    _cache_loaded_at = 0.0


class RBACMiddleware(BaseHTTPMiddleware):
    """Starlette middleware enforcing DB-driven RBAC on /api/* routes."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        path = request.url.path
        method = request.method

        # Skip CORS preflight
        if method == "OPTIONS":
            return await call_next(request)

        # Skip non-API routes (frontend static files, etc.)
        if not path.startswith("/api/"):
            # Also skip doc routes that don't start with /api/
            return await call_next(request)

        # Skip public exact paths
        if path in PUBLIC_EXACT_PATHS:
            return await call_next(request)

        # Skip public API prefixes (e.g. SSE)
        for prefix in PUBLIC_API_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        # Skip public prefix paths (docs, etc.)
        for prefix in PUBLIC_PATH_PREFIXES:
            if path.startswith(prefix):
                return await call_next(request)

        # Parse JWT roles
        from core.auth import parse_jwt_roles

        auth_header = request.headers.get("authorization")
        roles = await parse_jwt_roles(auth_header)

        if roles is None:
            return JSONResponse(
                status_code=401,
                content={"detail": "Missing or invalid token"},
            )

        # Ensure cache is loaded
        await get_permissions_cache()

        # Check permissions
        if _check_permission(roles, path, method):
            return await call_next(request)

        return JSONResponse(
            status_code=403,
            content={"detail": "Insufficient permissions"},
        )
