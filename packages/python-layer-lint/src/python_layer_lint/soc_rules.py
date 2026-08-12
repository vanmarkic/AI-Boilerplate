"""Layer rules for hexagonal (ports & adapters) backends.

Encodes the dependency rule for a core that must stay independent of every
third party::

    domain/       entities + pure policies      imports: stdlib only
       ^
    application/  use cases + ports (Protocol)  imports: domain
       ^
    adapters/     vendor clients, persistence,  imports: domain, application
                  in-memory implementations
       ^
    features/     inbound HTTP adapters         imports: application, core
       ^
    core/         DI wiring, settings, config   imports: everything

The load-bearing rule is ``usecase`` → never an adapter layer.  Everything
else exists to keep that one honest.

``core/`` is intentionally not linted: it is the composition root, and its
whole job is to see every layer at once.

Layers come from the filename suffix, matching the convention used elsewhere
in this repo (``severity_policy.py`` → ``policy``).

Two blind spots this cannot cover, handled elsewhere:

* **third-party imports** (``import httpx`` inside ``domain/``) are invisible
  here because only first-party roots are inspected — guarded by
  ``domain/domain_purity_test.py``.
* **relative imports** (``from .misp_mapper import x``) carry no package root
  — banned outright via ruff's ``TID252`` in the app's pyproject.
"""

SOC_LOCAL_ROOTS: frozenset[str] = frozenset(
    {"domain", "application", "adapters", "features", "core"}
)

# Which *filename-suffix layers* each layer may import.
SOC_LAYER_RULES: dict[str, set[str]] = {
    # --- domain: the pure core --------------------------------------------
    # Entities may raise the error taxonomy: enforcing your own invariants at
    # construction is the entity's job, not a caller's.
    "entity": {"entity", "error"},
    "policy": {"entity", "policy", "error"},
    "error": {"error"},
    # --- application: ports + use cases, depends on domain only ------------
    "dto": {"entity", "dto"},
    "port": {"entity", "dto", "error", "port"},
    "usecase": {"entity", "policy", "error", "port", "dto", "usecase"},
    # --- adapters: the only place that knows a vendor exists ---------------
    "client": {"error", "client"},
    # SQLAlchemy tables may NOT import domain entities: an explicit mapper is
    # the only place the ORM and the domain are allowed to meet.
    "model": {"model"},
    # Mappers may use domain policies, and must: a vendor value has to be
    # canonicalised by the domain's own rules on the way in, or deduplication
    # silently breaks on values only that vendor formats a particular way.
    "mapper": {"entity", "dto", "error", "policy", "model", "mapper"},
    "adapter": {"entity", "dto", "error", "port", "mapper", "client", "adapter"},
    "repository": {"entity", "dto", "error", "port", "mapper", "model", "repository"},
    "fake": {"entity", "dto", "error", "port", "fake"},
    # --- inbound HTTP ------------------------------------------------------
    "schema": {"entity", "dto", "schema"},
    "router": {"entity", "dto", "error", "schema", "usecase", "port", "router"},
    # --- test support ------------------------------------------------------
    "contract": {"entity", "dto", "error", "port", "contract"},
    "test": {
        "entity", "policy", "error", "dto", "port", "usecase", "client",
        "model", "mapper", "adapter", "repository", "fake", "schema",
        "router", "contract",
    },
}

# Which *top-level packages* each layer may import.  Catches package imports
# whose final segment carries no layer suffix (``from adapters.misp import x``),
# which suffix matching alone cannot see.
SOC_ROOT_RULES: dict[str, set[str]] = {
    "entity": {"domain"},
    "policy": {"domain"},
    "error": {"domain", "application"},
    "dto": {"domain", "application"},
    "port": {"domain", "application"},
    # The invariant this whole module exists for: no adapters, no features, no
    # core, no framework — use cases see the domain and their own ports, period.
    "usecase": {"domain", "application"},
    # Vendor transport may raise the shared error taxonomy (domain/soc_error.py,
    # layer "error") but the layer rules above deny it every other domain type,
    # so it can never smuggle vendor vocabulary inward.
    "client": {"domain", "application", "adapters", "core"},
    "model": {"core"},
    "mapper": {"domain", "application", "adapters"},
    "adapter": {"domain", "application", "adapters", "core"},
    "repository": {"domain", "application", "adapters", "core"},
    "fake": {"domain", "application", "adapters"},
    "schema": {"domain", "core"},
    "router": {"domain", "application", "features", "core"},
    "contract": {"domain", "application"},
    "test": {"domain", "application", "adapters", "features", "core"},
}
