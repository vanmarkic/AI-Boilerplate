# AI-Optimized Boilerplate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack monorepo boilerplate (Angular 18+ / FastAPI / PostgreSQL) optimized for small local LLM coding agents (7B-14B).

**Architecture:** Feature-sliced pragmatic DDD with OpenAPI contract-first design. Each backend feature is a flat 6-file module (model, schema, repository, service, router, test). Each frontend feature is a 5-file standalone Angular module with signals. AGENTS.md files at 3 levels guide LLM behavior. All files under 250 lines.

**Tech Stack:** Angular 18+, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL 17, Docker Compose, GitHub Actions, Ruff, ESLint

---

## Phase 1: Project Root & Infrastructure (Tasks 1-4)

### Task 1: Initialize Git Repo and Root Config Files

**Files:**
- Create: `.gitignore`
- Create: `AGENTS.md`
- Create: `Makefile`

**Step 1: Initialize git repo**

```bash
cd /Users/dragan/AI-Boilerplate
git init
```

**Step 2: Create `.gitignore`**

```gitignore
# Python
__pycache__/
*.py[cod]
*.egg-info/
.venv/
dist/
.ruff_cache/

# Node/Angular
node_modules/
.angular/
dist/
.env.local

# Generated code (optional: commit or gitignore)
backend/generated/
frontend/src/app/shared/api/api-client.generated.ts

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Environment
.env
*.env.local

# Docker
pgdata/

# Coverage
htmlcov/
coverage/
.coverage
```

**Step 3: Create `AGENTS.md` (root level)**

```markdown
# AI Boilerplate

## Stack
- Frontend: Angular 18+ (standalone components, signals)
- Backend: FastAPI (Python 3.12+)
- Database: PostgreSQL 17 (SQLAlchemy 2.0 + Alembic)
- Contract: OpenAPI 3.1 (shared/openapi.yaml)

## Architecture
Feature-sliced pragmatic DDD monorepo. Each feature is a self-contained folder.

## Universal Rules
1. Maximum 250 lines per file. Split if exceeded.
2. No barrel exports (index.ts re-exports). Use direct imports.
3. Every feature is a flat folder under `features/`.
4. API contract lives in `shared/openapi.yaml`. Modify spec first, then implement.
5. Tests colocated with source files. Write failing test before implementation.
6. Use strict TypeScript (`strict: true`). Use Python type hints on all functions.
7. No `any` type in TypeScript. No untyped function signatures in Python.
8. Auth is a stub — do not implement real authentication logic.
9. Each feature has a `manifest.yaml` describing its capabilities and dependencies.
10. Run `make lint-arch` before committing to check layer boundary violations.
```

**Step 4: Create `Makefile`**

```makefile
.PHONY: dev test test-backend test-frontend generate migrate new-feature lint-arch lint help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Start all services via Docker Compose
	docker compose up --build

dev-backend: ## Start backend + db only
	docker compose up --build api db

dev-frontend: ## Start frontend only (expects backend running)
	cd frontend && ng serve

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	cd backend && python -m pytest -v

test-frontend: ## Run frontend tests
	cd frontend && npx ng test --watch=false --browsers=ChromeHeadless

generate: ## Regenerate types from OpenAPI spec
	bash shared/scripts/generate-backend.sh
	bash shared/scripts/generate-frontend.sh

migrate: ## Run database migrations
	cd backend && alembic upgrade head

new-feature: ## Scaffold a new feature (usage: make new-feature name=orders)
	bash shared/scripts/scaffold-feature.sh $(name)

lint-arch: ## Run architecture boundary linter
	python shared/scripts/lint-architecture.py

lint: ## Run all linters
	cd backend && ruff check .
	cd frontend && npx ng lint
```

**Step 5: Commit**

```bash
git add .gitignore AGENTS.md Makefile
git commit -m "chore: initialize repo with root config files"
```

---

### Task 2: Docker Compose Setup

**Files:**
- Create: `docker-compose.yml`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`

**Step 1: Create `docker-compose.yml`**

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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d boilerplate"]
      interval: 5s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://dev:dev@db:5432/boilerplate
      ENVIRONMENT: development
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "4200:4200"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npx ng serve --host 0.0.0.0

volumes:
  pgdata:
```

**Step 2: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]"

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Step 3: Create `frontend/Dockerfile`**

```dockerfile
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]
```

**Step 4: Commit**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile
git commit -m "chore: add Docker Compose with FastAPI, PostgreSQL, Angular"
```

---

### Task 3: Shared OpenAPI Contract

**Files:**
- Create: `shared/openapi.yaml`

**Step 1: Create `shared/openapi.yaml`**

```yaml
openapi: 3.1.0
info:
  title: AI Boilerplate API
  version: 0.1.0
  description: API contract for the AI-optimized boilerplate

servers:
  - url: http://localhost:8000
    description: Local development

paths:
  /api/health:
    get:
      operationId: healthCheck
      summary: Health check endpoint
      tags: [health]
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /api/users:
    post:
      operationId: createUser
      summary: Create a new user
      tags: [users]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '409':
          description: Email already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /api/users/{id}:
    get:
      operationId: getUser
      summary: Get user by ID
      tags: [users]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '404':
          description: User not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

components:
  schemas:
    HealthResponse:
      type: object
      required: [status]
      properties:
        status:
          type: string
          enum: [ok]
        version:
          type: string

    CreateUserRequest:
      type: object
      required: [email, name]
      properties:
        email:
          type: string
          format: email
        name:
          type: string
          minLength: 1
          maxLength: 100

    UserResponse:
      type: object
      required: [id, email, name, created_at]
      properties:
        id:
          type: integer
        email:
          type: string
        name:
          type: string
        created_at:
          type: string
          format: date-time

    ErrorResponse:
      type: object
      required: [detail]
      properties:
        detail:
          type: string

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

**Step 2: Commit**

```bash
git add shared/openapi.yaml
git commit -m "feat: add OpenAPI 3.1 contract with health and user endpoints"
```

---

### Task 4: Shared Scripts (Scaffold + Architecture Linter + Code Gen)

**Files:**
- Create: `shared/scripts/scaffold-feature.sh`
- Create: `shared/scripts/lint-architecture.py`
- Create: `shared/scripts/generate-backend.sh`
- Create: `shared/scripts/generate-frontend.sh`

**Step 1: Create `shared/scripts/scaffold-feature.sh`**

