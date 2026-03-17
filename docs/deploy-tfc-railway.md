# Deploy TFC to Railway

This guide walks through deploying the TFC (Training Flow Control) app to [Railway](https://railway.app).

## Architecture on Railway

Three services in one Railway project:

| Service         | Source                        | Port | Notes                       |
|-----------------|-------------------------------|------|-----------------------------|
| **tfc-api**     | `apps/tfc/backend/`           | auto | FastAPI + Alembic migrations |
| **tfc-frontend**| `apps/tfc/frontend/`          | 80   | Angular (nginx)             |
| **Postgres**    | Railway managed plugin        | auto | PostgreSQL 17               |

## Prerequisites

- A [Railway](https://railway.app) account
- The [Railway CLI](https://docs.railway.app/guides/cli) installed (`npm i -g @railway/cli`)

## Setup Steps

### 1. Create a Railway project

```bash
railway login
railway init        # creates a new project
railway link        # links this repo
```

### 2. Add a PostgreSQL database

In the Railway dashboard, click **+ New** → **Database** → **PostgreSQL**.

Railway will provide a `DATABASE_URL` variable automatically.

### 3. Create the API service

```bash
railway service create tfc-api
```

**Configure in the Railway dashboard:**

- **Settings → Build**: set Dockerfile path to `apps/tfc/backend/Dockerfile.railway`
- **Settings → Build**: set root directory to `/` (monorepo root, since Dockerfile uses `COPY apps/tfc/...`)

**Environment variables** (Settings → Variables):

| Variable          | Value                                              |
|-------------------|----------------------------------------------------|
| `DATABASE_URL`    | `${{Postgres.DATABASE_URL}}` (reference)           |
| `ENVIRONMENT`     | `production`                                       |
| `DEBUG`           | `false`                                            |
| `ALLOWED_ORIGINS` | `https://<tfc-frontend-domain>.railway.app`        |

**Start command** (Settings → Deploy):
```
alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT
```

Or use the Railway config file: copy `infra/railway/tfc-api.toml` to `railway.toml` in the service config.

### 4. Create the frontend service

```bash
railway service create tfc-frontend
```

**Configure in the Railway dashboard:**

- **Settings → Build**: set Dockerfile path to `apps/tfc/frontend/Dockerfile.railway`
- **Settings → Build**: set root directory to `/` (monorepo root)

**Environment variables:**

| Variable       | Value                                           |
|----------------|-------------------------------------------------|
| `API_BASE_URL` | `https://<tfc-api-domain>.railway.app`          |
| `WS_BASE_URL`  | `wss://<tfc-api-domain>.railway.app`            |

### 5. Generate public domains

In the Railway dashboard, go to each service → **Settings → Networking** → **Generate Domain**.

Then update the env vars to use the actual domains:
- Set `ALLOWED_ORIGINS` on tfc-api to the frontend's public URL
- Set `API_BASE_URL` / `WS_BASE_URL` on tfc-frontend to the API's public URL

### 6. Deploy

Push to your branch — Railway auto-deploys on push if connected to GitHub.

Or trigger manually:
```bash
railway up
```

## How It Works

### Backend
- `Dockerfile.railway` builds the FastAPI app with uv
- On start, `alembic upgrade head` runs migrations, then uvicorn starts
- `DATABASE_URL` is auto-normalized: `postgresql://` → `postgresql+asyncpg://`
- CORS origins are configured via `ALLOWED_ORIGINS` (comma-separated)

### Frontend
- `Dockerfile.railway` is a multi-stage build: Angular production build → nginx
- `entrypoint.sh` injects `API_BASE_URL` and `WS_BASE_URL` into the HTML at container start
- The Angular app reads `window.__env` for runtime config, falling back to localhost defaults
- nginx handles SPA routing (all paths → `index.html`)

## Local Testing

Test the production builds locally with Docker:

```bash
# Build and run backend
docker build -f apps/tfc/backend/Dockerfile.railway -t tfc-api .
docker run -p 8001:8001 -e DATABASE_URL=postgresql+asyncpg://dev:dev@host.docker.internal:5433/tfc tfc-api

# Build and run frontend
docker build -f apps/tfc/frontend/Dockerfile.railway -t tfc-frontend .
docker run -p 8080:80 -e API_BASE_URL=http://localhost:8001 -e WS_BASE_URL=ws://localhost:8001 tfc-frontend
```
