# Kubernetes Deployment Design

**Date:** 2026-04-01
**Status:** Review
**Scope:** Migrate entire stack from Docker Compose to Kubernetes with Flux GitOps

## Goal

Deploy the full AI-Boilerplate stack as Kubernetes pods on self-managed clusters, with cloud-agnostic manifests and Flux CD for GitOps delivery.

## What Gets Deployed

| Service | Image | Port | Stateful? |
|---------|-------|------|-----------|
| PostgreSQL 17 | Bitnami Helm chart | 5432 | Yes (PVC) |
| Keycloak 26.1 | `quay.io/keycloak/keycloak:26.1` | 8080 | No (DB-backed) |
| Main backend (FastAPI) | `registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:*-main-backend` | 8000 | No |
| Main frontend (Angular) | `registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:*-main-frontend` | 80 | No |
| TFC backend (FastAPI) | `registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:*-tfc-backend` | 8001 | No |
| TFC frontend (Angular) | `registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:*-tfc-frontend` | 80 | No |
| React UI Storybook | `registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:*-storybook` | 80 | No |

## Architecture Decisions

### Single PostgreSQL instance, multiple databases

One Bitnami PostgreSQL StatefulSet with three databases: `boilerplate`, `keycloak`, `tfc`. Reduces operational overhead (one backup strategy, one upgrade path). Can split later if a workload needs dedicated resources.

### Kustomize + Bitnami Helm for PostgreSQL

Plain Kustomize manifests for all services (Keycloak, backends, frontends, storybook). Bitnami Helm chart for PostgreSQL only — running a production StatefulSet with proper storage, init scripts, and failover is genuinely complex and Bitnami solves it well.

### Single namespace

All resources in a `boilerplate` namespace. At this scale, per-app namespaces add network policy complexity without real benefit.

### Flux GitOps delivery

CI builds images and pushes to the private registry. The deploy job updates image tags in `clusters/<env>/boilerplate/*-patch.yaml` files and commits back to the repo. Flux reconciles the change. No cluster credentials in CI.

### Production-mode Keycloak

Uses `start` (not `start-dev`) with `--import-realm` for first boot. This is a change from the current Dockerfile which uses `start-dev`. Production mode requires `KC_HOSTNAME` to be set and changes the defaults for `KC_HOSTNAME_STRICT` and `KC_HTTP_ENABLED`. The K8s Deployment will set these explicitly — the current `KC_HOSTNAME_STRICT=false` and `KC_HTTP_ENABLED=true` env vars from docker-compose are no longer needed because the ingress handles TLS termination and forwards `X-Forwarded-*` headers. Realm configuration via ConfigMap. Admin client setup via a post-deploy K8s Job.

### Secrets

Plain K8s Secrets (gitignored) with `.example` shape files. Vault integration is available in the cluster (used by CI for registry creds) but Secret management strategy is left to the operator.

## Directory Structure

```
k8s/                                    # Base manifests (Kustomize)
├── kustomization.yaml
├── postgres/
│   ├── helmrelease.yaml                # Flux HelmRelease CR for Bitnami PostgreSQL
│   └── values.yaml                     # Bitnami Helm values
├── keycloak/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml                  # realm-export.json
│   ├── job-configure-admin.yaml
│   └── ingress.yaml
├── main/
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── backend-ingress.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   └── frontend-ingress.yaml
├── tfc/
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── backend-ingress.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   └── frontend-ingress.yaml
└── storybook/
    ├── deployment.yaml
    ├── service.yaml
    └── ingress.yaml

clusters/
└── dev/
    ├── flux-system/
    │   └── gotk-sync.yaml
    └── boilerplate/
        ├── kustomization.yaml          # References ../../k8s as base
        ├── namespace.yaml
        ├── postgres-values-patch.yaml  # Helm values overrides (passwords, storage size)
        ├── keycloak-patch.yaml
        ├── main-backend-patch.yaml
        ├── main-frontend-patch.yaml
        ├── tfc-backend-patch.yaml
        ├── tfc-frontend-patch.yaml
        └── storybook-patch.yaml
```

## Component Details

### PostgreSQL (Bitnami Helm)

- **Deployed via:** Flux `HelmRelease` CR referencing the Bitnami OCI chart (`oci://registry-1.docker.io/bitnamicharts/postgresql`). The `HelmRelease` lives at `k8s/postgres/helmrelease.yaml` and references `values.yaml` for configuration. Environment-specific overrides (passwords, storage size) go in `clusters/<env>/boilerplate/postgres-values-patch.yaml`.
- **Image tag:** `17`
- **Persistence:** 10Gi PVC with default StorageClass
- **Single replica** (no read replicas)
- **Init script:** A new `init-databases.sql` script (not reusing the existing `infra/keycloak/init-db.sql` which only handles the `keycloak` database). Creates all databases and users:
  - `boilerplate` database (auto-created by `POSTGRES_DB`) with default user
  - `keycloak` database with `keycloak` user
  - `tfc` database with `tfc` user
