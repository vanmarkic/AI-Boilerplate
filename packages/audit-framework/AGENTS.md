# audit-framework — Agent Instructions

Standalone, **publishable** Python library (PyPI target). Unlike app `features/`,
this is a packaged library with a `src/` layout — not part of any single app.

**Read `docs/AUDIT_NOTIFICATION_SPEC.md` before changing architecture.** It is
the source of truth for the design. `docs/CLAUDE_CODE_TASKS.md` lists the
incremental build tasks (core = done; plugins = pending).

## Architecture

- **Audit pipeline** — pipe-and-filter (middleware chain) + event bus for
  fan-out. Each middleware implements `process(event, context, next)`.
- **Case management** (future) — hexagonal / ports & adapters.
- **Connection** — in-process `EventBus`; the pipeline emits
  `escalation.requested`, case management consumes it (bidirectional).

## Hard rules

1. `src/audit_framework/core/` has **zero external dependencies** — stdlib and
   `typing` only. All infrastructure sits behind `Protocol`s in `ports.py`.
2. Every external integration (DB, IdP, SIEM sink, channel, case backend) is a
   **plugin** that implements a port and registers via `PluginRegistry`. The
   core never imports a concrete adapter.
3. Audit and broadcast are **separate policy layers**, evaluated independently
   per event. Policies are data (`AuditPolicy` / `BroadcastPolicy`), resolved
   through a `PolicyStore` port.
4. Fan-out (many sinks, many channels) uses `asyncio.gather(return_exceptions=
   True)` *inside* a middleware — never by branching the chain.
5. All domain models are **frozen** dataclasses with a `to_dict()`; the sole
   mutable model is `PipelineContext` (the bag carried down the chain).
6. The `@auditable` decorator is the primary developer-facing API.
7. Max 350 lines per source file, 500 per test file. Add `__all__` to every
   module. No barrel-style re-export sprawl beyond the curated `__init__.py`.

## Adding a new external integration

1. Implement the relevant `Protocol` from `src/audit_framework/core/ports.py`.
2. Expose a `register(registry)` function.
3. Ship it as a separate package with an `audit_framework.plugins` entry point,
   or load it via `registry.load_from_config([...])`.

## Testing

- Core tests are **stdlib-only**: drive coroutines with `asyncio.run`, use the
  in-memory fakes in `tests/core/fakes.py` (one per port). No infrastructure.
- Run: `pytest` from the package root. Write the failing test first.
