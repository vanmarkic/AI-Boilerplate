# Kubernetes Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the full AI-Boilerplate stack from Docker Compose to Kubernetes with Flux GitOps delivery.

**Architecture:** Kustomize base manifests in `k8s/`, Flux HelmRelease for Bitnami PostgreSQL, Kustomize overlay patches in `clusters/dev/boilerplate/`. CI builds images with Kaniko, pushes to private registry, updates image tags in patch files. All services in a single `boilerplate` namespace.

**Tech Stack:** Kubernetes, Kustomize, Flux CD (HelmRelease), Bitnami PostgreSQL Helm chart, Kaniko, GitLab CI, nginx (static serving)

**Spec:** `docs/superpowers/specs/2026-04-01-k8s-deployment-design.md`

---

## File Map

### New files

| Path | Purpose |
|------|---------|
| `k8s/kustomization.yaml` | Root Kustomize config referencing all base resources |
| `k8s/postgres/helmrelease.yaml` | Flux HelmRelease CR for Bitnami PostgreSQL |
| `k8s/postgres/values.yaml` | Bitnami Helm values (databases, users, persistence) |
| `k8s/postgres/init-databases.sql` | Init script creating all 3 databases and users |
| `k8s/keycloak/deployment.yaml` | Keycloak Deployment (production mode) |
| `k8s/keycloak/service.yaml` | Keycloak ClusterIP Service |
| `k8s/keycloak/configmap.yaml` | ConfigMap wrapping `realm-export.json` |
| `k8s/keycloak/job-configure-admin.yaml` | Job to assign realm-management roles |
| `k8s/keycloak/ingress.yaml` | Keycloak Ingress |
| `k8s/main/backend-deployment.yaml` | Main backend Deployment with init container |
| `k8s/main/backend-service.yaml` | Main backend ClusterIP Service |
| `k8s/main/backend-ingress.yaml` | Main backend Ingress |
| `k8s/main/frontend-deployment.yaml` | Main frontend Deployment |
| `k8s/main/frontend-service.yaml` | Main frontend ClusterIP Service |
| `k8s/main/frontend-ingress.yaml` | Main frontend Ingress |
| `k8s/tfc/backend-deployment.yaml` | TFC backend Deployment with init container |
| `k8s/tfc/backend-service.yaml` | TFC backend ClusterIP Service |
| `k8s/tfc/backend-ingress.yaml` | TFC backend Ingress (WebSocket annotations) |
| `k8s/tfc/frontend-deployment.yaml` | TFC frontend Deployment |
| `k8s/tfc/frontend-service.yaml` | TFC frontend ClusterIP Service |
| `k8s/tfc/frontend-ingress.yaml` | TFC frontend Ingress |
| `k8s/storybook/deployment.yaml` | Storybook Deployment |
| `k8s/storybook/service.yaml` | Storybook ClusterIP Service |
| `k8s/storybook/ingress.yaml` | Storybook Ingress |
| `k8s/secrets.example.yaml` | Example Secret shape (gitignored actual secrets) |
| `clusters/dev/flux-system/gotk-sync.yaml` | Flux GitRepository + Kustomization bootstrap |
| `clusters/dev/boilerplate/kustomization.yaml` | Overlay Kustomization referencing `k8s/` base |
| `clusters/dev/boilerplate/namespace.yaml` | Namespace definition |
| `clusters/dev/boilerplate/postgres-values-patch.yaml` | PostgreSQL Helm values override |
| `clusters/dev/boilerplate/keycloak-patch.yaml` | Keycloak image/env patch |
| `clusters/dev/boilerplate/main-backend-patch.yaml` | Main backend image patch |
| `clusters/dev/boilerplate/main-frontend-patch.yaml` | Main frontend image patch |
| `clusters/dev/boilerplate/tfc-backend-patch.yaml` | TFC backend image patch |
| `clusters/dev/boilerplate/tfc-frontend-patch.yaml` | TFC frontend image patch |
| `clusters/dev/boilerplate/storybook-patch.yaml` | Storybook image patch |
| `packages/react-ui/Dockerfile` | New Storybook multi-stage Dockerfile |

### Modified files

| Path | Change |
|------|--------|
| `apps/main/backend/Dockerfile` | Rewrite COPY paths to repo-root-relative |
| `apps/main/frontend/Dockerfile` | Full rewrite: multi-stage production build + nginx |
| `infra/keycloak/Dockerfile` | Rewrite COPY paths + change to production mode |
| `infra/keycloak/configure-admin-client.sh` | Accept `KEYCLOAK_URL` env var |
| `.gitlab-ci.yml` | Add `build` and `deploy` stages with Kaniko jobs |
| `.gitignore` | Add `k8s/secrets.yaml` and `clusters/*/boilerplate/secrets.yaml` |

---

### Task 1: Rewrite Dockerfiles for repo-root context

**Files:**
- Modify: `apps/main/backend/Dockerfile`
- Modify: `apps/main/frontend/Dockerfile`
- Modify: `infra/keycloak/Dockerfile`
- Modify: `infra/keycloak/configure-admin-client.sh`
- Create: `packages/react-ui/Dockerfile`
- Create: `apps/main/frontend/nginx.conf`
- Create: `apps/main/frontend/entrypoint.sh`

- [ ] **Step 1: Rewrite main backend Dockerfile**

Change all COPY paths from `apps/main/`-relative to repo-root-relative. The existing Dockerfile has a tier-filter stage that copies from `packages/`, `shared/`, and `backend/` — these need to become `packages/`, `shared/`, `apps/main/backend/`.