- **Service:** `postgresql.boilerplate.svc.cluster.local:5432`
- **No Ingress** — never exposed outside the cluster

### Keycloak

- **Kind:** Deployment (stateless when DB-backed)
- **Image:** `quay.io/keycloak/keycloak:26.1`
- **Command:** `start --import-realm`
- **Replicas:** 1
- **Environment variables:**
  - `KC_DB=postgres`
  - `KC_DB_URL=jdbc:postgresql://postgresql.boilerplate.svc.cluster.local:5432/keycloak`
  - `KC_DB_USERNAME` / `KC_DB_PASSWORD` from Secret
  - `KC_HOSTNAME` set per overlay
  - `KC_PROXY_HEADERS=xforwarded`
  - `KC_HEALTH_ENABLED=true`
  - `KC_BOOTSTRAP_ADMIN_USERNAME` / `KC_BOOTSTRAP_ADMIN_PASSWORD` from Secret
- **ConfigMap:** `realm-export.json` mounted at `/opt/keycloak/data/import/`
- **Probes:**
  - Readiness: `GET /health/ready` port 9000
  - Liveness: `GET /health/live` port 9000
  - Startup: `GET /health/started` port 9000, failureThreshold 30, periodSeconds 4 (120s budget)
- **Service:** ClusterIP on port 8080
- **Ingress:** External hostname (per overlay, e.g. `auth.yourdomain.com`)
- **Job — configure-admin-client:** Runs a modified `configure-admin-client.sh` after Keycloak is ready. The script must be updated to accept `KEYCLOAK_URL` as an env var instead of hardcoded `http://localhost:8080` (in a Job pod, localhost is the Job's own container, not Keycloak). The Job will set `KEYCLOAK_URL=http://keycloak.boilerplate.svc.cluster.local:8080`. Init container waits for readiness. `backoffLimit: 3`, `ttlSecondsAfterFinished: 300`.

### Main Backend (FastAPI)

- **Kind:** Deployment
- **Init container:** Runs `alembic upgrade head`
- **Environment:**
  - `DATABASE_URL=postgresql+asyncpg://<user>:<pass>@postgresql.boilerplate.svc.cluster.local:5432/boilerplate`
  - `KEYCLOAK_URL=http://keycloak.boilerplate.svc.cluster.local:8080`
  - `KEYCLOAK_REALM=boilerplate`
  - `KEYCLOAK_AUDIENCE=backend-api`
  - `KEYCLOAK_ADMIN_CLIENT_ID` / `KEYCLOAK_ADMIN_CLIENT_SECRET` from Secret
- **Service:** ClusterIP on port 8000
- **Ingress:** External hostname (e.g. `api.yourdomain.com`)
- **Health:** Readiness/liveness on `/api/health`

### Main Frontend (Angular)

- **Kind:** Deployment
- Static bundle served by nginx
- **Dockerfile rewrite required:** The current `apps/main/frontend/Dockerfile` runs `npx ng serve` (dev server). For K8s it needs a multi-stage production Dockerfile: node build stage (`ng build --configuration=production`) then nginx serve stage (same pattern as the TFC frontend Dockerfile).
- Keycloak URL baked at build time
- **Service:** ClusterIP on port 80
- **Ingress:** External hostname

### TFC Backend (FastAPI)

- **Kind:** Deployment
- **Init container:** `alembic upgrade head && python seed.py`
- **Environment:**
  - `DATABASE_URL=postgresql+asyncpg://<user>:<pass>@postgresql.boilerplate.svc.cluster.local:5432/tfc`
  - `ENVIRONMENT` / `ALLOWED_ORIGINS` from overlay
- No Keycloak integration (TFC does not use auth today)
- **Service:** ClusterIP on port 8001
- **Health:** Readiness/liveness on `/api/health` port 8001
- **Ingress:** External hostname, with WebSocket annotations:
  - `nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"`
  - `nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"`
  - WebSocket upgrade headers

### TFC Frontend (Angular)

- **Kind:** Deployment
- Static bundle served by nginx
- `API_BASE_URL` and `WS_BASE_URL` baked at build time
- **Service:** ClusterIP on port 80
- **Ingress:** External hostname

### React UI Storybook

- **Kind:** Deployment
- Source: `packages/react-ui/` (the shared React component library, not the Angular app)
- Built via `npm run build-storybook` (Storybook 10 + Vite), served by nginx
- Requires a new Dockerfile (none exists yet) — multi-stage: node build, then nginx serve
- **Workspace dependency:** `@aspect/react-ui` depends on `@aspect/react-headless` and `@aspect/design-system` via npm workspaces. The Dockerfile must copy the root `package.json` and all required `packages/` subdirectories for workspace resolution.
- Purely static, no backend
- **Service:** ClusterIP on port 80
- **Ingress:** External hostname

## CI/CD Pipeline (GitLab CI)

### Image Builds

Kaniko-based builds following the existing NCTS pattern. Each app gets a build job with path-based triggers.

**Build contexts:** All Kaniko contexts use the repo root (`.`). The main app and Keycloak Dockerfiles currently use paths relative to `apps/main/` or `infra/` — these must be rewritten to use repo-root-relative paths (matching the TFC pattern: `COPY apps/tfc/backend/...`). This is the cleanest approach and avoids context/path mismatches.

| Job | Context | Dockerfile | Trigger paths | Image suffix |
|-----|---------|------------|---------------|--------------|
| `image_build_main_backend` | `.` (repo root) | `apps/main/backend/Dockerfile` (rewritten) | `apps/main/backend/**/*`, `packages/**/*`, `shared/**/*` | `main-backend` |
| `image_build_main_frontend` | `.` (repo root) | `apps/main/frontend/Dockerfile` (rewritten) | `apps/main/frontend/**/*`, `packages/**/*`, `shared/**/*` | `main-frontend` |
| `image_build_tfc_backend` | `.` (repo root) | `apps/tfc/backend/Dockerfile` | `apps/tfc/backend/**/*` | `tfc-backend` |
| `image_build_tfc_frontend` | `.` (repo root) | `apps/tfc/frontend/Dockerfile` | `apps/tfc/frontend/**/*`, `packages/**/*` | `tfc-frontend` |
| `image_build_storybook` | `.` (repo root) | `packages/react-ui/Dockerfile` (new) | `packages/react-ui/**/*`, `packages/react-headless/**/*`, `packages/design-system/**/*` | `storybook` |
| `image_build_keycloak` | `.` (repo root) | `infra/keycloak/Dockerfile` (rewritten) | `infra/keycloak/**/*` | `keycloak` |

**Image tag format:** `<branch>-<short-sha>-<suffix>`

**Registry:** `registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate`

### Flux Manifest Updates

`update_flux_manifests` deploy job (same pattern as NCTS):

1. Runs after successful builds
2. Checks for stale pipelines (compares commit SHAs)
3. Updates image tags in `clusters/dev/boilerplate/*-patch.yaml` via `sed`
4. Commits with `[skip ci]` and pushes back to the branch
5. Flux reconciles the change

### Existing CI Unchanged

- GitLab CI security scanning, linting, npm audit — unchanged
- GitHub Actions workflows — unchanged (or deprecated in favor of GitLab CI)

## Ingress

Ingress resources are provided for each externally-accessible service. They assume:

- An ingress controller is already running in the cluster
- cert-manager is already running and configured
- Hostnames are set per overlay in the patch files

No ingress controller or cert-manager installation is included in this design.

## Dockerfile Changes Required

Several Dockerfiles need modification to work with Kaniko's repo-root context and K8s production requirements:

| Dockerfile | Change | Reason |
|------------|--------|--------|
| `apps/main/backend/Dockerfile` | Rewrite COPY paths from `backend/...` to `apps/main/backend/...`, `shared/...` to `shared/...`, `packages/...` to `packages/...` | Align with repo-root Kaniko context |
| `apps/main/frontend/Dockerfile` | Full rewrite: multi-stage with `ng build --configuration=production` + nginx serve. Rewrite COPY paths to repo-root-relative. | Current Dockerfile is dev-only (`ng serve`), no production build |
| `infra/keycloak/Dockerfile` | Rewrite `COPY keycloak/...` to `COPY infra/keycloak/...`. Change CMD from `start-dev` to `start`. | Align with repo-root context + production mode |
| `infra/keycloak/configure-admin-client.sh` | Replace hardcoded `http://localhost:8080` with `${KEYCLOAK_URL:-http://localhost:8080}` | Script runs in a separate Job pod, not sidecar |
| `packages/react-ui/Dockerfile` | **New file.** Multi-stage: copy root `package.json` + workspace packages, `npm install`, `npm run build-storybook`, then nginx serve. | No Dockerfile exists yet |

Existing Dockerfiles that need **no changes**: `apps/tfc/backend/Dockerfile`, `apps/tfc/frontend/Dockerfile` (already use repo-root-relative paths).

## What This Design Does NOT Cover

- **Monitoring/observability** (Prometheus, Grafana) — add later
- **Backup strategy** for PostgreSQL — depends on cluster tooling
- **Horizontal pod autoscaling** — single replicas for now
- **Network policies** — single namespace, add later if needed
- **Vault integration for K8s Secrets** — left to operator preference
- **Production overlay** (`clusters/prod/`) — start with dev, add prod overlay when ready
