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


class Create${CLASS}Request(BaseModel):
    pass  # TODO: Define request fields


class ${CLASS}Response(BaseModel):
    id: int

    model_config = {"from_attributes": True}
PYEOF

cat > "$BACKEND_DIR/${SNAKE}_repository.py" << PYEOF
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.${SNAKE}.${SNAKE}_model import ${CLASS}


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

cat > "$BACKEND_DIR/${SNAKE}_service.py" << PYEOF
from features.${SNAKE}.${SNAKE}_repository import ${CLASS}Repository
from features.${SNAKE}.${SNAKE}_schema import Create${CLASS}Request, ${CLASS}Response


class ${CLASS}Service:
    def __init__(self, repository: ${CLASS}Repository) -> None:
        self.repository = repository

    async def create(self, request: Create${CLASS}Request) -> ${CLASS}Response:
        raise NotImplementedError  # TODO: Implement
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
PYEOF

cat > "$BACKEND_DIR/${SNAKE}_test.py" << PYEOF
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
tier: 1
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
