#!/usr/bin/env bash
set -euo pipefail

NAME=$1
TIER=${2:-1}
if [ -z "${NAME:-}" ]; then
  echo "Usage: scaffold-feature.sh <feature-name> [tier]"
  echo "Example: scaffold-feature.sh order 2"
  exit 1
fi

KEBAB=$(echo "$NAME" | sed 's/_/-/g')
SNAKE=$(echo "$NAME" | sed 's/-/_/g')
CLASS=$(echo "$SNAKE" | awk -F_ '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1' OFS='')
UPPER=$(echo "$SNAKE" | tr '[:lower:]' '[:upper:]')
PLURAL="${SNAKE}s"

# --- Backend ---
BACKEND_DIR="backend/features/$SNAKE"
mkdir -p "$BACKEND_DIR"

cat > "$BACKEND_DIR/${SNAKE}_model.py" << PYEOF
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from core.database import Base


class ${CLASS}(Base):
    __tablename__ = "${PLURAL}"

    id: Mapped[int] = mapped_column(primary_key=True)
    # TODO: Add fields
PYEOF

cat > "$BACKEND_DIR/${SNAKE}_schema.py" << PYEOF
from pydantic import BaseModel

from core.base_schema import ResponseBase


class Create${CLASS}Request(BaseModel):
    pass  # TODO: Define request fields


class ${CLASS}Response(ResponseBase):
    id: int
    # TODO: Add response fields
PYEOF

cat > "$BACKEND_DIR/${SNAKE}_repository.py" << PYEOF
from sqlalchemy.ext.asyncio import AsyncSession

from core.base_repository import CrudRepository
from features.${SNAKE}.${SNAKE}_model import ${CLASS}


class ${CLASS}Repository(CrudRepository[${CLASS}]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session, ${CLASS})

    # Add custom queries here (e.g., get_by_status, search)
PYEOF

cat > "$BACKEND_DIR/${SNAKE}_service.py" << PYEOF
from fastapi import HTTPException, status

from features.${SNAKE}.${SNAKE}_model import ${CLASS}
from features.${SNAKE}.${SNAKE}_repository import ${CLASS}Repository
from features.${SNAKE}.${SNAKE}_schema import Create${CLASS}Request, ${CLASS}Response


class ${CLASS}Service:
    def __init__(self, repository: ${CLASS}Repository) -> None:
        self.repository = repository

    async def create(self, request: Create${CLASS}Request) -> ${CLASS}Response:
        raise NotImplementedError  # TODO: Implement creation logic

    async def get_by_id(self, ${SNAKE}_id: int) -> ${CLASS}Response:
        entity = await self.repository.get_by_id(${SNAKE}_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="${CLASS} not found",
            )
        return ${CLASS}Response.model_validate(entity)
PYEOF

cat > "$BACKEND_DIR/${SNAKE}_router.py" << PYEOF
from fastapi import APIRouter, Depends, status

from features.${SNAKE}.${SNAKE}_schema import Create${CLASS}Request, ${CLASS}Response
from features.${SNAKE}.${SNAKE}_service import ${CLASS}Service
from core.dependencies import get_${SNAKE}_service

router = APIRouter(prefix="/api/${PLURAL}", tags=["${PLURAL}"])


@router.post("", status_code=status.HTTP_201_CREATED, response_model=${CLASS}Response)
async def create_${SNAKE}(
    request: Create${CLASS}Request,
    service: ${CLASS}Service = Depends(get_${SNAKE}_service),
) -> ${CLASS}Response:
    return await service.create(request)


@router.get("/{${SNAKE}_id}", response_model=${CLASS}Response)
async def get_${SNAKE}(
    ${SNAKE}_id: int,
    service: ${CLASS}Service = Depends(get_${SNAKE}_service),
) -> ${CLASS}Response:
    return await service.get_by_id(${SNAKE}_id)
PYEOF

cat > "$BACKEND_DIR/${SNAKE}_test.py" << PYEOF
from httpx import AsyncClient


class TestCreate${CLASS}:
    async def test_creates_with_valid_data(self, client: AsyncClient) -> None:
        response = await client.post("/api/${PLURAL}", json={})
        assert response.status_code == 201  # FAILING: implement endpoint

    async def test_returns_404_for_nonexistent(self, client: AsyncClient) -> None:
        response = await client.get("/api/${PLURAL}/999")
        assert response.status_code == 404
PYEOF

cat > "$BACKEND_DIR/manifest.yaml" << YAMLEOF
name: ${SNAKE}
tier: ${TIER}
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