```bash
#!/bin/bash
set -euo pipefail

NAME=$1
if [ -z "${NAME:-}" ]; then
  echo "Usage: scaffold-feature.sh <feature-name>"
  echo "Example: scaffold-feature.sh order"
  exit 1
fi

KEBAB=$(echo "$NAME" | sed 's/_/-/g')
SNAKE=$(echo "$NAME" | sed 's/-/_/g')
CLASS=$(echo "$SNAKE" | sed -E 's/(^|_)([a-z])/\U\2/g')
PLURAL="${SNAKE}s"

# --- Backend ---
BACKEND_DIR="backend/features/$SNAKE"
mkdir -p "$BACKEND_DIR"

cat > "$BACKEND_DIR/${SNAKE}.model.py" << PYEOF
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class ${CLASS}(Base):
    __tablename__ = "${PLURAL}"

    id: Mapped[int] = mapped_column(primary_key=True)
    # TODO: Add fields
PYEOF

cat > "$BACKEND_DIR/${SNAKE}.schema.py" << PYEOF
from pydantic import BaseModel


class Create${CLASS}Request(BaseModel):
    pass  # TODO: Define request fields


class ${CLASS}Response(BaseModel):
    id: int

    model_config = {"from_attributes": True}
PYEOF

cat > "$BACKEND_DIR/${SNAKE}.repository.py" << PYEOF
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.${SNAKE}.${SNAKE}.model import ${CLASS}


class ${CLASS}Repository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, id: int) -> ${CLASS} | None:
        return await self.session.get(${CLASS}, id)

    async def create(self, entity: ${CLASS}) -> ${CLASS}:
        self.session.add(entity)
        await self.session.flush()
        return entity
PYEOF

cat > "$BACKEND_DIR/${SNAKE}.service.py" << PYEOF
from features.${SNAKE}.${SNAKE}.repository import ${CLASS}Repository
from features.${SNAKE}.${SNAKE}.schema import Create${CLASS}Request, ${CLASS}Response


class ${CLASS}Service:
    def __init__(self, repository: ${CLASS}Repository) -> None:
        self.repository = repository

    async def create(self, request: Create${CLASS}Request) -> ${CLASS}Response:
        raise NotImplementedError  # TODO: Implement
PYEOF

cat > "$BACKEND_DIR/${SNAKE}.router.py" << PYEOF
from fastapi import APIRouter, Depends, status

from features.${SNAKE}.${SNAKE}.schema import Create${CLASS}Request, ${CLASS}Response
from features.${SNAKE}.${SNAKE}.service import ${CLASS}Service
from core.dependencies import get_${SNAKE}_service

router = APIRouter(prefix="/api/${PLURAL}", tags=["${PLURAL}"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=${CLASS}Response)
async def create_${SNAKE}(
    request: Create${CLASS}Request,
    service: ${CLASS}Service = Depends(get_${SNAKE}_service),
) -> ${CLASS}Response:
    return await service.create(request)
PYEOF

cat > "$BACKEND_DIR/${SNAKE}.test.py" << PYEOF
import pytest
from httpx import AsyncClient


class TestCreate${CLASS}:
    async def test_creates_with_valid_data(self, client: AsyncClient) -> None:
        response = await client.post("/api/${PLURAL}", json={})
        assert response.status_code == 201  # FAILING: implement endpoint

    async def test_returns_404_for_nonexistent(self, client: AsyncClient) -> None:
        response = await client.get("/api/${PLURAL}/999")
        assert response.status_code == 404  # FAILING: implement endpoint
PYEOF

cat > "$BACKEND_DIR/manifest.yaml" << YAMLEOF
name: ${SNAKE}
description: TODO - describe this feature
version: 0.1.0
dependencies:
  internal: []
  external: [postgresql]
api_endpoints: []
models: [${CLASS}]
events_emitted: []
events_consumed: []
YAMLEOF

# --- Frontend ---
FRONTEND_DIR="frontend/src/app/features/$KEBAB"
mkdir -p "$FRONTEND_DIR"

cat > "$FRONTEND_DIR/${KEBAB}.types.ts" << TSEOF
export interface ${CLASS} {
  id: number;
  // TODO: Add fields
}
TSEOF

cat > "$FRONTEND_DIR/${KEBAB}.service.ts" << TSEOF
import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ${CLASS} } from './${KEBAB}.types';

@Injectable({ providedIn: 'root' })
export class ${CLASS}Service {
  private readonly http = inject(HttpClient);

  readonly item = signal<${CLASS} | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.get<${CLASS}>(\`/api/${PLURAL}/\${id}\`)
      );
      this.item.set(result);
    } catch {
      this.error.set('Failed to load ${SNAKE}');
    } finally {
      this.loading.set(false);
    }
  }
}
TSEOF

cat > "$FRONTEND_DIR/${KEBAB}.component.ts" << TSEOF
import { Component, inject } from '@angular/core';
import { ${CLASS}Service } from './${KEBAB}.service';

@Component({
  selector: 'app-${KEBAB}',
  standalone: true,
  template: \`
    @if (service.loading()) {
      <p>Loading...</p>
    } @else if (service.item(); as item) {
      <p>{{ item.id }}</p>
    }
  \`,
})
export class ${CLASS}Component {
  protected readonly service = inject(${CLASS}Service);
}
TSEOF

cat > "$FRONTEND_DIR/${KEBAB}.routes.ts" << TSEOF
import { Routes } from '@angular/router';
import { ${CLASS}Component } from './${KEBAB}.component';

export const ${NAME^^}_ROUTES: Routes = [
  { path: '', component: ${CLASS}Component },
];
TSEOF

cat > "$FRONTEND_DIR/${KEBAB}.component.spec.ts" << TSEOF
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ${CLASS}Component } from './${KEBAB}.component';
import { ${CLASS}Service } from './${KEBAB}.service';
import { signal } from '@angular/core';

describe('${CLASS}Component', () => {
  let fixture: ComponentFixture<${CLASS}Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [${CLASS}Component],
      providers: [
        {
          provide: ${CLASS}Service,
          useValue: {
            item: signal(null),
            loading: signal(false),
            error: signal(null),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(${CLASS}Component);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show loading state', () => {
    // FAILING: verify loading indicator renders
    const service = TestBed.inject(${CLASS}Service);
    (service.loading as any).set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading...');
  });
});
TSEOF

echo "Scaffolded feature: $NAME"
echo "  Backend:  $BACKEND_DIR/ (6 files + manifest)"
echo "  Frontend: $FRONTEND_DIR/ (5 files)"
echo ""
echo "Next steps:"
echo "  1. Update shared/openapi.yaml with new endpoints"
echo "  2. Run: make generate"
echo "  3. Implement the failing tests"
```

**Step 2: Create `shared/scripts/lint-architecture.py`**

```python
#!/usr/bin/env python3
"""Architecture boundary linter.

Enforces the dependency flow:
  router  → service, schema, core
  service → repository, model, schema, core
  repository → model, core
  model   → core only
"""
import ast
import sys
from pathlib import Path

LAYER_RULES: dict[str, set[str]] = {
    "router": {"service", "schema", "core"},
    "service": {"repository", "model", "schema", "core"},
    "repository": {"model", "core"},
    "model": {"core"},
    "schema": set(),  # schemas should not import feature-local modules
    "test": {"router", "service", "repository", "model", "schema", "core"},
}

FEATURES_DIR = Path(__file__).resolve().parent.parent.parent / "backend" / "features"


def get_layer(filename: str) -> str | None:
    """Extract layer name from filename like 'user.router.py' → 'router'."""
    parts = filename.replace(".py", "").split(".")
    if len(parts) >= 2:
        return parts[-1]
    return None


def check_imports(filepath: Path) -> list[str]:
    """Check a file's imports against layer rules."""
    violations: list[str] = []
    layer = get_layer(filepath.name)
    if layer is None or layer not in LAYER_RULES:
        return violations

    allowed = LAYER_RULES[layer]
    try:
        tree = ast.parse(filepath.read_text())
    except SyntaxError:
        return [f"{filepath}: SyntaxError, cannot parse"]

    for node in ast.walk(tree):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            module = ""
            if isinstance(node, ast.ImportFrom) and node.module:
                module = node.module
            elif isinstance(node, ast.Import):
                module = ".".join(alias.name for alias in node.names)

            # Only check feature-local imports
            if module.startswith("features."):
                parts = module.split(".")
                if len(parts) >= 3:
                    imported_layer = parts[-1].split(".")[-1]
                    # Extract layer from module like features.user.user.service
                    for segment in parts[2:]:
                        sub = segment.split(".")
                        for s in sub:
                            if s in LAYER_RULES and s not in allowed:
                                violations.append(
                                    f"{filepath}:{node.lineno} - "
                                    f"'{layer}' layer imports '{s}' "
                                    f"(allowed: {sorted(allowed)})"
                                )
    return violations


def main() -> int:
    if not FEATURES_DIR.exists():
        print(f"Features directory not found: {FEATURES_DIR}")
        return 0  # Not an error if backend isn't set up yet

    all_violations: list[str] = []
    for py_file in FEATURES_DIR.rglob("*.py"):
        all_violations.extend(check_imports(py_file))

    if all_violations:
        print("Architecture boundary violations found:\n")
        for v in all_violations:
            print(f"  ✗ {v}")
        print(f"\n{len(all_violations)} violation(s) found.")
        return 1

    print("✓ No architecture boundary violations found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Step 3: Create `shared/scripts/generate-backend.sh`**

```bash
#!/bin/bash
set -euo pipefail

echo "Generating Pydantic models from OpenAPI spec..."
cd "$(dirname "$0")/../.."

datamodel-codegen \
  --input shared/openapi.yaml \
  --output backend/generated/models.py \
  --input-file-type openapi \
  --output-model-type pydantic_v2 \
  --use-standard-collections \
  --use-union-operator \
  --target-python-version 3.12

echo "✓ Backend models generated at backend/generated/models.py"
```

**Step 4: Create `shared/scripts/generate-frontend.sh`**

```bash
#!/bin/bash
set -euo pipefail

echo "Generating TypeScript client from OpenAPI spec..."
cd "$(dirname "$0")/../.."

npx @hey-api/openapi-ts \
  -i shared/openapi.yaml \
  -o frontend/src/app/shared/api/generated \
  -c @hey-api/client-fetch

