# Keycloak Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dev-ready Keycloak identity provider so `docker compose up` gives working login/logout with pre-configured users and roles, replacing all auth stubs.

**Architecture:** Custom Keycloak Dockerfile with volume-mounted realm config on shared PostgreSQL. Backend validates JWTs via JWKS. Frontend uses keycloak-js adapter integrated into the existing NgRx AuthStore.

**Tech Stack:** Keycloak 26.1, PyJWT, keycloak-js, FastAPI, Angular 21+

---

### Task 1: Keycloak Docker Infrastructure

**Files:**
- Create: `keycloak/Dockerfile`
- Create: `keycloak/init-db.sql`
- Modify: `docker-compose.yml`

**Step 1: Create the Keycloak Dockerfile**

Create `keycloak/Dockerfile`:

```dockerfile
FROM quay.io/keycloak/keycloak:26.1

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start-dev", "--import-realm"]
```

**Step 2: Create the init-db script**

Create `keycloak/init-db.sql`:

```sql
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'keycloak') THEN
    CREATE USER keycloak WITH ENCRYPTED PASSWORD 'keycloak';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
```

**Step 3: Update docker-compose.yml**

Modify `docker-compose.yml` to add the Keycloak service, mount the init script on `db`, and add Keycloak env vars to `api`:

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_DB: boilerplate
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./keycloak/init-db.sql:/docker-entrypoint-initdb.d/init-keycloak.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d boilerplate"]
      interval: 5s
      timeout: 5s
      retries: 5

  keycloak:
    build:
      context: .
      dockerfile: keycloak/Dockerfile
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://db:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: keycloak
      KC_HOSTNAME_STRICT: "false"
      KC_PROXY_HEADERS: xforwarded
      KC_HEALTH_ENABLED: "true"
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports:
      - "8080:8080"
    volumes:
      - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json:ro
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "exec 3<>/dev/tcp/localhost/8080 && echo -e 'GET /health/ready HTTP/1.1\\r\\nHost: localhost\\r\\nConnection: close\\r\\n\\r\\n' >&3 && cat <&3 | grep -q '200 OK'"]
      interval: 10s
      timeout: 5s
      retries: 12
      start_period: 30s

  api:
    build:
      context: .
      dockerfile: backend/Dockerfile
      args:
        TIER: ${TIER:-3}
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://dev:dev@db:5432/boilerplate
      ENVIRONMENT: development
      KEYCLOAK_URL: http://keycloak:8080
      KEYCLOAK_REALM: boilerplate
      KEYCLOAK_AUDIENCE: backend-api
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
      args:
        TIER: ${TIER:-3}
    ports:
      - "4200:4200"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npx ng serve --host 0.0.0.0

volumes:
  pgdata:
```

**Step 4: Verify docker compose config is valid**

Run: `cd /Users/dragan/Documents/AI-Boilerplate && docker compose config --quiet`
Expected: No errors (exit code 0)

**Step 5: Commit**

```bash
git add keycloak/Dockerfile keycloak/init-db.sql docker-compose.yml
git commit -m "feat(keycloak): add Dockerfile, init-db, and compose service"
```

---

### Task 2: Keycloak Realm Configuration

**Files:**
- Create: `keycloak/realm-export.json`

**Step 1: Create the realm export**

Create `keycloak/realm-export.json` with the `boilerplate` realm containing:

- Realm: `boilerplate`, enabled
- Clients:
  - `frontend-app`: public client, standard flow (authorization code + PKCE), redirect URIs `http://localhost:4200/*`, web origins `http://localhost:4200`, post-logout redirect `http://localhost:4200`
  - `backend-api`: bearer-only client
- Realm roles: `admin`, `user`
- Users:
  - `admin@local.dev` with password `admin`, email verified, roles: `admin`, `user`
  - `user@local.dev` with password `user`, email verified, roles: `user`
- Token settings: access token lifespan 300s (5 min), SSO session idle 1800s (30 min)

