# monorepo-tier-filter

Tier-based feature filtering and build verification for monorepos. Features are tagged with a tier level in `manifest.yaml`, and this tool copies only features at or below the target tier into a build directory, generating wiring code automatically.

## Install

```bash
pip install monorepo-tier-filter
```

## Usage

### Filter features by tier

```bash
# Backend: copy tier-1 features only
tier-filter --tier=1 --src=backend/features --dest=build/backend/features

# Frontend: copy tier-1 features and generate route files
tier-filter --tier=1 --src=frontend/src/app/features --dest=build/frontend/features --frontend

# Include tier 1 and 2
tier-filter --tier=2 --src=backend/features --dest=build/backend/features
```

### Verify a filtered build

```bash
# Verify no tier-2+ features leaked into the build
tier-verify --tier=1 \
  --backend-src=backend/features \
  --backend-dest=build/backend/features \
  --backend-main=backend/main.py \
  --backend-core=backend/core
```

## How it works

Each feature directory must contain a `manifest.yaml` with a `tier` field:

```yaml
name: analytics
tier: 2
description: Advanced analytics dashboard
```

Features without a manifest default to tier 1.

## Verification checks

`tier-verify` runs 5 checks per side (backend/frontend):

1. No higher-tier directories in filtered output
2. No references to excluded feature names in filtered source files
3. Entrypoints don't import excluded features
4. Core/shared code doesn't import excluded features
5. Generated wiring files only reference included features
