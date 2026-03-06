# Keycloak Integration Design

## Goal

Dev-ready Keycloak identity provider: `docker compose up` gives working login/logout
with pre-configured users and roles. Easy to swap for an external Keycloak instance in
production.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Keycloak DB | Shared PostgreSQL | Simpler compose; separate DB on same instance |
| Frontend adapter | keycloak-js | ~30 lines init, fits ≤250 LOC rule, LLM-friendly |
| Roles | admin, user | Matches existing CurrentUser.roles stub |
| Realm config | Volume-mounted JSON | Fast iteration; bake-in later for CI |
| Login flow | Keycloak hosted page (PKCE) | No custom login form needed |

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Angular    │────▶│   Keycloak   │◀────│   FastAPI    │
│  keycloak-js │     │  :8080       │     │  PyJWT       │
│  (PKCE flow) │     │  realm:      │     │  (JWKS       │
│              │     │  boilerplate │     │   validation)│
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       │  Bearer token      │                    │
       └────────────────────┼───────────────────▶│
                            │                    │
                     ┌──────┴───────┐            │
                     │  PostgreSQL  │◀───────────┘
                     │  keycloak DB │
                     │  boilerplate │
                     └──────────────┘
```

## New Files

### keycloak/Dockerfile

```dockerfile
FROM quay.io/keycloak/keycloak:26.1

# Custom Dockerfile allows adding themes, SPIs, or extensions later
# Realm config is volume-mounted, not baked in (for dev iteration speed)

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start-dev", "--import-realm"]
```

### keycloak/init-db.sql

Creates the `keycloak` database on the shared PostgreSQL instance.

```sql
CREATE DATABASE keycloak;
CREATE USER keycloak WITH ENCRYPTED PASSWORD 'keycloak';
GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
```

### keycloak/realm-export.json

Pre-configured `boilerplate` realm containing:

**Clients:**
- `frontend-app` — Public client, PKCE, redirects to `http://localhost:4200/*`
- `backend-api` — Bearer-only client for audience validation

**Roles:**
- `admin` — full access
- `user` — standard access

**Test users (dev only):**
- `admin@local.dev` / `admin` — admin role
- `user@local.dev` / `user` — user role

**Settings:**
- Access token lifespan: 5 minutes
- SSO session idle: 30 minutes

### frontend/src/app/core/auth.interceptor.ts

Angular `HttpInterceptorFn` (~20 lines):
- Attaches `Authorization: Bearer <token>` to API requests
- Skips non-API URLs

### frontend/src/app/core/auth.guard.ts

Functional route guard (~15 lines):
- Checks `isAuthenticated()`, redirects to Keycloak login if not
- Supports role-based checks for protected routes

## Modified Files

### docker-compose.yml

Add `keycloak` service:

```yaml
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
    KEYCLOAK_ADMIN: admin
    KEYCLOAK_ADMIN_PASSWORD: admin
  ports:
    - "8080:8080"
  volumes:
    - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json:ro
  depends_on:
    db:
      condition: service_healthy
```

Mount init script on `db` service:

```yaml
db:
  volumes:
    - pgdata:/var/lib/postgresql/data
    - ./keycloak/init-db.sql:/docker-entrypoint-initdb.d/init-keycloak.sql:ro
```

Add Keycloak env vars to `api` service:

```yaml
api:
  environment:
    KEYCLOAK_URL: http://keycloak:8080
    KEYCLOAK_REALM: boilerplate
    KEYCLOAK_AUDIENCE: backend-api
```

### backend/pyproject.toml

Add dependency: `PyJWT[crypto]`

### backend/core/config.py

Add settings:

```python
keycloak_url: str = "http://keycloak:8080"
keycloak_realm: str = "boilerplate"
keycloak_audience: str = "backend-api"
```

### backend/core/auth.py

Replace stub `get_current_user()` with:

- Fetch JWKS from `{keycloak_url}/realms/{realm}/protocol/openid-connect/certs`
- Cache public keys (refresh on key-not-found)
- Decode JWT: validate signature, expiry, audience, issuer
- Extract `sub`, `email`, `realm_access.roles`
- Return `CurrentUser(id=sub, email=email, roles=roles)`
- Raise `HTTPException(401)` on failure

### frontend/package.json

Add dependency: `keycloak-js`

### frontend/src/app/features/auth/auth.service.ts

Replace stub with keycloak-js wrapper (~50 lines):

- `init()` — Initialize with `onLoad: 'check-sso'`, called via APP_INITIALIZER
- `login()` / `logout()` — Delegate to keycloak-js
- `getToken()` — Returns current access token (auto-refreshed by adapter)
- `isAuthenticated()` — Signal reflecting auth state
- `getRoles()` — Signal extracted from token

### frontend/src/app/features/auth/login.component.ts

Remove. Login is handled by Keycloak's hosted login page via redirect.

### frontend/src/app/app.config.ts

- Add `provideHttpClient(withInterceptors([authInterceptor]))`
- Add `APP_INITIALIZER` provider that calls `authService.init()`

## Production Swap Path

To point at an external Keycloak instance:

1. Set env vars: `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_AUDIENCE`
2. Remove or comment out `keycloak` service in docker-compose
3. Frontend reads Keycloak URL from environment config or build-time variable
4. No code changes required

## Implementation Order

1. keycloak/Dockerfile + init-db.sql + realm-export.json + docker-compose changes
2. backend/core/config.py + auth.py (JWT validation)
3. frontend auth.service.ts + interceptor + guard + app.config.ts
4. Remove login.component stub, update routes
5. End-to-end smoke test: login as both users, verify role extraction
