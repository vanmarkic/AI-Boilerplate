# python-layer-lint

AST-based architecture linter that enforces layer dependency rules and tier boundaries for Python projects using a feature-sliced architecture.

## Install

```bash
pip install python-layer-lint
pip install python-layer-lint[yaml]  # for tier boundary checking via manifest.yaml
```

## Usage

```bash
# Lint the default backend/features directory
layer-lint

# Lint a specific features directory
layer-lint path/to/features
```

## Layer Rules

The default rules enforce this dependency flow:

```
router     → service, schema, core
service    → repository, model, schema, core
repository → model, core
model      → core only
schema     → (no feature-local imports)
test       → any layer
```

## Tier Boundaries

When `pyyaml` is installed, the linter also reads `manifest.yaml` from each feature directory and enforces that a feature with `tier=N` does not import from a feature with `tier > N`.

## Programmatic Usage

```python
from python_layer_lint import check_imports, check_tier_boundaries, LAYER_RULES

violations = check_imports(Path("features/orders/orders_router.py"))
```