```dockerfile
# Stage 1: Filter features by tier
FROM python:3.12-slim AS feature-filter
ARG TIER=3
RUN pip install pyyaml
COPY packages/monorepo-tier-filter/ /monorepo-tier-filter/
RUN pip install /monorepo-tier-filter/
COPY shared/scripts/filter-features.py /filter.py
COPY apps/main/backend/features/ /all-features/
RUN python /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/

FROM ghcr.io/astral-sh/uv:0.8 AS uv

# Stage 2: Build backend with only filtered features
FROM python:3.12-slim

WORKDIR /app

COPY --from=uv /uv /uvx /bin/

COPY apps/main/backend/pyproject.toml apps/main/backend/uv.lock ./
COPY apps/main/backend/core/ ./core/
COPY apps/main/backend/main.py ./
COPY apps/main/backend/alembic.ini ./
COPY apps/main/backend/alembic/ ./alembic/
COPY --from=feature-filter /filtered-features/ ./features/

RUN uv sync --frozen --no-dev --no-cache

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Note: Remove `--reload` from CMD — production mode should not hot-reload.

- [ ] **Step 2: Rewrite main frontend Dockerfile as multi-stage production build**

The current Dockerfile runs `ng serve` (dev server). Rewrite as multi-stage: tier-filter, node build, nginx serve. Follow the TFC frontend Dockerfile pattern.

Create `apps/main/frontend/nginx.conf`:

```nginx
server {
    listen ${PORT};
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Angular SPA — serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Disable caching for index.html (picks up new hashed bundles)
    location = /index.html {
        expires -1;
        add_header Cache-Control "no-cache";
    }
}
```

Create `apps/main/frontend/entrypoint.sh`:

```bash
#!/bin/sh
# Inject runtime environment variables into the built Angular app.
INDEX_FILE=/usr/share/nginx/html/index.html

if [ -n "$KEYCLOAK_URL" ]; then
  sed -i "s|</head>|<script>window.__env={keycloakUrl:\"${KEYCLOAK_URL}\",keycloakRealm:\"${KEYCLOAK_REALM:-boilerplate}\",keycloakClientId:\"${KEYCLOAK_CLIENT_ID:-frontend-app}\"};</script></head>|" "$INDEX_FILE"
fi
```

Rewrite `apps/main/frontend/Dockerfile`:

```dockerfile
# Stage 1: Filter features by tier
FROM node:22-slim AS feature-filter
RUN apt-get update && apt-get install -y python3 python3-pip && pip3 install pyyaml --break-system-packages
ARG TIER=3
COPY packages/monorepo-tier-filter/ /monorepo-tier-filter/
RUN pip3 install /monorepo-tier-filter/ --break-system-packages
COPY shared/scripts/filter-features.py /filter.py
COPY apps/main/frontend/src/app/features/ /all-features/
RUN python3 /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/ --frontend

# Stage 2: Build Angular app
FROM node:22-slim AS build
WORKDIR /app

COPY apps/main/frontend/package.json ./
RUN npm i

COPY apps/main/frontend/ .
COPY --from=feature-filter /filtered-features/ ./src/app/features/

RUN npx ng build --configuration=production

# Stage 3: Serve with nginx
FROM nginx:1.27-alpine

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY apps/main/frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY apps/main/frontend/entrypoint.sh /docker-entrypoint.d/40-inject-env.sh
RUN chmod +x /docker-entrypoint.d/40-inject-env.sh

ENV PORT=80
EXPOSE ${PORT}
```

Note: The `dist/` output path (`dist/frontend/browser`) may vary — check `apps/main/frontend/angular.json` for `outputPath` config. Adjust if needed.

- [ ] **Step 3: Rewrite Keycloak Dockerfile**

```dockerfile
FROM quay.io/keycloak/keycloak:26.1

COPY infra/keycloak/configure-admin-client.sh /opt/keycloak/configure-admin-client.sh

USER keycloak

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--import-realm"]
```

- [ ] **Step 4: Update configure-admin-client.sh to accept KEYCLOAK_URL**

In `infra/keycloak/configure-admin-client.sh`, replace the hardcoded `http://localhost:8080` with an env var:

Change line 18:
```bash
# Before:
    --server http://localhost:8080 \
# After:
    --server "${KEYCLOAK_URL:-http://localhost:8080}" \
```

This preserves backward compatibility for docker-compose (defaults to localhost).

- [ ] **Step 5: Create Storybook Dockerfile**

Create `packages/react-ui/Dockerfile`:

```dockerfile
# Stage 1: Build Storybook
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/design-system/package.json ./packages/design-system/
COPY packages/react-headless/package.json ./packages/react-headless/
COPY packages/react-ui/package.json ./packages/react-ui/

RUN npm install --workspace=packages/react-ui

COPY packages/design-system/ ./packages/design-system/
COPY packages/react-headless/ ./packages/react-headless/
COPY packages/react-ui/ ./packages/react-ui/

RUN npm run build --workspace=packages/react-headless
RUN npm run build-storybook --workspace=packages/react-ui

# Stage 2: Serve with nginx
FROM nginx:1.27-alpine

COPY --from=build /app/packages/react-ui/storybook-static /usr/share/nginx/html

EXPOSE 80
```

- [ ] **Step 6: Verify Dockerfiles build locally**

Run each build to verify COPY paths resolve correctly:

```bash
# From repo root:
docker build -f apps/main/backend/Dockerfile -t test-main-backend .
docker build -f apps/main/frontend/Dockerfile -t test-main-frontend .
docker build -f apps/tfc/backend/Dockerfile -t test-tfc-backend .
docker build -f apps/tfc/frontend/Dockerfile -t test-tfc-frontend .
docker build -f infra/keycloak/Dockerfile -t test-keycloak .
docker build -f packages/react-ui/Dockerfile -t test-storybook .
```

Expected: All 6 builds succeed.

- [ ] **Step 7: Commit**

```bash
git add apps/main/backend/Dockerfile apps/main/frontend/Dockerfile \
  apps/main/frontend/nginx.conf apps/main/frontend/entrypoint.sh \
  infra/keycloak/Dockerfile infra/keycloak/configure-admin-client.sh \
  packages/react-ui/Dockerfile
git commit -m "feat: rewrite Dockerfiles for repo-root Kaniko context and production builds"
```

