# CI/CD Strategy

## Problem: Dual CI configs

This repo ships both **GitHub Actions** (`.github/workflows/`) and **GitLab CI** (`.gitlab-ci.yml`). Maintaining two configs in parallel creates drift and doubles the effort for any pipeline change.

## Recommendation: Pick one, generate the other

1. **Choose a primary CI** based on where the repo is hosted.
2. **Delete the secondary config** or mark it clearly as "best-effort mirror".
3. If you must support both, extract shared logic into Makefile targets (which already exist for `validate`, `test`, `lint`, `build-tier-N`) and keep CI YAML as thin wrappers that call `make`.

### Thin-wrapper approach (if both are needed)

GitHub Actions example:

```yaml
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: make validate
```

GitLab CI example:

```yaml
validate:
  script:
    - make validate
```

This way, pipeline logic lives in the Makefile (one place to update), and CI YAML only handles triggers, caching, and service containers.

## Current status

Both CI systems are fully configured. Before your next infrastructure change, choose a primary and simplify the secondary.