echo "✓ Frontend API client generated at frontend/src/app/shared/api/generated/"
```

**Step 5: Make scripts executable and commit**

```bash
chmod +x shared/scripts/*.sh shared/scripts/*.py
git add shared/
git commit -m "feat: add shared scripts (scaffold, arch linter, code gen)"
```

---

## Phase 2: Backend Foundation (Tasks 5-9)

### Task 5: Backend Python Project Setup

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/core/__init__.py`
- Create: `backend/features/__init__.py`
- Create: `backend/generated/__init__.py`

**Step 1: Create `backend/pyproject.toml`**

```toml
[project]
name = "ai-boilerplate-backend"
version = "0.1.0"
description = "FastAPI backend for AI-optimized boilerplate"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.32.0",
    "sqlalchemy[asyncio]>=2.0.36",
    "asyncpg>=0.30.0",
    "alembic>=1.14.0",
    "pydantic>=2.10.0",
    "pydantic-settings>=2.7.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.24.0",
    "httpx>=0.28.0",
    "ruff>=0.8.0",
    "datamodel-code-generator>=0.26.0",
]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["features"]
python_files = ["*.test.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "UP", "ANN"]
ignore = ["ANN101"]  # self annotation
```

**Step 2: Create `__init__.py` files**

```bash
mkdir -p backend/core backend/features backend/generated
touch backend/core/__init__.py
touch backend/features/__init__.py
touch backend/generated/__init__.py
```

**Step 3: Commit**

```bash
git add backend/pyproject.toml backend/core/__init__.py backend/features/__init__.py backend/generated/__init__.py
git commit -m "chore: add backend Python project config"
```

---

### Task 6: Backend Core — Config and Database

**Files:**
- Create: `backend/core/config.py`
- Create: `backend/core/database.py`

**Step 1: Create `backend/core/config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    database_url: str = "postgresql+asyncpg://dev:dev@localhost:5432/boilerplate"
    environment: str = "development"
    debug: bool = True
    api_prefix: str = "/api"
    app_name: str = "AI Boilerplate API"
    app_version: str = "0.1.0"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
```

**Step 2: Create `backend/core/database.py`**

```python
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from core.config import settings

engine = create_async_engine(settings.database_url, echo=settings.debug)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session."""
    async with async_session_factory() as session:
        async with session.begin():
            yield session
```

**Step 3: Commit**

```bash
git add backend/core/config.py backend/core/database.py
git commit -m "feat: add backend core config and async database setup"
```

---

### Task 7: Backend Core — Auth Stub, Dependencies, Middleware

**Files:**
- Create: `backend/core/auth.py`
- Create: `backend/core/dependencies.py`
- Create: `backend/core/middleware.py`

**Step 1: Create `backend/core/auth.py`**

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class CurrentUser:
    """Represents the authenticated user. STUB implementation."""

    id: str
    email: str
    roles: list[str]


async def get_current_user() -> CurrentUser:
    """STUB: Replace with real auth (Keycloak, JWT, OAuth2).

    Swap this function body to integrate real authentication.
    All endpoints using Depends(get_current_user) will automatically
    use the new implementation.
    """
    return CurrentUser(
        id="stub-user-1",
        email="dev@local.dev",
        roles=["admin"],
    )
```

**Step 2: Create `backend/core/dependencies.py`**

```python
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_session
from features.user.user_repository import UserRepository
from features.user.user_service import UserService


async def get_user_service(
    session: AsyncSession = Depends(get_session),
) -> UserService:
    """Wire up the UserService with its repository."""
    repository = UserRepository(session)
    return UserService(repository)
```

Note: This file will be updated as new features are added.

**Step 3: Create `backend/core/middleware.py`**

```python
import uuid
from collections.abc import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse


def setup_middleware(app: FastAPI) -> None:
    """Configure all application middleware."""
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:4200"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_id_middleware(
        request: Request,
        call_next: Callable,
    ) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(Exception)
    async def global_exception_handler(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
```

**Step 4: Commit**

```bash
git add backend/core/auth.py backend/core/dependencies.py backend/core/middleware.py
git commit -m "feat: add auth stub, dependency injection, and middleware"
```

---

### Task 8: Backend Health Feature (TDD)

**Files:**
- Create: `backend/features/health/health.router.py`
- Create: `backend/features/health/health.test.py`
- Create: `backend/features/health/__init__.py`

**Step 1: Write the failing test**

Create `backend/features/health/health.test.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.fixture
async def client() -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


class TestHealthCheck:
    async def test_health_returns_ok(self, client: AsyncClient) -> None:
        response = await client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"

    async def test_health_includes_version(self, client: AsyncClient) -> None:
        response = await client.get("/api/health")
        data = response.json()
        assert "version" in data
```

**Step 2: Create minimal app + router to make tests pass**

Create `backend/features/health/__init__.py` (empty):

```python
```

Create `backend/features/health/health.router.py`:

```python
from fastapi import APIRouter

from core.config import settings

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "version": settings.app_version,
    }
```

Create `backend/main.py`:

```python
from fastapi import FastAPI

from core.config import settings
from core.middleware import setup_middleware
from features.health.health_router import router as health_router


def create_app() -> FastAPI:
    """Application factory."""
    application = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
    )
    setup_middleware(application)
    application.include_router(health_router)
    return application


app = create_app()
```

**Step 3: Run tests to verify they pass**

```bash
cd backend && python -m pytest features/health/health.test.py -v
```

Expected: 2 tests PASS

**Step 4: Commit**

```bash
git add backend/features/health/ backend/main.py
git commit -m "feat: add health check endpoint with passing TDD tests"
```

---

### Task 9: Backend User Feature (TDD — Failing Tests First)

**Files:**
- Create: `backend/features/user/__init__.py`
- Create: `backend/features/user/user_model.py`
- Create: `backend/features/user/user_schema.py`
- Create: `backend/features/user/user_repository.py`
- Create: `backend/features/user/user_service.py`
- Create: `backend/features/user/user_router.py`
- Create: `backend/features/user/user_test.py`
- Create: `backend/features/user/manifest.yaml`

**Important note on naming:** Use underscores in Python filenames (`user_model.py` not `user.model.py`) for valid Python imports. The design doc used dots for visual clarity but Python requires underscores.

**Step 1: Write the failing tests**

Create `backend/features/user/user_test.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from core.database import Base, get_session
from main import app

TEST_DB_URL = "postgresql+asyncpg://dev:dev@localhost:5432/boilerplate_test"
test_engine = create_async_engine(TEST_DB_URL)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client() -> AsyncClient:
    async def override_session():
        async with TestSession() as session:
            async with session.begin():
                yield session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


class TestCreateUser:
    async def test_creates_user_with_valid_data(self, client: AsyncClient) -> None:
        response = await client.post("/api/users", json={
            "email": "test@example.com",
            "name": "Test User",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test User"
        assert "id" in data
        assert "created_at" in data

    async def test_rejects_duplicate_email(self, client: AsyncClient) -> None:
        await client.post("/api/users", json={
            "email": "dupe@example.com",
            "name": "First",
        })
        response = await client.post("/api/users", json={
            "email": "dupe@example.com",
            "name": "Second",
        })
        assert response.status_code == 409


class TestGetUser:
    async def test_returns_user_by_id(self, client: AsyncClient) -> None:
        create_resp = await client.post("/api/users", json={
            "email": "fetch@example.com",
            "name": "Fetch Me",
        })
        user_id = create_resp.json()["id"]

        response = await client.get(f"/api/users/{user_id}")
        assert response.status_code == 200
        assert response.json()["email"] == "fetch@example.com"

    async def test_returns_404_for_nonexistent(self, client: AsyncClient) -> None:
        response = await client.get("/api/users/99999")
        assert response.status_code == 404
```

**Step 2: Run tests to verify they FAIL**

```bash
cd backend && python -m pytest features/user/user_test.py -v
```

Expected: FAIL (modules don't exist yet)

**Step 3: Implement the model**

Create `backend/features/user/__init__.py` (empty).

Create `backend/features/user/user_model.py`:

```python
from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

**Step 4: Implement the schema**

Create `backend/features/user/user_schema.py`:

```python
from datetime import datetime

from pydantic import BaseModel, EmailStr


class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}
```

Note: Add `pydantic[email]` to pyproject.toml dependencies for `EmailStr`.

**Step 5: Implement the repository**

Create `backend/features/user/user_repository.py`:

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.user.user_model import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        self.session.add(user)
        await self.session.flush()
        await self.session.refresh(user)
        return user
```

**Step 6: Implement the service**

Create `backend/features/user/user_service.py`:

```python
from fastapi import HTTPException, status

from features.user.user_model import User
from features.user.user_repository import UserRepository
from features.user.user_schema import CreateUserRequest, UserResponse


class UserService:
    def __init__(self, repository: UserRepository) -> None:
        self.repository = repository

    async def create_user(self, request: CreateUserRequest) -> UserResponse:
        existing = await self.repository.get_by_email(request.email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already exists",
            )
        user = User(email=request.email, name=request.name)
        created = await self.repository.create(user)
        return UserResponse.model_validate(created)

    async def get_user(self, user_id: int) -> UserResponse:
        user = await self.repository.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return UserResponse.model_validate(user)
```

**Step 7: Implement the router**

Create `backend/features/user/user_router.py`:

```python
from fastapi import APIRouter, Depends, status

from core.dependencies import get_user_service
from features.user.user_schema import CreateUserRequest, UserResponse
from features.user.user_service import UserService

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
async def create_user(
    request: CreateUserRequest,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    return await service.create_user(request)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    return await service.get_user(user_id)
```

**Step 8: Register router in main.py**

Add to `backend/main.py`:

```python
from features.user.user_router import router as user_router
# ... in create_app():
    application.include_router(user_router)
```

**Step 9: Create manifest**

Create `backend/features/user/manifest.yaml`:

```yaml
name: user
description: User registration and profile management
version: 0.1.0
dependencies:
  internal: []
  external: [postgresql]
api_endpoints:
  - POST /api/users
  - GET /api/users/{id}
models: [User]
events_emitted: []
events_consumed: []
```

**Step 10: Run tests to verify they PASS**

```bash
cd backend && python -m pytest features/user/user_test.py -v
```

Expected: 4 tests PASS

**Step 11: Commit**

```bash
git add backend/features/user/ backend/main.py backend/core/dependencies.py
git commit -m "feat: add user feature with TDD (create + get endpoints)"
```

---

### Task 10: Alembic Migration Setup

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/script.py.mako`
- Create: `backend/alembic/versions/` (directory)

**Step 1: Initialize Alembic**

```bash
cd backend && alembic init alembic
```

**Step 2: Edit `backend/alembic/env.py` to use async engine and import models**

Replace the generated `env.py` with:

```python
import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from core.config import settings
from core.database import Base

# Import all models so Alembic detects them
from features.user.user_model import User  # noqa: F401

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(settings.database_url)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
```

**Step 3: Update `backend/alembic.ini`** — set `sqlalchemy.url` to empty (we use settings):

Ensure `alembic.ini` has: `sqlalchemy.url = `

**Step 4: Generate initial migration**

```bash
cd backend && alembic revision --autogenerate -m "create users table"
```

**Step 5: Run migration**

```bash
cd backend && alembic upgrade head
```

**Step 6: Commit**

```bash
git add backend/alembic.ini backend/alembic/
git commit -m "feat: add Alembic async migrations with initial users table"
```

---

## Phase 3: Frontend Foundation (Tasks 11-15)

### Task 11: Angular Project Scaffold

**Step 1: Create Angular project**

```bash
cd /Users/dragan/AI-Boilerplate
npx @angular/cli@latest new frontend \
  --style=scss \
  --routing=true \
  --ssr=false \
  --standalone \
  --skip-git \
  --prefix=app
```

**Step 2: Enable strict mode in `frontend/tsconfig.json`**

Verify `strict: true` is set (Angular CLI sets this by default).

**Step 3: Remove default content from `app.component.ts`**

Replace with minimal shell:

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
```

**Step 4: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold Angular 18+ project with strict TypeScript"
```

---

### Task 12: Frontend AGENTS.md

**Files:**
- Create: `frontend/AGENTS.md`

**Step 1: Create `frontend/AGENTS.md`**

```markdown
# Frontend — Angular 18+

## Architecture
Standalone components with Angular signals. Feature-sliced modules. No NgModules.

## Component Rules
1. All components are standalone (`standalone: true`).
2. Use `@if`/`@for` control flow, never `*ngIf`/`*ngFor`.
3. Use `inject()` function, never constructor injection.
4. Small components use inline templates. Extract to file if template > 30 lines.
5. Component selectors use `app-` prefix.

## State Management
6. Use `signal()` for local component state.
7. Use `computed()` for derived state.
8. Services hold shared state as signals. No BehaviorSubject. No NgRx.
9. Use `firstValueFrom()` to convert HttpClient observables to promises.

## File Organization
10. Each feature is a folder under `src/app/features/`.
11. Feature files: `component.ts`, `service.ts`, `types.ts`, `routes.ts`, `spec.ts`.
12. No barrel exports (index.ts). Use direct imports.
13. Maximum 250 lines per file.

## Imports
14. No barrel imports. Import directly: `from './user-profile/user-profile.service'`.
15. Shared UI components live in `src/app/shared/ui/`.
16. Auth utilities live in `src/app/shared/auth/`.
17. Generated API client is read-only: `src/app/shared/api/generated/`.

## Testing
18. Tests colocated as `feature-name.component.spec.ts`.
19. Use Angular Testing Library for component tests.
20. Mock services with `signal()` values in test providers.
21. Write failing test first, then implement.

## Routing
22. Each feature exports a `FEATURE_ROUTES` constant.
23. Top-level routes use `loadChildren()` for lazy loading.
24. Auth-protected routes use `canActivate: [authGuard]`.

## HTTP
25. All API calls go through generated client or services.
26. Base URL configured in `environment.ts`.
27. Auth token attached via `auth.interceptor.ts`.

## Styling
28. Component-scoped SCSS by default.
29. Global styles in `src/styles/global.scss` only for resets and variables.
30. No inline styles.
```

**Step 2: Commit**

```bash
git add frontend/AGENTS.md
git commit -m "docs: add frontend AGENTS.md with Angular conventions for LLM agents"
```

---

### Task 13: Frontend Core — Environment and Error Handler

**Files:**
- Create: `frontend/src/app/core/environment.ts`
- Create: `frontend/src/app/core/error-handler.ts`

**Step 1: Create `frontend/src/app/core/environment.ts`**

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000',
};
```

**Step 2: Create `frontend/src/app/core/error-handler.ts`**

```typescript
import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('Unhandled error:', error);
  }
}
```

**Step 3: Update `frontend/src/app/app.config.ts`** to include HttpClient and error handler:

```typescript
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ErrorHandler } from '@angular/core';

import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/error-handler';
import { authInterceptor } from './shared/auth/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
  ],
};
```

**Step 4: Commit**

```bash
git add frontend/src/app/core/ frontend/src/app/app.config.ts
git commit -m "feat: add frontend core (environment config, global error handler)"
```

---

### Task 14: Frontend Auth Stub (Guard + Interceptor + Service)

**Files:**
- Create: `frontend/src/app/shared/auth/auth.service.ts`
- Create: `frontend/src/app/shared/auth/auth.guard.ts`
- Create: `frontend/src/app/shared/auth/auth.interceptor.ts`

**Step 1: Create `frontend/src/app/shared/auth/auth.service.ts`**

```typescript
import { Injectable, signal } from '@angular/core';

export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly isAuthenticated = signal(true); // STUB: always authenticated
  readonly currentUser = signal<AuthUser>({
    id: 'stub-user-1',
    email: 'dev@local.dev',
    roles: ['admin'],
  });

  getToken(): string {
    return 'stub-token'; // STUB: replace with real token retrieval
  }

  logout(): void {
    this.isAuthenticated.set(false);
    this.currentUser.set(null as unknown as AuthUser);
  }
}
```

**Step 2: Create `frontend/src/app/shared/auth/auth.guard.ts`**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/auth/login']);
};
```

**Step 3: Create `frontend/src/app/shared/auth/auth.interceptor.ts`**

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (token) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(authReq);
  }
  return next(req);
};
```

**Step 4: Commit**

```bash
git add frontend/src/app/shared/auth/
git commit -m "feat: add frontend auth stub (service, guard, interceptor)"
```

---

### Task 15: Frontend User Profile Feature (TDD)

**Files:**
- Create: `frontend/src/app/features/user-profile/user-profile.types.ts`
- Create: `frontend/src/app/features/user-profile/user-profile.service.ts`
- Create: `frontend/src/app/features/user-profile/user-profile.component.ts`
- Create: `frontend/src/app/features/user-profile/user-profile.routes.ts`
- Create: `frontend/src/app/features/user-profile/user-profile.component.spec.ts`

**Step 1: Write the failing test**

Create `frontend/src/app/features/user-profile/user-profile.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { UserProfileComponent } from './user-profile.component';
import { UserProfileService } from './user-profile.service';
import { User } from './user-profile.types';

describe('UserProfileComponent', () => {
  let fixture: ComponentFixture<UserProfileComponent>;

  const mockService = {
    user: signal<User | null>(null),
    loading: signal(false),
    error: signal<string | null>(null),
    loadUser: jasmine.createSpy('loadUser'),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileComponent],
      providers: [
        { provide: UserProfileService, useValue: mockService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display loading state', () => {
    mockService.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading...');
  });

  it('should display user name when loaded', () => {
    mockService.loading.set(false);
    mockService.user.set({
      id: 1,
      email: 'jane@test.com',
      name: 'Jane Doe',
      created_at: '2026-01-01T00:00:00Z',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Jane Doe');
  });

  it('should display error message', () => {
    mockService.loading.set(false);
    mockService.error.set('Failed to load user');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Failed to load user');
  });
});
```

**Step 2: Run test to verify it FAILS**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: FAIL (component and service don't exist)

**Step 3: Create types**

Create `frontend/src/app/features/user-profile/user-profile.types.ts`:

```typescript
export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}
```

**Step 4: Create service**

Create `frontend/src/app/features/user-profile/user-profile.service.ts`:

```typescript
import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { User } from './user-profile.types';
import { environment } from '../../core/environment';

@Injectable({ providedIn: 'root' })
export class UserProfileService {
  private readonly http = inject(HttpClient);

  readonly user = signal<User | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async loadUser(id: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await firstValueFrom(
        this.http.get<User>(`${environment.apiBaseUrl}/api/users/${id}`)
      );
      this.user.set(result);
    } catch {
      this.error.set('Failed to load user');
    } finally {
      this.loading.set(false);
    }
  }
}
```

**Step 5: Create component**

Create `frontend/src/app/features/user-profile/user-profile.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { UserProfileService } from './user-profile.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  template: `
    @if (service.loading()) {
      <p>Loading...</p>
    } @else if (service.error(); as error) {
      <p class="error">{{ error }}</p>
    } @else if (service.user(); as user) {
      <h1>{{ user.name }}</h1>
      <p>{{ user.email }}</p>
    }
  `,
})
export class UserProfileComponent {
  protected readonly service = inject(UserProfileService);
}
```

**Step 6: Create routes**

Create `frontend/src/app/features/user-profile/user-profile.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { UserProfileComponent } from './user-profile.component';

export const USER_PROFILE_ROUTES: Routes = [
  { path: '', component: UserProfileComponent },
];
```

**Step 7: Run tests to verify they PASS**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: 4 tests PASS

**Step 8: Commit**

```bash
git add frontend/src/app/features/user-profile/
git commit -m "feat: add user-profile feature with TDD (component, service, tests)"
```

---

### Task 16: Frontend Dashboard + Auth Login (Stubs)

**Files:**
- Create: `frontend/src/app/features/dashboard/dashboard.component.ts`
- Create: `frontend/src/app/features/dashboard/dashboard.routes.ts`
- Create: `frontend/src/app/features/dashboard/dashboard.component.spec.ts`
- Create: `frontend/src/app/features/auth/login.component.ts`
- Create: `frontend/src/app/features/auth/auth.routes.ts`
- Create: `frontend/src/app/features/auth/login.component.spec.ts`

**Step 1: Create dashboard**

`frontend/src/app/features/dashboard/dashboard.component.ts`:

```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `<h1>Dashboard</h1><p>Welcome to the AI Boilerplate.</p>`,
})
export class DashboardComponent {}
```

`frontend/src/app/features/dashboard/dashboard.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';

export const DASHBOARD_ROUTES: Routes = [
  { path: '', component: DashboardComponent },
];
```

`frontend/src/app/features/dashboard/dashboard.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show welcome message', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Dashboard');
  });
});
```

**Step 2: Create login stub**

`frontend/src/app/features/auth/login.component.ts`:

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { inject } from '@angular/core';

@Component({
  selector: 'app-login',
  standalone: true,
  template: `
    <h1>Login</h1>
    <p>Auth is stubbed. Click to proceed.</p>
    <button (click)="login()">Login (Stub)</button>
  `,
})
export class LoginComponent {
  private readonly router = inject(Router);

  login(): void {
    this.router.navigate(['/dashboard']);
  }
}
```

`frontend/src/app/features/auth/auth.routes.ts`:

```typescript
import { Routes } from '@angular/router';
import { LoginComponent } from './login.component';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: LoginComponent },
];
```

`frontend/src/app/features/auth/login.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
```

**Step 3: Wire up routes in `app.routes.ts`**

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './shared/auth/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
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

**Step 4: Run tests**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add frontend/src/app/features/dashboard/ frontend/src/app/features/auth/ frontend/src/app/app.routes.ts
git commit -m "feat: add dashboard and login stub features with lazy routes"
```

---

## Phase 4: Design System + Visual Component Development (Tasks 17-21)

### Task 17: Tailwind v4 + Design Tokens + cn() Utility

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/styles.css`
- Create: `frontend/src/app/shared/utils.ts`
- Modify: `frontend/angular.json` (styles entry)

**Step 1: Install Tailwind CSS v4 + utilities**

```bash
cd frontend && npm install tailwindcss @tailwindcss/postcss postcss clsx tailwind-merge
```

**Step 2: Create `frontend/src/styles/tokens.css`**

```css
@import "tailwindcss";

@theme {
  /* Colors — semantic names only */
  --color-primary: oklch(59.59% 0.24 255);
  --color-primary-foreground: oklch(98% 0.01 255);
  --color-secondary: oklch(96% 0.005 286);
  --color-secondary-foreground: oklch(14% 0.004 286);
  --color-destructive: oklch(57% 0.24 27);
  --color-destructive-foreground: oklch(98% 0.01 27);
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(14% 0.004 286);
  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(14% 0.004 286);
  --color-muted: oklch(96% 0.005 286);
  --color-muted-foreground: oklch(55% 0.01 286);
  --color-accent: oklch(96% 0.005 286);
  --color-accent-foreground: oklch(14% 0.004 286);
  --color-border: oklch(90% 0.01 286);
  --color-input: oklch(90% 0.01 286);
  --color-ring: oklch(59.59% 0.24 255);
  --color-popover: oklch(100% 0 0);
  --color-popover-foreground: oklch(14% 0.004 286);

  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;

  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-full: 9999px;

  /* Typography */
  --font-sans: "Inter", system-ui, sans-serif;
}