---

### Task 2: PostgreSQL Helm manifests

**Files:**
- Create: `k8s/postgres/helmrelease.yaml`
- Create: `k8s/postgres/values.yaml`
- Create: `k8s/postgres/init-databases.sql`

- [ ] **Step 1: Create HelmRelease CR**

Create `k8s/postgres/helmrelease.yaml`:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: bitnami
  namespace: boilerplate
spec:
  type: oci
  interval: 24h
  url: oci://registry-1.docker.io/bitnamicharts
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: postgresql
  namespace: boilerplate
spec:
  interval: 30m
  chart:
    spec:
      chart: postgresql
      version: "16.*"
      sourceRef:
        kind: HelmRepository
        name: bitnami
  valuesFrom:
    - kind: ConfigMap
      name: postgresql-values
      valuesKey: values.yaml
```

- [ ] **Step 2: Create Helm values**

Create `k8s/postgres/values.yaml`:

```yaml
image:
  tag: "17"

auth:
  postgresPassword: changeme
  database: boilerplate
  username: dev
  password: changeme

primary:
  persistence:
    size: 10Gi
  initdb:
    scripts:
      init-databases.sql: |
        -- See k8s/postgres/init-databases.sql for source
  resources:
    requests:
      cpu: 250m
      memory: 256Mi
    limits:
      memory: 512Mi

readReplicas:
  replicaCount: 0
```

- [ ] **Step 3: Create init-databases.sql**

Create `k8s/postgres/init-databases.sql`:

```sql
-- Create keycloak database and user
SELECT 'CREATE DATABASE keycloak'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'keycloak')\gexec

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'keycloak') THEN
    CREATE USER keycloak WITH ENCRYPTED PASSWORD 'changeme';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE keycloak TO keycloak;
\c keycloak
GRANT ALL ON SCHEMA public TO keycloak;

-- Create tfc database and user
\c postgres
SELECT 'CREATE DATABASE tfc'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'tfc')\gexec

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tfc') THEN
    CREATE USER tfc WITH ENCRYPTED PASSWORD 'changeme';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE tfc TO tfc;
\c tfc
GRANT ALL ON SCHEMA public TO tfc;
```

Note: The `changeme` passwords are placeholders — overridden per environment via `clusters/dev/boilerplate/postgres-values-patch.yaml`.

- [ ] **Step 4: Commit**

```bash
git add k8s/postgres/
git commit -m "feat: add PostgreSQL Bitnami HelmRelease and init scripts"
```

---

### Task 3: Keycloak K8s manifests

**Files:**
- Create: `k8s/keycloak/deployment.yaml`
- Create: `k8s/keycloak/service.yaml`
- Create: `k8s/keycloak/configmap.yaml`
- Create: `k8s/keycloak/job-configure-admin.yaml`
- Create: `k8s/keycloak/ingress.yaml`

- [ ] **Step 1: Create Keycloak Deployment**

Create `k8s/keycloak/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keycloak
  namespace: boilerplate
  labels:
    app: keycloak
spec:
  replicas: 1
  selector:
    matchLabels:
      app: keycloak
  template:
    metadata:
      labels:
        app: keycloak
    spec:
      containers:
        - name: keycloak
          image: quay.io/keycloak/keycloak:26.1
          args: ["start", "--import-realm"]
          env:
            - name: KC_DB
              value: postgres
            - name: KC_DB_URL
              value: jdbc:postgresql://postgresql.boilerplate.svc.cluster.local:5432/keycloak
            - name: KC_DB_USERNAME
              valueFrom:
                secretKeyRef:
                  name: keycloak-secret
                  key: db-username
            - name: KC_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: keycloak-secret
                  key: db-password
            - name: KC_HOSTNAME
              value: PLACEHOLDER
            - name: KC_PROXY_HEADERS
              value: xforwarded
            - name: KC_HEALTH_ENABLED
              value: "true"
            - name: KC_BOOTSTRAP_ADMIN_USERNAME
              valueFrom:
                secretKeyRef:
                  name: keycloak-secret
                  key: admin-username
            - name: KC_BOOTSTRAP_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: keycloak-secret
                  key: admin-password
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 9000
              name: health
          startupProbe:
            httpGet:
              path: /health/started
              port: health
            failureThreshold: 30
            periodSeconds: 4
          readinessProbe:
            httpGet:
              path: /health/ready
              port: health
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health/live
              port: health
            periodSeconds: 30
          volumeMounts:
            - name: realm-config
              mountPath: /opt/keycloak/data/import
              readOnly: true
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              memory: 1Gi
      volumes:
        - name: realm-config
          configMap:
            name: keycloak-realm
```

- [ ] **Step 2: Create Keycloak Service**

Create `k8s/keycloak/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: keycloak
  namespace: boilerplate
  labels:
    app: keycloak
spec:
  type: ClusterIP
  ports:
    - port: 8080
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: keycloak
```

- [ ] **Step 3: Create Keycloak ConfigMap**

Create `k8s/keycloak/configmap.yaml`. This wraps the existing `infra/keycloak/realm-export.json` as a ConfigMap. Copy the full JSON content (153 lines) into the ConfigMap's data:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: keycloak-realm
  namespace: boilerplate
data:
  realm-export.json: |
    {
      "realm": "boilerplate",
      "enabled": true,
      ... (paste full contents of infra/keycloak/realm-export.json)
    }
```

Generate this from the existing file:

```bash
kubectl create configmap keycloak-realm \
  --from-file=realm-export.json=infra/keycloak/realm-export.json \
  --namespace=boilerplate --dry-run=client -o yaml > k8s/keycloak/configmap.yaml
```

- [ ] **Step 4: Create configure-admin Job**

Create `k8s/keycloak/job-configure-admin.yaml`:

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: keycloak-configure-admin
  namespace: boilerplate
  labels:
    app: keycloak