cat > "$BACKEND_DIR/__init__.py" << PYEOF
PYEOF

# --- Auto-append dependency wiring ---
cat >> "backend/core/dependencies.py" << PYEOF


async def get_${SNAKE}_service(
    session: AsyncSession = Depends(get_session),
) -> "${CLASS}Service":  # noqa: F821
    """Wire up the ${CLASS}Service with its repository."""
    from features.${SNAKE}.${SNAKE}_repository import ${CLASS}Repository
    from features.${SNAKE}.${SNAKE}_service import ${CLASS}Service

    repository = ${CLASS}Repository(session)
    return ${CLASS}Service(repository)
PYEOF

# --- Frontend ---
FRONTEND_DIR="frontend/src/app/features/$KEBAB"
mkdir -p "$FRONTEND_DIR"

cat > "$FRONTEND_DIR/${KEBAB}.types.ts" << TSEOF
export interface ${CLASS} {
  id: number;
  // TODO: Add fields
}
TSEOF

cat > "$FRONTEND_DIR/${KEBAB}.store.ts" << TSEOF
import { patchState, signalStore, withMethods } from '@ngrx/signals';
import { withResource } from '../../shared/data/with-resource';
import { ${CLASS} } from './${KEBAB}.types';

export const ${CLASS}Store = signalStore(
  { providedIn: 'root' },
  withResource<${CLASS}>(),
  withMethods((store) => ({
    async load(id: number): Promise<void> {
      const result = await store.run('load ${SNAKE}', async () => {
        // TODO: Replace with generated API client function after running make generate
        // Example: const { data } = await get${CLASS}({ path: { ${SNAKE}_id: id } });
        throw new Error('Not implemented');
      });
      if (result) {
        patchState(store, { item: result });
      }
    },
  })),
);
TSEOF

cat > "$FRONTEND_DIR/${KEBAB}.component.ts" << TSEOF
import { Component, inject } from '@angular/core';
import { ${CLASS}Store } from './${KEBAB}.store';

@Component({
  selector: 'app-${KEBAB}',
  template: \`
    @if (store.loading()) {
      <p>Loading...</p>
    } @else if (store.error(); as error) {
      <p class="error">{{ error }}</p>
    } @else if (store.item(); as item) {
      <p>{{ item.id }}</p>
    }
  \`,
})
export class ${CLASS}Component {
  protected readonly store = inject(${CLASS}Store);
}
TSEOF

cat > "$FRONTEND_DIR/${KEBAB}.routes.ts" << TSEOF
import { Routes } from '@angular/router';
import { ${CLASS}Component } from './${KEBAB}.component';

export const ${UPPER}_ROUTES: Routes = [
  { path: '', component: ${CLASS}Component },
];
TSEOF

cat > "$FRONTEND_DIR/${KEBAB}.component.spec.ts" << TSEOF
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ${CLASS}Component } from './${KEBAB}.component';
import { ${CLASS}Store } from './${KEBAB}.store';
import { signal } from '@angular/core';

describe('${CLASS}Component', () => {
  let fixture: ComponentFixture<${CLASS}Component>;

  const mockStore = {
    item: signal(null),
    items: signal([]),
    loading: signal(false),
    error: signal(null),
    run: vi.fn(),
    load: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [${CLASS}Component],
      providers: [
        { provide: ${CLASS}Store, useValue: mockStore },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(${CLASS}Component);
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should show loading state', () => {
    mockStore.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading...');
  });
});
TSEOF

cat > "$FRONTEND_DIR/manifest.yaml" << YAMLEOF
name: ${KEBAB}
tier: ${TIER}
description: TODO - describe this feature
YAMLEOF

echo ""
echo "Scaffolded feature: $NAME (tier $TIER)"
echo "  Backend:  $BACKEND_DIR/ (6 files + manifest)"
echo "  Frontend: $FRONTEND_DIR/ (5 files + manifest)"
echo ""
echo "  ✓ Router auto-discovered by main.py (no manual registration needed)"
echo "  ✓ Dependency factory auto-appended to core/dependencies.py"
echo ""
echo "Next steps:"
echo "  1. Fill in the TODO markers with your domain model"
echo "  2. Create migration: cd backend && alembic revision --autogenerate -m 'add ${SNAKE}'"
echo "  3. Run: make generate  (regenerates TS client with new endpoints)"
echo "  4. Update the store's load() to use the generated API client function"
echo "  5. Run: make validate"
echo ""
echo "See: docs/conventions/feature-workflow.md"
