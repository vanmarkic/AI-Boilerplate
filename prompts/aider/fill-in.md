# Fill In Feature

You are filling in a scaffolded feature. The skeleton files already exist (created by `make new-feature`). Your job is to replace every `TODO` marker with real implementation.

## Inputs

- **SPECS.md** — has the domain model, business rules, and user stories for this feature
- **shared/openapi.yaml** — has the API contract (endpoints, request/response schemas)
- **Skeleton files** — have the structure, you fill in the content

## Process

For each file, follow TDD:

1. **Test first** — write a failing test for the behavior described in SPECS.md
2. **Watch it fail** — confirm the failure message makes sense
3. **Implement** — write the minimal code to pass the test
4. **Watch it pass** — confirm all tests still green

### Order of work

1. **Model** (`*_model.py`) — add fields from domain model
2. **Schema** (`*_schema.py`) — add request/response fields, validation rules
3. **Repository** (`*_repository.py`) — add query methods
4. **Service** (`*_service.py`) — add business logic from business rules
5. **Router** (`*_router.py`) — wire endpoints to match openapi.yaml
6. **Test** (`*_test.py`) — fill in test cases for each endpoint
7. **Frontend types** (`*.types.ts`) — add fields matching API response
8. **Frontend service** (`*.service.ts`) — add methods for each endpoint
9. **Frontend component** (`*.component.ts`) — add UI for the feature
10. **Frontend spec** (`*.component.spec.ts`) — add component tests

### After filling in

- Update `manifest.yaml` with `api_endpoints` and `business_rules`
- Create the Alembic migration: `cd backend && alembic revision --autogenerate -m 'add <feature>'`

## Rules

- No file > 250 lines. Split if exceeded.
- No `any` in TypeScript. No untyped functions in Python.
- Auth stays a stub — use `Depends(get_current_user)` on protected endpoints.
- Use the generated API client (`shared/api/generated/`) in frontend, not raw HttpClient.
- Follow layer boundaries: router → service → repository → model.

## When stuck

- Check SPECS.md for business rules
- Check shared/openapi.yaml for the API contract
- Check AGENTS.md (root, backend, frontend) for coding conventions
- Ask the user if requirements are unclear