spec:
  backoffLimit: 3
  ttlSecondsAfterFinished: 300
  template:
    spec:
      restartPolicy: OnFailure
      initContainers:
        - name: wait-for-keycloak
          image: busybox:1.37
          command:
            - sh
            - -c
            - |
              echo "Waiting for Keycloak to be ready..."
              until wget -qO- http://keycloak.boilerplate.svc.cluster.local:9000/health/ready 2>/dev/null | grep -q '"status":"UP"'; do
                echo "Keycloak not ready yet, retrying in 5s..."
                sleep 5
              done
              echo "Keycloak is ready."
      containers:
        - name: configure
          image: quay.io/keycloak/keycloak:26.1
          command: ["/bin/bash", "/opt/keycloak/configure-admin-client.sh"]
          env:
            - name: KEYCLOAK_URL
              value: http://keycloak.boilerplate.svc.cluster.local:8080
            - name: KC_BOOTSTRAP_ADMIN_USERNAME
              valueFrom:
                secretKeyRef:
                  name: keycloak-secret
                  key: admin-username
            - name: KC_BOOTSTRAP_ADMIN_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: keycloak-secret
                  key: admin-password
          volumeMounts:
            - name: script
              mountPath: /opt/keycloak/configure-admin-client.sh
              subPath: configure-admin-client.sh
              readOnly: true
      volumes:
        - name: script
          configMap:
            name: keycloak-admin-script
            defaultMode: 0755
```

Note: The script is mounted via a ConfigMap. Create it at deploy time:

```bash
kubectl create configmap keycloak-admin-script \
  --from-file=configure-admin-client.sh=infra/keycloak/configure-admin-client.sh \
  --namespace=boilerplate --dry-run=client -o yaml >> k8s/keycloak/configmap.yaml
```

- [ ] **Step 5: Create Keycloak Ingress**

Create `k8s/keycloak/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: keycloak
  namespace: boilerplate
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - PLACEHOLDER
      secretName: keycloak-tls
  rules:
    - host: PLACEHOLDER
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: keycloak
                port:
                  number: 8080
