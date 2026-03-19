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
9. Maximum 350 lines per file (500 for test files).

## FastAPI Conventions
10. Routers are auto-discovered from `features/*/` by `main.py`. No manual registration needed.
11. Use `Depends()` for dependency injection. Dependencies are auto-appended to `core/dependencies.py` by `scaffold-feature.sh`. Use lazy imports inside factory functions.
12. All endpoints return Pydantic response models.
13. Use `status.HTTP_XXX` constants, not raw integers.
14. Prefix all routes with `/api/`.

## SQLAlchemy 2.0
15. Use `Mapped[]` type annotations for all columns.
16. Use `mapped_column()` for column definitions.
17. All models inherit from `core.database.Base`.
18. Use async sessions via `AsyncSession`.

## Base Classes (in `core/`)
- `ResponseBase` (`core/base_schema.py`): extends `BaseModel` with `from_attributes`. All response schemas extend this.
- `CrudRepository[T]` (`core/base_repository.py`): generic CRUD repo with `get_by_id`, `list`, `create`, `delete`. Feature repos extend this and add custom queries.

## Pydantic
19. Request bodies extend `BaseModel`. Response bodies extend `ResponseBase` from `core/base_schema.py`.
20. `ResponseBase` already sets `model_config = {"from_attributes": True}` — do NOT repeat it.
21. Use `EmailStr` for email fields.

## Testing
22. Tests colocated as `feature_test.py` in the feature folder.
23. Use `pytest` with `pytest-asyncio` (asyncio_mode = "auto").
24. Use `httpx.AsyncClient` with `ASGITransport` for integration tests.
25. Override `get_session` dependency for test database isolation.
26. Write failing test first. Watch it fail. Then implement.

## Auth (Keycloak)
27. Auth uses Keycloak OIDC. `core/auth.py` validates JWTs via PyJWT + JWKS.
28. Protected endpoints use `Depends(get_current_user)`.
29. `CurrentUser` dataclass provides id, email, roles (extracted from JWT claims).
30. Keycloak config: `settings.keycloak_url`, `settings.keycloak_realm`, `settings.keycloak_audience`.

## Migrations
30. Alembic for all schema changes. Never modify DB manually.
31. Import all models in `alembic/env.py` for autogenerate detection.

## Common Pitfalls
- Do NOT import from a higher layer (e.g., `repository` must not import from `service`).
- Do NOT return raw dicts from endpoints — always use Pydantic response models.
- Do NOT use raw HTTP status integers — use `status.HTTP_200_OK` etc.
- Do NOT skip type hints on any function signature.
- Do NOT wire dependencies inline — use `core/dependencies.py` (auto-appended by scaffold).
- Do NOT manually register routers in `main.py` — auto-discovery handles it.
- Do NOT repeat `model_config = {"from_attributes": True}` — extend `ResponseBase` instead.
- Do NOT modify the DB schema manually — always use Alembic migrations.