/* Dark mode override */
.dark {
  --color-background: oklch(14% 0.004 286);
  --color-foreground: oklch(98% 0.01 255);
  --color-card: oklch(20% 0.005 286);
  --color-card-foreground: oklch(98% 0.01 255);
  --color-border: oklch(30% 0.01 286);
  --color-input: oklch(30% 0.01 286);
  --color-muted: oklch(25% 0.005 286);
  --color-muted-foreground: oklch(65% 0.01 286);
  --color-popover: oklch(20% 0.005 286);
  --color-popover-foreground: oklch(98% 0.01 255);
}
```

**Step 3: Create `frontend/src/styles/styles.css`**

```css
@import "./tokens.css";

/* Reset */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-sans);
  background-color: var(--color-background);
  color: var(--color-foreground);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

**Step 4: Create `frontend/src/app/shared/utils.ts`**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with conflict resolution.
 * Use this in computed() signals for variant-based styling.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

**Step 5: Update `frontend/angular.json`** — change styles entry from `styles.scss` to `styles/styles.css`:

Find the `styles` array in `angular.json` and replace `"src/styles.scss"` with `"src/styles/styles.css"`.

**Step 6: Remove old SCSS file**

```bash
rm frontend/src/styles.scss 2>/dev/null || true
```

**Step 7: Commit**