```

The `PLACEHOLDER` host is overridden per environment in the cluster overlay patches.

- [ ] **Step 6: Commit**

```bash
git add k8s/keycloak/
git commit -m "feat: add Keycloak K8s manifests (deployment, service, configmap, job, ingress)"
```

---

### Task 4: Main app K8s manifests

**Files:**
- Create: `k8s/main/backend-deployment.yaml`
- Create: `k8s/main/backend-service.yaml`
- Create: `k8s/main/backend-ingress.yaml`
- Create: `k8s/main/frontend-deployment.yaml`
- Create: `k8s/main/frontend-service.yaml`
- Create: `k8s/main/frontend-ingress.yaml`

- [ ] **Step 1: Create main backend Deployment**

Create `k8s/main/backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: main-backend
  namespace: boilerplate
  labels:
    app: main-backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: main-backend
  template:
    metadata:
      labels:
        app: main-backend
    spec:
      initContainers:
        - name: migrate
          image: PLACEHOLDER
          command: ["alembic", "upgrade", "head"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: main-backend-secret
                  key: database-url
      containers:
        - name: main-backend
          image: PLACEHOLDER
          ports:
            - containerPort: 8000
              name: http
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: main-backend-secret
                  key: database-url
            - name: ENVIRONMENT
              value: production
            - name: KEYCLOAK_URL
              value: http://keycloak.boilerplate.svc.cluster.local:8080
            - name: KEYCLOAK_REALM
              value: boilerplate
            - name: KEYCLOAK_AUDIENCE
              value: backend-api
            - name: KEYCLOAK_ADMIN_CLIENT_ID
              valueFrom:
                secretKeyRef:
                  name: main-backend-secret
                  key: keycloak-admin-client-id
            - name: KEYCLOAK_ADMIN_CLIENT_SECRET
              valueFrom:
                secretKeyRef:
                  name: main-backend-secret
                  key: keycloak-admin-client-secret
          readinessProbe:
            httpGet:
              path: /api/health
              port: http
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
            periodSeconds: 30
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              memory: 512Mi
```

- [ ] **Step 2: Create main backend Service and Ingress**

Create `k8s/main/backend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: main-backend
  namespace: boilerplate
  labels:
    app: main-backend
spec:
  type: ClusterIP
  ports:
    - port: 8000
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: main-backend
```

Create `k8s/main/backend-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-backend
  namespace: boilerplate
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - PLACEHOLDER
      secretName: main-backend-tls
  rules:
    - host: PLACEHOLDER
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: main-backend
                port:
                  number: 8000
```

- [ ] **Step 3: Create main frontend Deployment, Service, Ingress**

Create `k8s/main/frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: main-frontend
  namespace: boilerplate
  labels:
    app: main-frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: main-frontend
  template:
    metadata:
      labels:
        app: main-frontend
    spec:
      containers:
        - name: main-frontend
          image: PLACEHOLDER
          ports:
            - containerPort: 80
              name: http
          env:
            - name: KEYCLOAK_URL
              value: PLACEHOLDER
            - name: KEYCLOAK_REALM
              value: boilerplate
            - name: KEYCLOAK_CLIENT_ID
              value: frontend-app
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 128Mi
```

Create `k8s/main/frontend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: main-frontend
  namespace: boilerplate
  labels:
    app: main-frontend
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: main-frontend
```

Create `k8s/main/frontend-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: main-frontend
  namespace: boilerplate
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - PLACEHOLDER
      secretName: main-frontend-tls
  rules:
    - host: PLACEHOLDER
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: main-frontend
                port:
                  number: 80
```

- [ ] **Step 4: Commit**

```bash
git add k8s/main/
git commit -m "feat: add main app K8s manifests (backend + frontend)"
```

---

### Task 5: TFC app K8s manifests

**Files:**
- Create: `k8s/tfc/backend-deployment.yaml`
- Create: `k8s/tfc/backend-service.yaml`
- Create: `k8s/tfc/backend-ingress.yaml`
- Create: `k8s/tfc/frontend-deployment.yaml`
- Create: `k8s/tfc/frontend-service.yaml`
- Create: `k8s/tfc/frontend-ingress.yaml`

- [ ] **Step 1: Create TFC backend Deployment**

Create `k8s/tfc/backend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tfc-backend
  namespace: boilerplate
  labels:
    app: tfc-backend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tfc-backend
  template:
    metadata:
      labels:
        app: tfc-backend
    spec:
      initContainers:
        - name: migrate-and-seed
          image: PLACEHOLDER
          command:
            - sh
            - -c
            - "alembic upgrade head && python seed.py"
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: tfc-backend-secret
                  key: database-url
      containers:
        - name: tfc-backend
          image: PLACEHOLDER
          ports:
            - containerPort: 8001
              name: http
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: tfc-backend-secret
                  key: database-url
            - name: ENVIRONMENT
              value: production
            - name: PORT
              value: "8001"
            - name: ALLOWED_ORIGINS
              value: PLACEHOLDER
          readinessProbe:
            httpGet:
              path: /api/health
              port: http
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/health
              port: http
            periodSeconds: 30
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              memory: 512Mi
```

- [ ] **Step 2: Create TFC backend Service and Ingress**

Create `k8s/tfc/backend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: tfc-backend
  namespace: boilerplate
  labels:
    app: tfc-backend
spec:
  type: ClusterIP
  ports:
    - port: 8001
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: tfc-backend
```

Create `k8s/tfc/backend-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tfc-backend
  namespace: boilerplate
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
spec:
  tls:
    - hosts:
        - PLACEHOLDER
      secretName: tfc-backend-tls
  rules:
    - host: PLACEHOLDER
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: tfc-backend
                port:
                  number: 8001
```

- [ ] **Step 3: Create TFC frontend Deployment, Service, Ingress**

Create `k8s/tfc/frontend-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tfc-frontend
  namespace: boilerplate
  labels:
    app: tfc-frontend
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tfc-frontend
  template:
    metadata:
      labels:
        app: tfc-frontend
    spec:
      containers:
        - name: tfc-frontend
          image: PLACEHOLDER
          ports:
            - containerPort: 80
              name: http
          env:
            - name: API_BASE_URL
              value: PLACEHOLDER
            - name: WS_BASE_URL
              value: PLACEHOLDER
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 128Mi
```

Create `k8s/tfc/frontend-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: tfc-frontend
  namespace: boilerplate
  labels:
    app: tfc-frontend
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: tfc-frontend
```

Create `k8s/tfc/frontend-ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tfc-frontend
  namespace: boilerplate
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - PLACEHOLDER
      secretName: tfc-frontend-tls
  rules:
    - host: PLACEHOLDER
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: tfc-frontend
                port:
                  number: 80
```

- [ ] **Step 4: Commit**

```bash
git add k8s/tfc/
git commit -m "feat: add TFC app K8s manifests (backend + frontend with WebSocket support)"
```

---

### Task 6: Storybook K8s manifests

**Files:**
- Create: `k8s/storybook/deployment.yaml`
- Create: `k8s/storybook/service.yaml`
- Create: `k8s/storybook/ingress.yaml`

- [ ] **Step 1: Create Storybook Deployment, Service, Ingress**

Create `k8s/storybook/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: storybook
  namespace: boilerplate
  labels:
    app: storybook
spec:
  replicas: 1
  selector:
    matchLabels:
      app: storybook
  template:
    metadata:
      labels:
        app: storybook
    spec:
      containers:
        - name: storybook
          image: PLACEHOLDER
          ports:
            - containerPort: 80
              name: http
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 128Mi
```

Create `k8s/storybook/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: storybook
  namespace: boilerplate
  labels:
    app: storybook
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: http
      protocol: TCP
      name: http
  selector:
    app: storybook
```

Create `k8s/storybook/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: storybook
  namespace: boilerplate
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - PLACEHOLDER
      secretName: storybook-tls
  rules:
    - host: PLACEHOLDER
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: storybook
                port:
                  number: 80
```

- [ ] **Step 2: Commit**

```bash
git add k8s/storybook/
git commit -m "feat: add Storybook K8s manifests"
```

---

### Task 7: Kustomize base and secrets example

**Files:**
- Create: `k8s/kustomization.yaml`
- Create: `k8s/secrets.example.yaml`
- Modify: `.gitignore`

- [ ] **Step 1: Create root Kustomization**

Create `k8s/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  # PostgreSQL is managed via Flux HelmRelease, not Kustomize
  - postgres/helmrelease.yaml

  # Keycloak
  - keycloak/deployment.yaml
  - keycloak/service.yaml
  - keycloak/configmap.yaml
  - keycloak/job-configure-admin.yaml
  - keycloak/ingress.yaml

  # Main app
  - main/backend-deployment.yaml
  - main/backend-service.yaml
  - main/backend-ingress.yaml
  - main/frontend-deployment.yaml
  - main/frontend-service.yaml
  - main/frontend-ingress.yaml

  # TFC app
  - tfc/backend-deployment.yaml
  - tfc/backend-service.yaml
  - tfc/backend-ingress.yaml
  - tfc/frontend-deployment.yaml
  - tfc/frontend-service.yaml
  - tfc/frontend-ingress.yaml

  # Storybook
  - storybook/deployment.yaml
  - storybook/service.yaml
  - storybook/ingress.yaml
```

- [ ] **Step 2: Create secrets example**

Create `k8s/secrets.example.yaml`:

```yaml
# Copy this file to the cluster overlay directory and fill in real values.
# DO NOT commit actual secrets to git.
apiVersion: v1
kind: Secret
metadata:
  name: keycloak-secret
  namespace: boilerplate
type: Opaque
stringData:
  db-username: keycloak
  db-password: CHANGE_ME
  admin-username: admin
  admin-password: CHANGE_ME
---
apiVersion: v1
kind: Secret
metadata:
  name: main-backend-secret
  namespace: boilerplate
type: Opaque
stringData:
  database-url: postgresql+asyncpg://dev:CHANGE_ME@postgresql.boilerplate.svc.cluster.local:5432/boilerplate
  keycloak-admin-client-id: admin-api
  keycloak-admin-client-secret: CHANGE_ME
---
apiVersion: v1
kind: Secret
metadata:
  name: tfc-backend-secret
  namespace: boilerplate
type: Opaque
stringData:
  database-url: postgresql+asyncpg://tfc:CHANGE_ME@postgresql.boilerplate.svc.cluster.local:5432/tfc
```

- [ ] **Step 3: Add secrets to .gitignore**

Append to `.gitignore`:

```
# K8s secrets (never commit actual credentials)
k8s/secrets.yaml
clusters/*/boilerplate/secrets.yaml
```

- [ ] **Step 4: Verify Kustomize builds**

```bash
kubectl kustomize k8s/
```

Expected: Valid YAML output with all resources. May show warnings about HelmRelease CRD not being known locally — that's fine.

- [ ] **Step 5: Commit**

```bash
git add k8s/kustomization.yaml k8s/secrets.example.yaml .gitignore
git commit -m "feat: add Kustomize base config and secrets example"
```

---

### Task 8: Flux cluster overlay (dev)

**Files:**
- Create: `clusters/dev/flux-system/gotk-sync.yaml`
- Create: `clusters/dev/boilerplate/namespace.yaml`
- Create: `clusters/dev/boilerplate/kustomization.yaml`
- Create: `clusters/dev/boilerplate/postgres-values-patch.yaml`
- Create: `clusters/dev/boilerplate/keycloak-patch.yaml`
- Create: `clusters/dev/boilerplate/main-backend-patch.yaml`
- Create: `clusters/dev/boilerplate/main-frontend-patch.yaml`
- Create: `clusters/dev/boilerplate/tfc-backend-patch.yaml`
- Create: `clusters/dev/boilerplate/tfc-frontend-patch.yaml`
- Create: `clusters/dev/boilerplate/storybook-patch.yaml`

- [ ] **Step 1: Create Flux bootstrap**

Create `clusters/dev/flux-system/gotk-sync.yaml`:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: boilerplate
  namespace: flux-system
spec:
  interval: 1m
  url: https://developers.naval-group.com/gitlab/naval-group/projects/cyberlab-ngb/boilerplate.git
  ref:
    branch: dev
  secretRef:
    name: flux-git-credentials
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: boilerplate
  namespace: flux-system
spec:
  interval: 5m
  sourceRef:
    kind: GitRepository
    name: boilerplate
  path: ./clusters/dev/boilerplate
  prune: true
  wait: true
```

Note: The Git URL and secret name are placeholders — adjust for the actual GitLab project path and Flux credentials.

- [ ] **Step 2: Create namespace**

Create `clusters/dev/boilerplate/namespace.yaml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: boilerplate
```

- [ ] **Step 3: Create overlay Kustomization**

Create `clusters/dev/boilerplate/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - namespace.yaml
  - ../../../k8s

patches:
  - path: keycloak-patch.yaml
  - path: main-backend-patch.yaml
  - path: main-frontend-patch.yaml
  - path: tfc-backend-patch.yaml
  - path: tfc-frontend-patch.yaml
  - path: storybook-patch.yaml
```

- [ ] **Step 4: Create PostgreSQL values patch**

Create `clusters/dev/boilerplate/postgres-values-patch.yaml`:

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: postgresql
  namespace: boilerplate
spec:
  values:
    auth:
      postgresPassword: dev-postgres-password
      password: dev-password
    primary:
      persistence:
        size: 5Gi
```

- [ ] **Step 5: Create image patch files**

Create `clusters/dev/boilerplate/keycloak-patch.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: keycloak
  namespace: boilerplate
spec:
  template:
    spec:
      containers:
        - name: keycloak
          env:
            - name: KC_HOSTNAME
              value: auth.dev.example.com
```

Create `clusters/dev/boilerplate/main-backend-patch.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: main-backend
  namespace: boilerplate
spec:
  template:
    spec:
      initContainers:
        - name: migrate
          image: registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:dev-000000-main-backend
      containers:
        - name: main-backend
          image: registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:dev-000000-main-backend
```

Create `clusters/dev/boilerplate/main-frontend-patch.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: main-frontend
  namespace: boilerplate
spec:
  template:
    spec:
      containers:
        - name: main-frontend
          image: registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:dev-000000-main-frontend
```

Create `clusters/dev/boilerplate/tfc-backend-patch.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tfc-backend
  namespace: boilerplate
spec:
  template:
    spec:
      initContainers:
        - name: migrate-and-seed
          image: registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:dev-000000-tfc-backend
      containers:
        - name: tfc-backend
          image: registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:dev-000000-tfc-backend
          env:
            - name: ALLOWED_ORIGINS
              value: https://tfc.dev.example.com
```

Create `clusters/dev/boilerplate/tfc-frontend-patch.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tfc-frontend
  namespace: boilerplate
spec:
  template:
    spec:
      containers:
        - name: tfc-frontend
          image: registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:dev-000000-tfc-frontend
```

Create `clusters/dev/boilerplate/storybook-patch.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: storybook
  namespace: boilerplate
spec:
  template:
    spec:
      containers:
        - name: storybook
          image: registry-cyberlab-ngb.naval-group.dev/naval-group/boilerplate:dev-000000-storybook
```

- [ ] **Step 6: Verify overlay builds**

```bash
kubectl kustomize clusters/dev/boilerplate/
```

Expected: Valid YAML with all resources, patches applied, images set to dev placeholders.

- [ ] **Step 7: Commit**

```bash
git add clusters/
git commit -m "feat: add Flux cluster overlay for dev environment"
```

---

### Task 9: GitLab CI build and deploy stages

**Files:**
- Modify: `.gitlab-ci.yml`

- [ ] **Step 1: Add variables, templates, and build stage**

Add the following to `.gitlab-ci.yml` after the existing content. Keep all existing quality/security/publish stages untouched.

Add `build` and `deploy` to the `stages` list (the existing stages are `quality`, `security`, `publish`):

```yaml
stages:
  - quality
  - security
  - publish
  - build
  - deploy
```

Add variables and templates at the top (after the existing `cache` block):

```yaml
variables:
  IMAGE_REPOSITORY: "naval-group/boilerplate"
  DEPLOY_JOB_IMAGE: "alpine/git:2.52.0"
  CONTAINER_REGISTRY_HOST: "registry-cyberlab-ngb.naval-group.dev"

.generate_id_token: &generate_id_token
  ID_TOKEN:
    aud: vault

.get-credentials:
  script:
    - mkdir -p /tmp /usr/local/bin
    - wget -qO /tmp/vault.zip ${VAULT_BINARY_URL}
    - unzip /tmp/vault.zip -d /usr/local/bin
    - chmod +x /usr/local/bin/vault
    - VAULT_TOKEN="$(vault write -field=token auth/jwt/login role=$DOCKER_VAULT_ROLE jwt=$ID_TOKEN)"
    - export VAULT_TOKEN
    - export USERNAME="$(vault kv get -field=username secrets/open-Digital-Factory/nexus/cyberlab-ngb)"
    - export PASSWORD="$(vault kv get -field=password secrets/open-Digital-Factory/nexus/cyberlab-ngb)"
```

- [ ] **Step 2: Add Kaniko base template**

```yaml
.kaniko_base:
  stage: build
  image:
    name: kaniko-project/executor:v1.24.0-debug
    entrypoint: [""]
  tags:
    - linux
    - docker
    - s_c1r2
  id_tokens: *generate_id_token
  before_script:
    - !reference [.get-credentials, script]
    - export DOCKER_PRIVATE_REGISTRY_EFFECTIVE="${CONTAINER_REGISTRY_HOST}"
    - echo "{\"auths\":{\"${DOCKER_PRIVATE_REGISTRY_EFFECTIVE}\":{\"auth\":\"$(printf "%s:%s" "${USERNAME}" "${PASSWORD}" | base64 | tr -d '\n')\"}}}" > /kaniko/.docker/config.json
  script:
    - |
      DESTINATION_IMAGE="${DOCKER_PRIVATE_REGISTRY_EFFECTIVE}/${IMAGE_REPOSITORY}:${CI_COMMIT_REF_SLUG}-${CI_COMMIT_SHORT_SHA}-${IMAGE_SUFFIX}"

      /kaniko/executor \
        --context="${CI_PROJECT_DIR}/${CONTEXT_DIR}" \
        --dockerfile="${CI_PROJECT_DIR}/${DOCKERFILE_PATH}" \
        --destination="${DESTINATION_IMAGE}" \
        --cache=true \
        --cache-repo="${DOCKER_PRIVATE_REGISTRY_EFFECTIVE}/${IMAGE_REPOSITORY}/cache" \
        --skip-tls-verify-registry="${DOCKER_PRIVATE_REGISTRY_EFFECTIVE}" \
        --registry-mirror="${DOCKER_DEFAULT_MIRROR}" \
        --snapshot-mode=redo \
        --use-new-run \
        --reproducible
```

- [ ] **Step 3: Add individual build jobs**

```yaml
image_build_main_backend:
  extends: .kaniko_base
  variables:
    CONTEXT_DIR: "."
    DOCKERFILE_PATH: "apps/main/backend/Dockerfile"
    IMAGE_SUFFIX: "main-backend"
  rules:
    - if: '$CI_COMMIT_REF_NAME == "dev"'
      changes:
        - apps/main/backend/**/*
        - packages/**/*
        - shared/**/*
    - when: never

image_build_main_frontend:
  extends: .kaniko_base
  variables:
    CONTEXT_DIR: "."
    DOCKERFILE_PATH: "apps/main/frontend/Dockerfile"
    IMAGE_SUFFIX: "main-frontend"
  rules:
    - if: '$CI_COMMIT_REF_NAME == "dev"'
      changes:
        - apps/main/frontend/**/*
        - packages/**/*
        - shared/**/*
    - when: never

image_build_tfc_backend:
  extends: .kaniko_base
  variables:
    CONTEXT_DIR: "."
    DOCKERFILE_PATH: "apps/tfc/backend/Dockerfile"
    IMAGE_SUFFIX: "tfc-backend"
  rules:
    - if: '$CI_COMMIT_REF_NAME == "dev"'
      changes:
        - apps/tfc/backend/**/*
    - when: never

image_build_tfc_frontend:
  extends: .kaniko_base
  variables:
    CONTEXT_DIR: "."
    DOCKERFILE_PATH: "apps/tfc/frontend/Dockerfile"
    IMAGE_SUFFIX: "tfc-frontend"
  rules:
    - if: '$CI_COMMIT_REF_NAME == "dev"'
      changes:
        - apps/tfc/frontend/**/*
        - packages/**/*
    - when: never

image_build_storybook:
  extends: .kaniko_base
  variables:
    CONTEXT_DIR: "."
    DOCKERFILE_PATH: "packages/react-ui/Dockerfile"
    IMAGE_SUFFIX: "storybook"
  rules:
    - if: '$CI_COMMIT_REF_NAME == "dev"'
      changes:
        - packages/react-ui/**/*
        - packages/react-headless/**/*
        - packages/design-system/**/*
    - when: never

image_build_keycloak:
  extends: .kaniko_base
  variables:
    CONTEXT_DIR: "."
    DOCKERFILE_PATH: "infra/keycloak/Dockerfile"
    IMAGE_SUFFIX: "keycloak"
  rules:
    - if: '$CI_COMMIT_REF_NAME == "dev"'
      changes:
        - infra/keycloak/**/*
    - when: never
```

- [ ] **Step 4: Add Flux manifest update deploy job**

```yaml
update_flux_manifests:
  stage: deploy
  image:
    name: ${DEPLOY_JOB_IMAGE}
    entrypoint: [""]
  tags:
    - linux
    - docker
    - s_c1r2
  resource_group: flux-dev
  needs:
    - job: image_build_main_backend
      optional: true
    - job: image_build_main_frontend
      optional: true
    - job: image_build_tfc_backend
      optional: true
    - job: image_build_tfc_frontend
      optional: true
    - job: image_build_storybook
      optional: true
    - job: image_build_keycloak
      optional: true
  rules:
    - if: '$CI_COMMIT_REF_NAME == "dev"'
      changes:
        - apps/**/*
        - packages/**/*
        - shared/**/*
        - infra/keycloak/**/*
    - when: never
  script:
    - |
      set -eu

      DOCKER_PRIVATE_REGISTRY_EFFECTIVE="${CONTAINER_REGISTRY_HOST}"
      TAG_PREFIX="${CI_COMMIT_REF_SLUG}-${CI_COMMIT_SHORT_SHA}"

      git config user.name "GitLab CI"
      git config user.email "gitlab-ci@developers.naval-group.com"

      git fetch origin "${CI_COMMIT_REF_NAME}"

      REMOTE_SHA="$(git rev-parse "origin/${CI_COMMIT_REF_NAME}")"
      if [ "${REMOTE_SHA}" != "${CI_COMMIT_SHA}" ]; then
        echo "Skipping manifest update for stale pipeline ${CI_COMMIT_SHA}; branch head is ${REMOTE_SHA}"
        exit 0
      fi

      git checkout -B "${CI_COMMIT_REF_NAME}" "origin/${CI_COMMIT_REF_NAME}"

      PATCH_DIR="clusters/dev/boilerplate"
      CHANGED=false

      for SUFFIX in main-backend main-frontend tfc-backend tfc-frontend storybook keycloak; do
        PATCH_FILE="${PATCH_DIR}/${SUFFIX}-patch.yaml"
        if [ -f "${PATCH_FILE}" ]; then
          IMAGE="${DOCKER_PRIVATE_REGISTRY_EFFECTIVE}/${IMAGE_REPOSITORY}:${TAG_PREFIX}-${SUFFIX}"
          sed -i "s|^\([[:space:]]*image:[[:space:]]*\).*|\1${IMAGE}|" "${PATCH_FILE}"
          if ! git diff --quiet -- "${PATCH_FILE}"; then
            CHANGED=true
          fi
        fi
      done

      if [ "${CHANGED}" = "false" ]; then
        echo "No manifest changes needed"
        exit 0
      fi

      git add ${PATCH_DIR}/*-patch.yaml
      git commit -m "ci: update Flux image tags for ${CI_COMMIT_SHORT_SHA} [skip ci]"

      if [ -n "${GITLAB_PUSH_TOKEN:-}" ]; then
        PUSH_USERNAME="${GITLAB_PUSH_USERNAME:-oauth2}"
        PUSH_URL="https://${PUSH_USERNAME}:${GITLAB_PUSH_TOKEN}@developers.naval-group.com/gitlab/naval-group/projects/cyberlab-ngb/boilerplate.git"
      elif [ -n "${CI_JOB_TOKEN:-}" ]; then
        PUSH_URL="https://gitlab-ci-token:${CI_JOB_TOKEN}@developers.naval-group.com/gitlab/naval-group/projects/cyberlab-ngb/boilerplate.git"
      else
        echo "No GitLab push token available" >&2
        exit 1
      fi

      git push "${PUSH_URL}" HEAD:${CI_COMMIT_REF_NAME}
  environment:
    name: dev
```

Note: The `needs` block uses `optional: true` because not all build jobs run on every commit (path-based triggers mean only changed services get rebuilt). The deploy job should still run if any build ran.

- [ ] **Step 5: Verify CI syntax**

```bash
# If you have gitlab-ci-lint or similar:
python3 -c "import yaml; yaml.safe_load(open('.gitlab-ci.yml'))" && echo "YAML valid"
```

- [ ] **Step 6: Commit**

```bash
git add .gitlab-ci.yml
git commit -m "feat: add Kaniko build and Flux deploy stages to GitLab CI"
```

---

### Task 10: Final validation

- [ ] **Step 1: Verify all Kustomize manifests render**

```bash
kubectl kustomize k8s/
kubectl kustomize clusters/dev/boilerplate/
```

Expected: Both produce valid YAML without errors.

- [ ] **Step 2: Verify directory structure matches spec**

```bash
find k8s/ clusters/ -type f | sort
```

Expected: All files from the spec's directory structure are present.

- [ ] **Step 3: Verify Docker builds still work**

```bash
docker build -f apps/main/backend/Dockerfile -t test-main-backend .
docker build -f apps/tfc/backend/Dockerfile -t test-tfc-backend .
```

Expected: Both succeed. (Frontend and storybook builds require npm install which may be slow — verify at least one backend build works.)

- [ ] **Step 4: Verify docker-compose still works**

The Dockerfile changes must not break existing docker-compose dev workflow. The docker-compose files set their own `context` and `dockerfile` paths, so the dev workflow should still work if the compose context is updated.

Check: `infra/docker-compose.yml` uses `context: ..` and `dockerfile: infra/keycloak/Dockerfile`. With the new Keycloak Dockerfile using `COPY infra/keycloak/...`, the context `..` (repo root) is correct. No compose changes needed.

Check: `infra/docker-compose.main.yml` uses `context: ..` and `dockerfile: apps/main/backend/Dockerfile`. With repo-root COPY paths, this is correct. No compose changes needed.

```bash
cd infra && docker compose -f docker-compose.yml config
```

Expected: Valid compose config output.

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git status
# Only commit if there are changes
git commit -m "fix: address validation issues in K8s manifests"
```