```json
{
  "realm": "boilerplate",
  "enabled": true,
  "sslRequired": "none",
  "registrationAllowed": false,
  "loginWithEmailAllowed": true,
  "duplicateEmailsAllowed": false,
  "resetPasswordAllowed": false,
  "editUsernameAllowed": false,
  "bruteForceProtected": false,
  "accessTokenLifespan": 300,
  "ssoSessionIdleTimeout": 1800,
  "roles": {
    "realm": [
      { "name": "admin", "composite": false },
      { "name": "user", "composite": false }
    ]
  },
  "clients": [
    {
      "clientId": "frontend-app",
      "enabled": true,
      "publicClient": true,
      "directAccessGrantsEnabled": false,
      "standardFlowEnabled": true,
      "implicitFlowEnabled": false,
      "redirectUris": ["http://localhost:4200/*"],
      "webOrigins": ["http://localhost:4200"],
      "attributes": {
        "post.logout.redirect.uris": "http://localhost:4200",
        "pkce.code.challenge.method": "S256"
      }
    },
    {
      "clientId": "backend-api",
      "enabled": true,
      "bearerOnly": true,
      "publicClient": false
    }
  ],
  "users": [
    {
      "username": "admin@local.dev",
      "email": "admin@local.dev",
      "emailVerified": true,
      "enabled": true,
      "credentials": [
        {
          "type": "password",
          "value": "admin",
          "temporary": false
        }
      ],
      "realmRoles": ["admin", "user"]
    },
    {
      "username": "user@local.dev",
      "email": "user@local.dev",
      "emailVerified": true,
      "enabled": true,
      "credentials": [
        {
          "type": "password",
          "value": "user",
          "temporary": false
        }
      ],
      "realmRoles": ["user"]
    }
  ]
}
```

**Step 2: Verify Keycloak boots with the realm**

Run: `cd /Users/dragan/Documents/AI-Boilerplate && docker compose up keycloak -d --build && sleep 40 && docker compose logs keycloak 2>&1 | tail -20`
Expected: Logs show `Running the server in development mode` and realm import messages. No errors.

**Step 3: Verify realm exists via API**

Run: `curl -s http://localhost:8080/realms/boilerplate/.well-known/openid-configuration | python3 -m json.tool | head -10`
Expected: JSON with `issuer`, `authorization_endpoint`, `token_endpoint` fields pointing to `/realms/boilerplate`.

**Step 4: Commit**

```bash
git add keycloak/realm-export.json
git commit -m "feat(keycloak): add boilerplate realm with clients, roles, and test users"
```

---

### Task 3: Backend JWT Validation

**Files:**
- Modify: `backend/pyproject.toml:6-15` (add PyJWT dependency)
- Modify: `backend/core/config.py:4-14` (add Keycloak settings)
- Modify: `backend/core/auth.py` (replace stub with JWT validation)
- Create: `backend/core/auth_test.py`

**Step 1: Add PyJWT dependency**

In `backend/pyproject.toml`, add `"PyJWT[crypto]>=2.9.0"` to the `dependencies` list.

**Step 2: Install the new dependency**

Run: `cd /Users/dragan/Documents/AI-Boilerplate/backend && pip install "PyJWT[crypto]>=2.9.0"`
Expected: Successfully installed PyJWT and cryptography.

**Step 3: Add Keycloak settings to config**

Modify `backend/core/config.py` — add three fields to the `Settings` class after line 8:

```python
keycloak_url: str = "http://localhost:8080"
keycloak_realm: str = "boilerplate"
keycloak_audience: str = "backend-api"
```

**Step 4: Write the failing test**

Create `backend/core/auth_test.py`:

```python
from unittest.mock import AsyncMock, patch

import jwt
import pytest
from fastapi import HTTPException

from core.auth import CurrentUser, get_current_user

# Generate a test RSA key pair
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

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
        token = _make_token(exp=1)  # expired in 1970
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(authorization=f"Bearer {token}")
        assert exc_info.value.status_code == 401
```

**Step 5: Run test to verify it fails**

Run: `cd /Users/dragan/Documents/AI-Boilerplate/backend && python -m pytest core/auth_test.py -v`
Expected: FAIL — `get_current_user` doesn't accept `authorization` parameter yet.

**Step 6: Implement JWT validation in auth.py**

Replace the contents of `backend/core/auth.py`:

```python
from dataclasses import dataclass
from typing import Annotated

import jwt
import httpx
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
    # Use the first RSA key
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
            issuer=(
                f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
            ),
        )
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    roles = payload.get("realm_access", {}).get("roles", [])

    return CurrentUser(
        id=payload["sub"],
        email=payload.get("email", ""),
        roles=roles,
    )
```