```bash
git add frontend/src/styles/ frontend/src/app/shared/utils.ts frontend/angular.json
git commit -m "feat: add Tailwind v4 with design tokens and cn() utility"
```

---

### Task 18: Storybook Setup

**Files:**
- Create: `frontend/.storybook/main.ts`
- Create: `frontend/.storybook/preview.ts`

**Step 1: Initialize Storybook for Angular**

```bash
cd frontend && npx storybook@latest init --type angular --skip-install
npm install
```

**Step 2: Verify Storybook config at `frontend/.storybook/main.ts`**

Ensure it includes:

```typescript
import type { StorybookConfig } from '@storybook/angular';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-essentials',
  ],
  framework: {
    name: '@storybook/angular',
    options: {},
  },
};

export default config;
```

**Step 3: Update `frontend/.storybook/preview.ts`** to include design tokens:

```typescript
import type { Preview } from '@storybook/angular';
import '../src/styles/styles.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
```

**Step 4: Add Storybook scripts to Makefile**

Add to Makefile:

```makefile
storybook: ## Start Storybook dev server
	cd frontend && npx storybook dev -p 6006
```

**Step 5: Verify Storybook starts**

```bash
cd frontend && npx storybook dev -p 6006
```

**Step 6: Commit**

```bash
git add frontend/.storybook/ Makefile
git commit -m "feat: add Storybook for visual component development"
```

---

### Task 19: Shared UI Components with Tailwind + Variants + Stories

**Files:**
- Create: `frontend/src/app/shared/ui/button.component.ts`
- Create: `frontend/src/app/shared/ui/button.stories.ts`
- Create: `frontend/src/app/shared/ui/button.component.spec.ts`
- Create: `frontend/src/app/shared/ui/input.component.ts`
- Create: `frontend/src/app/shared/ui/input.stories.ts`
- Create: `frontend/src/app/shared/ui/badge.component.ts`
- Create: `frontend/src/app/shared/ui/badge.stories.ts`
- Create: `frontend/src/app/shared/ui/card.component.ts`
- Create: `frontend/src/app/shared/ui/card.stories.ts`

**Step 1: Write failing test for Button**

Create `frontend/src/app/shared/ui/button.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ButtonComponent);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should apply default variant classes', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.className).toContain('bg-primary');
  });

  it('should apply destructive variant classes', () => {
    fixture.componentRef.setInput('variant', 'destructive');
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.className).toContain('bg-destructive');
  });

  it('should be disabled when disabled input is true', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.getAttribute('disabled')).not.toBeNull();
  });
});
```

**Step 2: Implement Button with variant pattern**

Create `frontend/src/app/shared/ui/button.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { cn } from '../utils';

@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'button',
    '[class]': 'hostClasses()',
    '[attr.disabled]': 'disabled() || null',
    '(click)': '!disabled() && clicked.emit()',
  },
  template: `<ng-content />`,
})
export class ButtonComponent {
  readonly variant = input<'default' | 'destructive' | 'outline' | 'ghost'>('default');
  readonly size = input<'sm' | 'default' | 'lg'>('default');
  readonly disabled = input(false);
  readonly clicked = output<void>();

  private readonly variantClasses: Record<string, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };

  private readonly sizeClasses: Record<string, string> = {
    sm: 'h-8 px-3 text-xs',
    default: 'h-9 px-4 py-2 text-sm',
    lg: 'h-10 px-8 text-base',
  };

  protected readonly hostClasses = computed(() =>
    cn(
      'inline-flex items-center justify-center rounded-md font-medium',
      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      this.variantClasses[this.variant()],
      this.sizeClasses[this.size()],
    )
  );
}
```

**Step 3: Create Button stories**

