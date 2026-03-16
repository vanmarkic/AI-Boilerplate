# PostgREST API Evaluation

## What Is PostgREST?

PostgREST is a standalone Haskell binary that sits directly on PostgreSQL and auto-generates a RESTful API from the database schema. No application code — you define tables, views, and functions in SQL, and PostgREST exposes them as endpoints. Auth is handled via JWT + PostgreSQL Row-Level Security (RLS).

---

## Option A: Replace FastAPI with PostgREST

### Pros

1. **Zero boilerplate CRUD** — a new table is instantly an API endpoint. Eliminates the model → schema → repository → service → router chain for simple data access.
2. **Performance** — direct SQL with prepared statements and connection pooling. No ORM overhead, no Python async event loop.
3. **Powerful query language out of the box** — filtering (`?age=gt.18`), ordering, pagination, resource embedding (`?select=*,orders(*)`) with zero backend code.
4. **Database as source of truth** — schema, constraints, RLS policies, and functions all live in PostgreSQL. Alembic migrations become the single place to define both data structure and API behavior.
5. **OpenAPI spec generation** — auto-generates an OpenAPI spec that could feed into the existing `@hey-api/openapi-ts` pipeline.

### Cons

1. **Architectural mismatch** — the project has a well-defined layered architecture (Router → Service → Repository → ORM). PostgREST bypasses all of it, creating two parallel API systems.
2. **Business logic moves to PL/pgSQL** — validation, orchestration, event emission, and business rules must move to PostgreSQL functions/triggers. PL/pgSQL is harder to test, debug, and maintain — especially for LLM agents optimized for Python/TypeScript.
3. **Auth integration complexity** — the project uses Keycloak + JWT + Python-side validation (`core/auth.py`). PostgREST requires JWT claims mapping to PostgreSQL roles and RLS policies — a completely different auth model to maintain alongside.
4. **Breaks the code-first contract** — current workflow is Pydantic → FastAPI → OpenAPI → TypeScript client. PostgREST reverses this to SQL table → OpenAPI → TypeScript client. Two different sources of truth.
5. **Feature-slicing doesn't map** — self-contained feature folders with manifest.yaml, colocated tests, and tier-based filtering can't accommodate features scattered across SQL migrations and PostgreSQL schema objects.
6. **Testing story degrades** — colocated pytest-asyncio + httpx tests can't easily cover PostgREST endpoints. Requires running PostgREST container or raw SQL tests.
7. **Another service to operate** — adds a container to docker-compose, another process to health-check, version, and configure.

### Verdict: Not recommended as a replacement.

---

## Option B: Hybrid Model (PostgREST for CRUD, FastAPI for Logic)

PostgREST handles basic CRUD automatically. When an endpoint needs validation, orchestration, or business rules, FastAPI "overrides" it.

### Pros

1. **Dramatically less boilerplate for simple features** — new tables become CRUD APIs with no Python code. Cuts 4-5 files per feature for data-centric operations.
2. **Faster iteration** — adding a column or table updates the API automatically after migration. No Python changes needed.
3. **FastAPI stays focused** — only handles endpoints with real business logic, keeping services lean and meaningful.
4. **Advanced querying for free** — every PostgREST-managed table gets filtering, sorting, pagination, partial responses, and resource embedding.
5. **SQL views as an API design tool** — curated views for dashboards, reports, and aggregations without writing Python.

### Cons

1. **Two mental models** — developers must know "Is this endpoint PostgREST or FastAPI?" for every feature. When requirements change, migrating an endpoint between systems means rewriting it, updating routing, and potentially breaking client code.
2. **The override/routing problem is genuinely hard** — when FastAPI needs to handle `POST /users` but PostgREST also exposes it, every routing option has costs:
   - *Reverse proxy rules*: separate config to maintain, easy to get wrong
   - *FastAPI as gateway*: adds latency, couples systems
   - *Separate URL prefixes*: frontend must know which prefix per resource, can't transparently migrate endpoints
3. **Auth becomes two systems** — authorization logic maintained in both Python (FastAPI endpoints) and SQL (RLS policies for PostgREST endpoints). When auth rules change, two places to update. Security inconsistencies are easy to introduce.
4. **Feature-slicing convention breaks** — PostgREST features live in SQL migrations, not feature folders. Creates "invisible features" without manifests that can't participate in tier-based build filtering.
5. **Testing gap** — PostgREST endpoints need integration tests against a running container or raw SQL tests for RLS policies. Neither integrates with existing `make validate`.
6. **TypeScript client generation complexity** — two OpenAPI sources means either merging specs (build complexity, conflict resolution) or maintaining two clients (frontend must know which to import from per resource).
7. **Migration friction** — features often start simple and grow complex. Moving from PostgREST to FastAPI involves writing Python files, changing routing, updating client imports, and adding tests. This friction discourages evolving features.
8. **Debugging across two systems** — when something goes wrong, you need to determine which system handled the request before you can debug it. Logs, tracing, and error handling differ between systems.

### Key Question: Is Boilerplate Actually the Problem?

The project already has `make new-feature` scaffolding and a generic `CrudRepository[T]` base class. The boilerplate is structured and predictable — exactly the kind of work LLM agents handle well.

### Verdict: Viable but likely not worth the complexity for this project.

---

## Recommendation

**Do not add PostgREST** to this project. The costs outweigh the benefits because:

- The project's strength is one consistent pattern for everything. Two systems erode that.
- The routing/override problem has no clean, zero-cost solution.
- Auth duplication (Python + RLS) is a security maintenance burden.
- Existing scaffolding + base repository already minimize CRUD boilerplate.
- The migration path (PostgREST → FastAPI as features grow) creates friction.

### Where PostgREST Would Make Sense

- Greenfield projects with simple, stable CRUD requirements
- Read-heavy, query-intensive use cases (dashboards, analytics, reporting)
- Teams strong in SQL who want the database as the primary API layer
- Internal tools where the API surface is simple and rarely changes
- Projects without an existing well-structured API layer

### If You Still Want PostgREST

The least disruptive option: PostgREST as a **read-only companion** on a separate prefix (e.g., `/api/view/*`), exposing only SQL views (never raw tables), with FastAPI owning all writes. This avoids the override problem entirely and keeps auth simpler (read-only RLS is much simpler than write RLS).