**Step 7: Run tests to verify they pass**

Run: `cd /Users/dragan/Documents/AI-Boilerplate/backend && python -m pytest core/auth_test.py -v`
Expected: All 4 tests PASS.

**Step 8: Commit**

```bash
git add backend/pyproject.toml backend/core/config.py backend/core/auth.py backend/core/auth_test.py
git commit -m "feat(auth): replace stub with Keycloak JWT validation"
```

---

### Task 4: Frontend Keycloak Integration

**Files:**
- Modify: `frontend/package.json` (add keycloak-js)
- Modify: `frontend/src/app/core/environment.ts` (add Keycloak config)
- Modify: `frontend/src/app/shared/auth/auth.store.ts` (replace stub with keycloak-js)
- Modify: `frontend/src/app/shared/auth/auth.guard.ts` (redirect via Keycloak)
- Modify: `frontend/src/app/shared/auth/auth.interceptor.ts` (get token from Keycloak)
- Modify: `frontend/src/app/app.config.ts` (add APP_INITIALIZER)

**Step 1: Install keycloak-js**

Run: `cd /Users/dragan/Documents/AI-Boilerplate/frontend && npm install keycloak-js`
Expected: keycloak-js added to package.json dependencies.

**Step 2: Add Keycloak config to environment**

Modify `frontend/src/app/core/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000',
  keycloak: {
    url: 'http://localhost:8080',
    realm: 'boilerplate',
    clientId: 'frontend-app',
  },
};
```

**Step 3: Replace AuthStore with keycloak-js integration**

Replace `frontend/src/app/shared/auth/auth.store.ts`:

```typescript
import { computed, Injectable, signal } from '@angular/core';
import Keycloak from 'keycloak-js';
import { environment } from '../../core/environment';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly keycloak = new Keycloak({
    url: environment.keycloak.url,
    realm: environment.keycloak.realm,
    clientId: environment.keycloak.clientId,
  });

  private readonly _user = signal<AuthUser | null>(null);
  private readonly _token = signal<string | null>(null);

  readonly user = this._user.asReadonly();
  readonly token = this._token.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  async init(): Promise<void> {
    const authenticated = await this.keycloak.init({
      onLoad: 'check-sso',
      silentCheckSsoRedirectUri:
        window.location.origin + '/assets/silent-check-sso.html',
      pkceMethod: 'S256',
    });

    if (authenticated) {
      this.updateUserFromToken();
    }

    this.keycloak.onTokenExpired = () => {
      void this.keycloak.updateToken(30).then((refreshed) => {
        if (refreshed) {
          this.updateUserFromToken();
        }
      });
    };
  }

  login(): void {
    void this.keycloak.login();
  }

  logout(): void {
    void this.keycloak.logout({ redirectUri: window.location.origin });
  }

  private updateUserFromToken(): void {
    const parsed = this.keycloak.tokenParsed;
    if (parsed) {
      this._user.set({
        id: parsed['sub'] ?? '',
        email: parsed['email'] ?? '',
        roles: parsed['realm_access']?.['roles'] ?? [],
      });
      this._token.set(this.keycloak.token ?? null);
    }
  }
}
```

**Step 4: Update auth guard to use Keycloak login**

Replace `frontend/src/app/shared/auth/auth.guard.ts`:

```typescript
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);

  if (authStore.isAuthenticated()) {
    return true;
  }

  authStore.login();
  return false;
};
```

**Step 5: Update interceptor (no changes needed)**

The existing `auth.interceptor.ts` already reads `authStore.token()` and attaches the Bearer header. It works as-is with the new AuthStore — no changes needed. Verify it reads correctly by reviewing `frontend/src/app/shared/auth/auth.interceptor.ts`.

**Step 6: Add APP_INITIALIZER to app.config.ts**

Replace `frontend/src/app/app.config.ts`:

```typescript
import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/error-handler';
import { authInterceptor } from './shared/auth/auth.interceptor';
import { AuthStore } from './shared/auth/auth.store';

function initializeKeycloak(authStore: AuthStore): () => Promise<void> {
  return () => authStore.init();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeKeycloak,
      deps: [AuthStore],
      multi: true,
    },
  ],
};
```

**Step 7: Create silent SSO check page**

Create `frontend/src/assets/silent-check-sso.html`:

```html
<!doctype html>
<html>
  <body>
    <script>
      parent.postMessage(location.href, location.origin);
    </script>
  </body>
</html>
```

**Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json \
  frontend/src/app/core/environment.ts \
  frontend/src/app/shared/auth/auth.store.ts \
  frontend/src/app/shared/auth/auth.guard.ts \
  frontend/src/app/app.config.ts \
  frontend/src/assets/silent-check-sso.html
git commit -m "feat(auth): integrate keycloak-js adapter into Angular frontend"
```

---

### Task 5: Remove Login Stub & Update Routes

**Files:**
- Delete: `frontend/src/app/features/auth/login.component.ts`
- Delete: `frontend/src/app/features/auth/login.component.spec.ts`
- Modify: `frontend/src/app/features/auth/auth.routes.ts`
- Modify: `frontend/src/app/app.routes.ts:28-32`

**Step 1: Update auth routes**

Replace `frontend/src/app/features/auth/auth.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [];
```

Login is now handled by Keycloak redirect (via `authGuard` calling `authStore.login()`), so no login route is needed. Keep the empty routes file so the lazy-loaded `auth` path still resolves.

**Step 2: Remove login component files**

Run: `rm frontend/src/app/features/auth/login.component.ts frontend/src/app/features/auth/login.component.spec.ts`

**Step 3: Remove the register route from app.routes.ts**

Registration is handled by Keycloak (if enabled in realm settings). Remove the `register` route from `frontend/src/app/app.routes.ts:33-38`. The resulting routes file:

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './shared/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./features/landing/landing.routes').then(
        (m) => m.LANDING_ROUTES
      ),
  },
  {
    path: 'dashboard',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(
        (m) => m.DASHBOARD_ROUTES
      ),
    canActivate: [authGuard],
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./features/user-profile/user-profile.routes').then(
        (m) => m.USER_PROFILE_ROUTES
      ),
    canActivate: [authGuard],
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
];
```

**Step 4: Verify frontend compiles**

Run: `cd /Users/dragan/Documents/AI-Boilerplate/frontend && npx ng build --configuration development 2>&1 | tail -5`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add -u frontend/src/app/features/auth/ frontend/src/app/app.routes.ts
git commit -m "refactor(auth): remove login stub, Keycloak handles login flow"
```

---

### Task 6: End-to-End Smoke Test

**Files:** None (manual verification)

**Step 1: Start all services**

Run: `cd /Users/dragan/Documents/AI-Boilerplate && docker compose up --build -d`
Expected: All 4 services start (db, keycloak, api, frontend).

**Step 2: Wait for Keycloak to be ready**

Run: `docker compose exec keycloak /opt/keycloak/bin/kc.sh show-config 2>/dev/null; curl -sf http://localhost:8080/realms/boilerplate/.well-known/openid-configuration | python3 -m json.tool | head -5`
Expected: OIDC discovery JSON with correct issuer.

**Step 3: Obtain a token via direct grant (API test)**

Run:
```bash
curl -s -X POST http://localhost:8080/realms/boilerplate/protocol/openid-connect/token \
  -d "client_id=frontend-app" \
  -d "username=admin@local.dev" \
  -d "password=admin" \
  -d "grant_type=password" | python3 -m json.tool | head -5
```
Expected: JSON with `access_token`, `token_type: "Bearer"`.

Note: Direct access grants need to be temporarily enabled on `frontend-app` for this CLI test. Alternatively, decode a token obtained through the browser flow.

**Step 4: Call a protected backend endpoint with the token**

Run:
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/realms/boilerplate/protocol/openid-connect/token \
  -d "client_id=frontend-app" \
  -d "username=admin@local.dev" \
  -d "password=admin" \
  -d "grant_type=password" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/users | head -20
```
Expected: API responds with user data (200), not 401.

**Step 5: Test 401 with no token**

Run: `curl -s -w "%{http_code}" http://localhost:8000/api/users`
Expected: Response ends with `401`.

**Step 6: Verify frontend loads and redirects to Keycloak**

Open `http://localhost:4200/dashboard` in a browser.
Expected: Redirected to Keycloak login page at `localhost:8080`. After logging in as `admin@local.dev` / `admin`, redirected back to dashboard.

**Step 7: Commit (if any test-related fixes were needed)**

```bash
git add -A
git commit -m "test: verify end-to-end Keycloak authentication flow"
```
