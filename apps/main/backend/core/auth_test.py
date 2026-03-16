from unittest.mock import patch

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from core.auth import CurrentUser, get_current_user

_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_public_key = _private_key.public_key()
_public_pem = _public_key.public_bytes(
    serialization.Encoding.PEM,
    serialization.PublicFormat.SubjectPublicKeyInfo,
)


def _make_token(
    sub: str = "user-1",
    email: str = "test@local.dev",
    roles: list[str] | None = None,
    **overrides: object,
) -> str:
    payload = {
        "sub": sub,
        "email": email,
        "realm_access": {"roles": roles or ["user"]},
        "iss": "http://localhost:8080/realms/boilerplate",
        "aud": "backend-api",
        "exp": 9999999999,
        **overrides,
    }
    return jwt.encode(payload, _private_key, algorithm="RS256")


@pytest.fixture()
def _mock_jwks() -> object:
    """Patch the JWKS fetcher to return our test public key."""
    with patch("core.auth._get_signing_key") as mock:
        mock.return_value = _public_pem
        yield mock


@pytest.mark.usefixtures("_mock_jwks")
class TestGetCurrentUser:
    async def test_valid_token_returns_user(self) -> None:
        token = _make_token(sub="u1", email="a@b.com", roles=["admin"])
        user = await get_current_user(authorization=f"Bearer {token}")
        assert isinstance(user, CurrentUser)
        assert user.id == "u1"
        assert user.email == "a@b.com"
        assert "admin" in user.roles

    async def test_missing_header_raises_401(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization=None)
        assert exc_info.value.status_code == 401

    async def test_invalid_token_raises_401(self) -> None:
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization="Bearer bad.token.here")
        assert exc_info.value.status_code == 401

    async def test_expired_token_raises_401(self) -> None:
        token = _make_token(exp=1)
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization=f"Bearer {token}")
        assert exc_info.value.status_code == 401