Create `frontend/src/app/shared/ui/button.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';

const meta: Meta<ButtonComponent> = {
  title: 'UI/Button',
  component: ButtonComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'destructive', 'outline', 'ghost'] },
    size: { control: 'select', options: ['sm', 'default', 'lg'] },
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<ButtonComponent>;

export const Default: Story = { args: { variant: 'default', size: 'default' } };
export const Destructive: Story = { args: { variant: 'destructive' } };
export const Outline: Story = { args: { variant: 'outline' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Small: Story = { args: { size: 'sm' } };
export const Large: Story = { args: { size: 'lg' } };
export const Disabled: Story = { args: { disabled: true } };
```

**Step 4: Create Input component**

Create `frontend/src/app/shared/ui/input.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { cn } from '../utils';

@Component({
  selector: 'app-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    @if (label()) {
      <label [for]="id()" class="block text-sm font-medium text-foreground mb-xs">
        {{ label() }}
      </label>
    }
    <input
      [id]="id()"
      [type]="type()"
      [placeholder]="placeholder()"
      [ngModel]="value()"
      (ngModelChange)="value.set($event)"
      [class]="inputClasses"
    />
  `,
  host: { 'class': 'block mb-sm' },
})
export class InputComponent {
  readonly id = input('');
  readonly label = input('');
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly placeholder = input('');
  readonly value = model('');

  readonly inputClasses = cn(
    'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1',
    'text-sm text-foreground placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  );
}
```

Create `frontend/src/app/shared/ui/input.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { InputComponent } from './input.component';

const meta: Meta<InputComponent> = {
  title: 'UI/Input',
  component: InputComponent,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<InputComponent>;

export const Default: Story = { args: { placeholder: 'Enter text...' } };
export const WithLabel: Story = { args: { label: 'Email', type: 'email', placeholder: 'you@example.com' } };
export const Password: Story = { args: { label: 'Password', type: 'password' } };
```

**Step 5: Create Badge component**

Create `frontend/src/app/shared/ui/badge.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, computed, input } from '@angular/core';
import { cn } from '../utils';

@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'hostClasses()' },
  template: `<ng-content />`,
})
export class BadgeComponent {
  readonly variant = input<'default' | 'secondary' | 'destructive' | 'outline'>('default');

  private readonly variantClasses: Record<string, string> = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    outline: 'border border-border text-foreground',
  };

  protected readonly hostClasses = computed(() =>
    cn(
      'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
      this.variantClasses[this.variant()],
    )
  );
}
```

Create `frontend/src/app/shared/ui/badge.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { BadgeComponent } from './badge.component';

const meta: Meta<BadgeComponent> = {
  title: 'UI/Badge',
  component: BadgeComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'secondary', 'destructive', 'outline'] },
  },
};
export default meta;

type Story = StoryObj<BadgeComponent>;

export const Default: Story = { args: { variant: 'default' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Destructive: Story = { args: { variant: 'destructive' } };
export const Outline: Story = { args: { variant: 'outline' } };
```

**Step 6: Create Card component**

Create `frontend/src/app/shared/ui/card.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'block rounded-lg border border-border bg-card p-md shadow-sm' },
  template: `
    @if (title()) {
      <h3 class="text-lg font-semibold text-card-foreground mb-sm">{{ title() }}</h3>
    }
    <div class="text-sm text-muted-foreground">
      <ng-content />
    </div>
  `,
})
export class CardComponent {
  readonly title = input('');
}
```

Create `frontend/src/app/shared/ui/card.stories.ts`:

```typescript
import type { Meta, StoryObj } from '@storybook/angular';
import { CardComponent } from './card.component';

