# SOC Platform

Security-operations backend. Ingests events, enriches them against threat
intelligence, scores and disposes of them, opens investigations, and launches
automated response — with every third party swappable.

## First Steps
1. Read `SPECS.md` for the domain (WHAT the software does).
2. Read `backend/AGENTS.md` for conventions (HOW to write code here).
3. Read `SCHEMA.md` before touching persistence (the relational schema, and
   which constraint carries which guarantee).

## Stack
- Backend: FastAPI (Python 3.12+), hexagonal (ports & adapters)
- Database: PostgreSQL 17 intended as the system of record — **not yet wired**;
  repositories are in-memory today (see SPECS.md, Known Gaps). The target
  schema is specified in `SCHEMA.md`.
- Auth: Keycloak (OIDC, JWT via PyJWT)
- Integrations, all optional and all swappable:
  OpenSearch (search sink) · MISP (threat intel) · DFIR-IRIS (cases) ·
  Shuffle (playbooks)

There is no frontend. This is a headless service.

## The One Rule
The core (`domain/`, `application/`) depends on nothing but the standard library
and itself. Every third party sits behind a port phrased in domain language, and
every port has an in-memory implementation that passes the same contract suite as
the real one. If the core has to change to swap a vendor, the port was wrong.

## Running It
Every provider defaults to `memory`, so:

```bash
cd backend && uvicorn main:app --port 8002
curl localhost:8002/api/health/adapters   # shows what is bound to each port
```

serves the entire pipeline with no third party deployed. Point at real systems by
setting `SOC_*_PROVIDER` env vars — no code changes.
