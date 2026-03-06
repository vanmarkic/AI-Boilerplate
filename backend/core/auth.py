from dataclasses import dataclass
from typing import Annotated

import httpx
import jwt
from fastapi import Header, HTTPException

from core.config import settings

_jwks_cache: bytes | None = None


@dataclass(frozen=True)
class CurrentUser:
    """Represents the authenticated user extracted from a JWT."""

    id: str
    email: str
    roles: list[str]


async def _get_signing_key() -> bytes:
    """Fetch and cache the Keycloak realm's public key (JWKS)."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    certs_url = (
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        "/protocol/openid-connect/certs"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(certs_url)
        resp.raise_for_status()

    jwks = resp.json()
    key_data = jwks["keys"][0]
    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
    from cryptography.hazmat.primitives import serialization

    _jwks_cache = public_key.public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return _jwks_cache


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    """Validate JWT from Authorization header and return the current user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    token = authorization.removeprefix("Bearer ")

    try:
        signing_key = await _get_signing_key()
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=settings.keycloak_audience,
            issuer=f"{settings.keycloak_url}/realms/{settings.keycloak_realm}",
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    roles = payload.get("realm_access", {}).get("roles", [])

    return CurrentUser(
        id=payload["sub"],
        email=payload.get("email", ""),
        roles=roles,
    )