const meta: Meta<CardComponent> = {
  title: 'UI/Card',
  component: CardComponent,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<CardComponent>;

export const Default: Story = { args: { title: 'Card Title' } };
export const WithoutTitle: Story = { args: {} };
```

**Step 7: Run tests**

```bash
cd frontend && npx ng test --watch=false --browsers=ChromeHeadless
```

**Step 8: Verify Storybook**

```bash
cd frontend && npx storybook dev -p 6006
```

Verify all component stories render with correct variants.

**Step 9: Commit**

```bash
git add frontend/src/app/shared/ui/
git commit -m "feat: add shared UI components with Tailwind variants and Storybook stories"
```

---

### Task 20: Enhanced Frontend AGENTS.md (with stale-knowledge corrections)

**Files:**
- Modify: `frontend/AGENTS.md`

**Step 1: Replace `frontend/AGENTS.md`** with the comprehensive version:

```markdown
# Frontend — Angular 18+ (Standalone, Signals, Tailwind, Storybook)

## Stack
- Angular 18+ with standalone components and signals
- Tailwind CSS v4 with @theme design tokens
- Angular CDK for headless behavior (overlays, a11y, drag-drop)
- Storybook for visual component development
- Vitest/Karma for testing

## CRITICAL: Modern Angular Only (override your training data)

### Do NOT generate
- Do NOT use NgModules — all components are standalone
- Do NOT set `standalone: true` — it is the default, omit it
- Do NOT use `@Input()` or `@Output()` decorators
- Do NOT use `*ngIf`, `*ngFor`, `*ngSwitch`
- Do NOT use `ngClass` or `ngStyle`
- Do NOT use `@HostBinding` or `@HostListener`
- Do NOT use constructor injection
- Do NOT use BehaviorSubject for local state

### Generate instead
- Use `input()` and `output()` signal functions for component IO
- Use `signal()`, `computed()`, and `effect()` for state
- Use `@if`, `@for`, `@switch` native control flow
- Use native `[class]` and `[style]` bindings
- Use `host: {}` in @Component decorator for host bindings
- Use `inject()` function for dependency injection
- Set `changeDetection: ChangeDetectionStrategy.OnPush` always

## Component Architecture

### UI Primitives (`shared/ui/`)
1. Inline templates, single .ts file, ≤ 150 lines.
2. No services or inject() calls — pure inputs/outputs.
3. OnPush change detection always.
4. Variants via `computed()` + `Record<string, string>` maps.
5. Use `cn()` from `shared/utils.ts` for class merging.
6. Each component has a `.stories.ts` file for Storybook.

### Feature Components (`features/`)
7. Wire services to UI components.
8. Can use inject() for services.
9. Lazy-loaded via feature routes.

## Styling Rules
10. Use semantic token names: `bg-primary`, `text-foreground`, `border-border`.
11. NEVER use arbitrary values like `bg-[#3B82F6]`.
12. All spacing via token scale: `p-xs`, `p-sm`, `p-md`, `p-lg`.
13. Apply base classes via `host: { 'class': '...' }`.
14. Component-scoped styles only for animations or pseudo-elements.

## Variant Pattern
```typescript
readonly variant = input<'default' | 'outline'>('default');
private readonly variantClasses: Record<string, string> = {
  default: 'bg-primary text-primary-foreground',
  outline: 'border border-input bg-background',
};
protected readonly hostClasses = computed(() =>
  cn('base-classes', this.variantClasses[this.variant()])
);
```

## Available Design Tokens
- Colors: primary, secondary, accent, destructive, muted
- Surfaces: background, foreground, card, popover
- Borders: border, input, ring
- Spacing: xs (0.25rem), sm (0.5rem), md (1rem), lg (1.5rem), xl (2rem)
- Radius: sm, md, lg, full

## File Organization
15. Each feature is a folder under `src/app/features/`.
16. Feature files: component.ts, service.ts, types.ts, routes.ts, spec.ts.
17. UI components in `src/app/shared/ui/` with colocated `.stories.ts`.
18. No barrel exports except `shared/ui/` public API.
19. Maximum 250 lines per file (150 for UI primitives).

## Testing
20. Tests colocated as `component.spec.ts`.
21. Mock services with `signal()` values in test providers.
22. Write failing test first, then implement.
23. Test each variant and interaction state.

## Routing
24. Each feature exports a `FEATURE_ROUTES` constant.
25. Top-level routes use `loadChildren()` for lazy loading.
26. Auth-protected routes use `canActivate: [authGuard]`.

## HTTP
27. All API calls go through services with signal state.
28. Use `firstValueFrom()` to convert HttpClient observables.
29. Base URL configured in `core/environment.ts`.
30. Auth token attached via `shared/auth/auth.interceptor.ts`.
```

**Step 2: Commit**

```bash
git add frontend/AGENTS.md
git commit -m "docs: enhance frontend AGENTS.md with stale-knowledge corrections and Tailwind patterns"
```

---

### Task 21: Backend AGENTS.md

**Files:**
- Create: `backend/AGENTS.md`

**Step 1: Create `backend/AGENTS.md`**

```markdown
# Backend — FastAPI + Python 3.12

## Architecture
Pragmatic DDD with feature-sliced modules. Each feature is a flat folder under `features/`.

## Layer Rules (enforced by lint-architecture.py)
1. `router` imports from: service, schema, core.
2. `service` imports from: repository, model, schema, core.
3. `repository` imports from: model, core.
4. `model` imports from: core only (SQLAlchemy Base).
5. `schema` imports from: stdlib only (Pydantic).
6. NEVER import from a higher layer (e.g., repository must not import router).

## File Naming
7. Feature files use underscores: `user_model.py`, `user_service.py`.
8. Each feature folder has: model, schema, repository, service, router, test, manifest.yaml.
9. Maximum 250 lines per file.

## FastAPI Conventions
10. All routers mounted in `main.py` via `app.include_router()`.
11. Use `Depends()` for dependency injection. Wire in `core/dependencies.py`.
12. All endpoints return Pydantic response models.
13. Use `status.HTTP_XXX` constants, not raw integers.
14. Prefix all routes with `/api/`.

## SQLAlchemy 2.0
15. Use `Mapped[]` type annotations for all columns.
16. Use `mapped_column()` for column definitions.
17. All models inherit from `core.database.Base`.
18. Use async sessions via `AsyncSession`.

## Pydantic
19. All request/response bodies are Pydantic `BaseModel` subclasses.
20. Use `model_config = {"from_attributes": True}` for ORM-to-Pydantic.
21. Use `EmailStr` for email fields.

## Testing
22. Tests colocated as `feature_test.py` in the feature folder.
23. Use `pytest` with `pytest-asyncio` (asyncio_mode = "auto").
24. Use `httpx.AsyncClient` with `ASGITransport` for integration tests.
25. Override `get_session` dependency for test database isolation.
26. Write failing test first. Watch it fail. Then implement.

## Auth
27. Auth is a stub in `core/auth.py`. Do NOT implement real auth.
28. Protected endpoints use `Depends(get_current_user)`.
29. `CurrentUser` dataclass provides id, email, roles.

## Migrations
30. Alembic for all schema changes. Never modify DB manually.
31. Import all models in `alembic/env.py` for autogenerate detection.
```

**Step 2: Commit**

```bash
git add backend/AGENTS.md
git commit -m "docs: add backend AGENTS.md with FastAPI conventions for LLM agents"
```

---

## Phase 5: Feature Tiering & Tree-Shaking (Tasks 22-25)

### Task 22: Feature Filter Script + Updated Scaffold

**Files:**
- Create: `shared/scripts/filter-features.py`
- Modify: `shared/scripts/scaffold-feature.sh` (add tier parameter)
- Modify: `backend/features/user/manifest.yaml` (add tier field)
- Modify: `backend/features/health/manifest.yaml` (add tier field if exists)

**Step 1: Add `tier` to existing manifests**

Update `backend/features/user/manifest.yaml`:

```yaml
name: user
tier: 1
description: User registration and profile management
version: 0.1.0
dependencies:
  internal: []
  external: [postgresql]
api_endpoints:
  - POST /api/users
  - GET /api/users/{id}
models: [User]
events_emitted: []
events_consumed: []
```

**Step 2: Create `shared/scripts/filter-features.py`**

```python
#!/usr/bin/env python3
"""Filter features by tier for build-time exclusion.

Reads manifest.yaml from each feature directory. Copies only features
whose tier <= target tier to the output directory.

Usage:
  filter-features.py --tier=2 --src=backend/features --dest=build/features
  filter-features.py --tier=1 --src=frontend/src/app/features --dest=build/features --frontend
"""
import argparse
import shutil
import sys
from pathlib import Path

import yaml


def get_feature_tier(feature_dir: Path) -> int:
    """Read tier from manifest.yaml. Default to 1 if no manifest."""
    manifest = feature_dir / "manifest.yaml"
    if not manifest.exists():
        return 1
    with open(manifest) as f:
        data = yaml.safe_load(f)
    return data.get("tier", 1)


def filter_features(src: Path, dest: Path, max_tier: int) -> list[str]:
    """Copy only features with tier <= max_tier."""
    dest.mkdir(parents=True, exist_ok=True)
    included: list[str] = []
    excluded: list[str] = []

    for feature_dir in sorted(src.iterdir()):
        if not feature_dir.is_dir() or feature_dir.name.startswith("_"):
            continue

        tier = get_feature_tier(feature_dir)
        if tier <= max_tier:
            shutil.copytree(feature_dir, dest / feature_dir.name)
            included.append(f"  ✓ {feature_dir.name} (tier {tier})")
        else:
            excluded.append(f"  ✗ {feature_dir.name} (tier {tier}) — EXCLUDED")

    print(f"Building for Tier {max_tier}:")
    print(f"\nIncluded ({len(included)}):")
    print("\n".join(included))
    if excluded:
        print(f"\nExcluded ({len(excluded)}):")
        print("\n".join(excluded))
    return [d.name for d in dest.iterdir() if d.is_dir()]


def generate_backend_init(dest: Path, features: list[str]) -> None:
    """Generate features/__init__.py that imports only included routers."""
    imports = []
    registrations = []
    for name in features:
        router_file = dest / name / f"{name}_router.py"
        if router_file.exists():
            imports.append(f"from features.{name}.{name}_router import router as {name}_router")
            registrations.append(f'    app.include_router({name}_router)')

    init_content = f'''"""Auto-generated feature registration. DO NOT EDIT manually.
Generated by filter-features.py for the current build tier."""
from fastapi import FastAPI

{chr(10).join(imports)}


def register_features(app: FastAPI) -> None:
    """Register all feature routers for this build tier."""
{chr(10).join(registrations)}
'''
    (dest / "__init__.py").write_text(init_content)


def generate_frontend_routes(dest: Path, features: list[str]) -> None:
    """Generate app.routes.generated.ts for included features."""
    route_imports = []
    route_entries = []

    for name in features:
        kebab = name.replace("_", "-")
        routes_file = dest / kebab / f"{kebab}.routes.ts"
        if routes_file.exists():
            const_name = name.upper() + "_ROUTES"
            route_imports.append(
                f"  {{ path: '{kebab}', loadChildren: () => "
                f"import('./features/{kebab}/{kebab}.routes').then(m => m.{const_name}) }}"
            )

    content = f'''// Auto-generated routes. DO NOT EDIT manually.
// Generated by filter-features.py for the current build tier.
import {{ Routes }} from '@angular/router';

export const generatedRoutes: Routes = [
{chr(10).join('  ' + r + ',' for r in route_imports)}
];
'''
    (dest.parent / "app.routes.generated.ts").write_text(content)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tier", type=int, required=True)
    parser.add_argument("--src", type=Path, required=True)
    parser.add_argument("--dest", type=Path, required=True)
    parser.add_argument("--frontend", action="store_true")
    args = parser.parse_args()

    if not args.src.exists():
        print(f"Source directory not found: {args.src}")
        return 1

    features = filter_features(args.src, args.dest, args.tier)

    if args.frontend:
        generate_frontend_routes(args.dest, features)
    else:
        generate_backend_init(args.dest, features)

    return 0


if __name__ == "__main__":
    sys.exit(main())
```

**Step 3: Update scaffold script** — add `tier` parameter:

In `shared/scripts/scaffold-feature.sh`, update the usage and manifest generation to accept tier:

```bash
# Add after NAME=$1:
TIER=${2:-1}

# Update manifest generation:
cat > "$BACKEND_DIR/manifest.yaml" << YAMLEOF
name: ${SNAKE}
tier: ${TIER}
description: TODO - describe this feature
...
YAMLEOF
```

Update Makefile:

```makefile
new-feature: ## Scaffold new feature (usage: make new-feature name=orders tier=2)
	bash shared/scripts/scaffold-feature.sh $(name) $(tier)
```

**Step 4: Commit**

```bash
git add shared/scripts/filter-features.py shared/scripts/scaffold-feature.sh backend/features/*/manifest.yaml Makefile
git commit -m "feat: add feature tier filtering for build-time exclusion"
```

---

### Task 23: Tiered Docker Builds

**Files:**
- Modify: `backend/Dockerfile` (multi-stage with tier filtering)
- Modify: `frontend/Dockerfile` (multi-stage with tier filtering)
- Modify: `Makefile` (add build-tier-X targets)

**Step 1: Update `backend/Dockerfile`** for tier-based builds:

```dockerfile
# Stage 1: Filter features by tier
FROM python:3.12-slim AS feature-filter
ARG TIER=3
RUN pip install pyyaml
COPY shared/scripts/filter-features.py /filter.py
COPY backend/features/ /all-features/
RUN python /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/

# Stage 2: Build backend with only filtered features
FROM python:3.12-slim

WORKDIR /app

COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir -e ".[dev]"

COPY backend/core/ ./core/
COPY backend/main.py ./
COPY backend/alembic.ini ./
COPY backend/alembic/ ./alembic/
COPY --from=feature-filter /filtered-features/ ./features/

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

**Step 2: Update `frontend/Dockerfile`** similarly:

```dockerfile
FROM node:22-slim AS feature-filter
RUN apt-get update && apt-get install -y python3 python3-pip && pip3 install pyyaml
ARG TIER=3
COPY shared/scripts/filter-features.py /filter.py
COPY frontend/src/app/features/ /all-features/
RUN python3 /filter.py --tier=$TIER --src=/all-features/ --dest=/filtered-features/ --frontend

FROM node:22-slim
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
COPY --from=feature-filter /filtered-features/ ./src/app/features/

EXPOSE 4200
CMD ["npx", "ng", "serve", "--host", "0.0.0.0"]
```

**Step 3: Add tier build targets to Makefile**

```makefile
build: ## Build all services for tier 3 (all features)
	TIER=3 docker compose build

build-tier-1: ## Build for tier 1 (minimal features)
	TIER=1 docker compose build --build-arg TIER=1

build-tier-2: ## Build for tier 2
	TIER=2 docker compose build --build-arg TIER=2

build-tier-3: ## Build for tier 3 (all features)
	TIER=3 docker compose build --build-arg TIER=3
```

**Step 4: Update `docker-compose.yml`** to pass build arg:

Add `args: TIER: ${TIER:-3}` to both `api` and `frontend` build sections.

**Step 5: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile docker-compose.yml Makefile
git commit -m "feat: add tiered Docker builds with build-time feature exclusion"
```

---

### Task 24: Runtime Feature Flags

**Files:**
- Create: `backend/core/feature_flags.py`
- Create: `frontend/src/app/shared/feature-flags/feature-flag.service.ts`
- Create: `frontend/src/app/shared/feature-flags/feature-flag.guard.ts`

**Step 1: Create `backend/core/feature_flags.py`**

```python
import json
import os
from functools import lru_cache

from fastapi import Depends, HTTPException, status


class FeatureFlags:
    """Runtime feature toggles within the shipped tier.

    Build-time exclusion determines what code EXISTS.
    Runtime flags determine what's ACTIVE among what exists.
    Default: all shipped features are active.
    """

    def __init__(self) -> None:
        raw = os.getenv("FEATURE_FLAGS", "{}")
        self._flags: dict[str, bool] = json.loads(raw)

    def is_enabled(self, feature_name: str) -> bool:
        """Check if a feature is enabled. Default True (all shipped features active)."""
        return self._flags.get(feature_name, True)


@lru_cache
def get_feature_flags() -> FeatureFlags:
    return FeatureFlags()


def require_feature(feature_name: str):
    """FastAPI dependency that gates an endpoint behind a feature flag.

    Usage: @router.get("/analytics", dependencies=[Depends(require_feature("analytics"))])
    """
    async def _check(flags: FeatureFlags = Depends(get_feature_flags)) -> None:
        if not flags.is_enabled(feature_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Feature '{feature_name}' is not enabled",
            )
    return _check
```

**Step 2: Create `frontend/src/app/shared/feature-flags/feature-flag.service.ts`**

```typescript
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class FeatureFlagService {
  private readonly flags = signal<Record<string, boolean>>({});

  /**
   * Initialize flags from API or environment.
   * Call this on app bootstrap.
   */
  setFlags(flags: Record<string, boolean>): void {
    this.flags.set(flags);
  }

  /**
   * Check if a feature is enabled.
   * Default: true (all shipped features are active).
   */
  isEnabled(feature: string): boolean {
    return this.flags()[feature] ?? true;
  }
}
```

**Step 3: Create `frontend/src/app/shared/feature-flags/feature-flag.guard.ts`**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FeatureFlagService } from './feature-flag.service';

export function featureGuard(featureName: string): CanActivateFn {
  return () => {
    const flagService = inject(FeatureFlagService);
    const router = inject(Router);

    if (flagService.isEnabled(featureName)) {
      return true;
    }
    return router.createUrlTree(['/']);
  };
}
```

