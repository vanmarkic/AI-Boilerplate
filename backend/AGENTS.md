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

## Common Pitfalls
- Do NOT import from a higher layer (e.g., `repository` must not import from `service`).
- Do NOT return raw dicts from endpoints — always use Pydantic response models.
- Do NOT use raw HTTP status integers — use `status.HTTP_200_OK` etc.
- Do NOT skip type hints on any function signature.
- Do NOT wire dependencies inline — use `core/dependencies.py`.
- Do NOT modify the DB schema manually — always use Alembic migrations.
