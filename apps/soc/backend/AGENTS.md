# SOC Backend — FastAPI + Python 3.12 (Hexagonal)

## Architecture
Ports and adapters. Unlike `main/` and `tfc/`, this app is **not** feature-sliced:
`features/` holds inbound HTTP adapters only.

```
domain/       entities + pure policies      imports: stdlib only
   ^
application/  use cases + ports (Protocol)  imports: domain
   ^
adapters/     vendor clients, in-memory     imports: domain, application
   ^
features/     routers + schemas + manifest  imports: application, core
   ^
core/         DI wiring, settings, registry imports: everything
```

## Layer Rules (enforced by `make lint-arch`)
1. The layer of a file is its **filename suffix**: `severity_policy.py` → `policy`.
2. `usecase` may NEVER import an adapter, `core`, or a framework. This is the rule
   everything else serves.
3. `entity` imports entities and the error taxonomy only.
4. `policy` imports entities and other policies. No I/O, ever.
5. `port` imports domain types only — never a vendor DTO.
6. `model` (SQLAlchemy) may not import `entity`; a `mapper` is the only place the
   ORM and the domain meet.
7. `router` may not import an adapter — go through a use case.
8. `schema` may not import from another feature; shared projections live in
   `core/presentation_schema.py`.
9. `core/` is the composition root and is deliberately unlinted.

## Two Rules the Linter Cannot Enforce
10. The core imports no third-party package. Guarded by `domain/domain_purity_test.py`.
11. The core never *names* a vendor — no "misp", "iris", "shuffle", "opensearch"
    in `domain/` or `application/`, not even in a comment. Same guard.
12. Relative imports are banned (ruff `TID252`): they carry no package root, so the
    architecture linter cannot see them.

## Errors
13. The domain raises `DomainError` subclasses from `domain/soc_error.py`. It knows
    nothing about HTTP.
14. `core/exceptions.py` owns the domain → status-code table; `core/middleware.py`
    applies it. Do NOT raise `HTTPException` outside `core/`.
15. Outbound failures use the `IntegrationError` family, which names the *capability*
    (`threat_intel`), never the product.

## Ports and Adapters
16. Port method names use domain language. If a signature hints which product is
    behind it, the abstraction is wrong.
17. Every port has ≥2 implementations and a contract suite in `adapters/contract/`.
    A new vendor adapter is done when that suite is green against it.
18. Contract base classes are NOT named `Test*`, so pytest does not collect them
    directly; concrete subclasses in each adapter package supply the fixtures.
19. Vendor packages split into `*_client.py` (transport), `*_mapper.py`
    (anti-corruption), `*_adapter.py` (satisfies the port).
20. All outbound HTTP goes through `adapters/resilient_client.py`. Never log a
    response body, header or query string.

## Adding a Third Party
21. Write `*_client.py`, `*_mapper.py`, `*_adapter.py` under `adapters/<vendor>/`.
22. Subclass the port's contract suite; supply a `httpx.MockTransport` fixture.
23. Add one builder line to `core/registry.py` and one provider value to
    `core/config.py`. Nothing in `domain/` or `application/` changes — if it does,
    the port was wrong.

## Testing
24. Tests are colocated and named `*_test.py`, classes `Test*`.
25. `pytest-asyncio` with `asyncio_mode = "auto"` — no `@pytest.mark.asyncio`.
26. Use cases are tested against `adapters/memory/*` with `FixedClockAdapter` and
    `SequentialIdAdapter`, so assertions name exact timestamps and ids.
27. Vendor adapters are tested with `httpx.MockTransport` and an injected no-op
    `sleep`. No test requires a network, a database or a running vendor.
28. Tests requiring PostgreSQL are marked `@pytest.mark.postgres`; the default
    suite excludes nothing today because persistence is still in-memory.

## Conventions
29. Type hints on every signature (ruff `ANN`). Use `object`, not `Any`, for
    arbitrary JSON.
30. Max 350 lines per file (500 for tests).
31. No barrel exports. No `print` (ruff `T20`) — use `logging`.
32. Routes are prefixed `/api/`; every endpoint declares a camelCase `operation_id`.
33. Use `status.HTTP_XXX` constants, never raw integers.
34. Every feature folder needs a `manifest.yaml` whose `api_endpoints` match its
    router decorators — `make lint-arch` checks this.

## Common Pitfalls
- Do NOT import an adapter from a use case; use the port.
- Do NOT put business logic in a router — that is what a use case is for.
- Do NOT let a vendor's vocabulary into a port signature.
- Do NOT make a port promise something a real vendor cannot keep (the
  orchestration port promises no idempotency for exactly this reason).
- Do NOT treat the search sink as the system of record; indexing failure is
  reported, not raised.
- Do NOT call an external system before our own state is committed.