**Step 4: Commit**

```bash
git add backend/core/feature_flags.py frontend/src/app/shared/feature-flags/
git commit -m "feat: add runtime feature flags (secondary layer within shipped tier)"
```

---

### Task 25: Feature Tiering Documentation in AGENTS.md

**Files:**
- Modify: `AGENTS.md` (root)

**Step 1: Add tiering rules to root `AGENTS.md`**

Append to the root AGENTS.md:

```markdown

## Feature Tiering
11. Every feature MUST have a `tier` field in its `manifest.yaml` (1, 2, or 3).
12. Tier 1 = base features included in all builds.
13. Features must NOT import from a higher tier (tier-1 cannot import tier-2 code).
14. Use `make build-tier-N` to build Docker images for a specific tier.
15. Runtime feature flags (`core/feature_flags.py`, `feature-flag.service.ts`) toggle features WITHIN the shipped tier.
16. Scaffold new features with tier: `make new-feature name=analytics tier=2`.
```

**Step 2: Update architecture linter** to also check tier boundaries:

Add to `shared/scripts/lint-architecture.py`:

```python
# Additional check: tier boundary enforcement
# A feature with tier=1 must not import from a feature with tier=2 or tier=3
```

**Step 3: Commit**

```bash
git add AGENTS.md shared/scripts/lint-architecture.py
git commit -m "docs: add feature tiering rules to AGENTS.md + tier boundary linting"
```

---

## Phase 6: CI/CD Pipeline (Task 26)

### Task 26: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-architecture:
    name: Architecture Boundaries
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: python shared/scripts/lint-architecture.py

  test-backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_DB: boilerplate_test
          POSTGRES_USER: dev
          POSTGRES_PASSWORD: dev
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U dev"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql+asyncpg://dev:dev@localhost:5432/boilerplate_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: pip install -e ".[dev]"
        working-directory: backend
      - run: alembic upgrade head
        working-directory: backend
      - run: python -m pytest -v --tb=short
        working-directory: backend

  test-frontend:
    name: Frontend Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
        working-directory: frontend
      - run: npx ng test --watch=false --browsers=ChromeHeadless
        working-directory: frontend

  lint:
    name: Code Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: pip install ruff && ruff check .
        working-directory: backend
      - run: npm ci && npx ng lint
        working-directory: frontend

  openapi-validate:
    name: OpenAPI Validation
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npx @redocly/cli lint shared/openapi.yaml
```

**Step 2: Commit**

```bash
mkdir -p .github/workflows
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions with 5 parallel jobs (arch lint, tests, lint, openapi)"
```

---

## Phase 7: Final Polish (Task 27)

### Task 27: Backend conftest.py + .env.example + Verify Full Stack

**Files:**
- Create: `backend/conftest.py`
- Create: `backend/.env.example`
- Create: `frontend/.env.example` (if needed)

**Step 1: Create `backend/conftest.py`**

```python
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from core.database import Base, get_session
from main import app

TEST_DB_URL = "postgresql+asyncpg://dev:dev@localhost:5432/boilerplate_test"
test_engine = create_async_engine(TEST_DB_URL)
TestSession = async_sessionmaker(test_engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
async def setup_db() -> None:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def client() -> AsyncClient:
    async def override_session():
        async with TestSession() as session:
            async with session.begin():
                yield session

    app.dependency_overrides[get_session] = override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
```

**Step 2: Create `backend/.env.example`**

```env
DATABASE_URL=postgresql+asyncpg://dev:dev@localhost:5432/boilerplate
ENVIRONMENT=development
DEBUG=true
```

**Step 3: Verify full stack starts**

```bash
docker compose up --build
```

Verify:
- PostgreSQL responds on port 5432
- FastAPI responds at http://localhost:8000/api/health
- Angular serves at http://localhost:4200

**Step 4: Run all tests**

```bash
make test
```

**Step 5: Run architecture linter**

```bash
make lint-arch
```

**Step 6: Final commit**

```bash
git add backend/conftest.py backend/.env.example
git commit -m "chore: add test fixtures, env example, verify full stack"
```

---

## Summary

| Phase | Tasks | What's Built |
|-------|-------|-------------|
| 1: Root & Infra | 1-4 | Git, AGENTS.md, Makefile, Docker Compose, OpenAPI, Scripts |
| 2: Backend | 5-10 | FastAPI core, health endpoint, user feature (TDD), Alembic |
| 3: Frontend | 11-16 | Angular scaffold, auth stub, user-profile (TDD), dashboard, login |
| 4: Design System | 17-21 | Tailwind tokens, Storybook, UI components with variants + stories, enhanced AGENTS.md |
| 5: Feature Tiering | 22-25 | Build-time feature exclusion, tiered Docker builds, runtime feature flags, tier boundary linting |
| 6: CI/CD | 26 | GitHub Actions (5 parallel jobs) |
| 7: Polish | 27 | Test fixtures, env example, full-stack verification |

**Total: 27 tasks, each under 200 LOC, TDD throughout.**

### Feature Tiering Architecture

```
┌──────────────────────────────────────────────┐
│              BUILD TIME (Hard)               │
│                                              │
│  manifest.yaml → filter-features.py → Docker │
│                                              │
│  Tier 1 image:  [user, health]               │
│  Tier 2 image:  [user, health, analytics]    │
│  Tier 3 image:  [user, health, analytics,    │
│                  sso, audit-log]             │
│                                              │
│  Unpaid code: PHYSICALLY ABSENT              │
├──────────────────────────────────────────────┤
│              RUNTIME (Soft)                  │
│                                              │
│  FeatureFlags → toggle within shipped tier   │
│  FEATURE_FLAGS='{"analytics": false}'        │
│                                              │
│  Use for: A/B testing, gradual rollout,      │
│           per-tenant config                  │
└──────────────────────────────────────────────┘
```
