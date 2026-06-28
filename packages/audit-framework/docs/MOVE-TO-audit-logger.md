# Moving audit-framework → vanmarkic/audit-logger

Step-by-step to lift the audit-framework packages out of the AI-Boilerplate
monorepo into the dedicated repo, publish to PyPI, then clean up the monorepo.

## What moves

| From (monorepo) | To (audit-logger) |
|---|---|
| `packages/audit-framework/` | `packages/audit-framework/` |
| `packages/audit-framework-jsonl/` | `packages/audit-framework-jsonl/` |
| `packages/audit-framework-elasticsearch/` | `packages/audit-framework-elasticsearch/` |
| `packages/audit-framework-postgres/` | `packages/audit-framework-postgres/` |
| `.github/workflows/audit-framework-ci.yml` | `.github/workflows/ci.yml` (simplified) |
| `.github/workflows/release-audit-framework.yml` | `.github/workflows/release.yml` |

The `packages/` layout is kept on purpose: 4 packages (core + 3 plugins) that
version independently. Nothing else is monorepo-coupled — zero runtime deps.

## Chosen approach: clean snapshot (no history)

Seeds the new repo with a single import commit authored & signed by you.

### 1. Files needed (keep together in one folder)
- `snapshot-to-audit-logger.sh`
- `audit-framework-ci.standalone.yml`

### 2. Set your git identity (so the commit is yours, not Claude's)
```bash
git config --global user.name  "Your Name"
git config --global user.email "drag.markovic@gmail.com"
```
The script aborts if no identity is set. It signs the commit (`-S`) automatically
when you have a GPG/SSH signing key configured; force with `SIGN=1`, skip with `SIGN=0`.

### 3. Run it
```bash
bash snapshot-to-audit-logger.sh
```
Defaults: `SRC=$HOME/AI-Boilerplate`, `BRANCH=claude/new-monorepo-library-o5qjno`,
`NEW_REMOTE=git@github.com:vanmarkic/audit-logger.git`. Override via env vars, e.g.
`NEW_REMOTE=https://github.com/vanmarkic/audit-logger.git bash snapshot-to-audit-logger.sh`.

The script copies the 4 packages, drops in the simplified CI + release workflow,
strips build cruft (`__pycache__`, `*.egg-info`, `.pytest_cache`), retargets the
4 monorepo references to `vanmarkic/audit-logger`, commits once, and pushes `main`.

## Post-push setup (one-time, human-only)

1. **Branch protection** (`Settings → Branches` on audit-logger): require the
   single status check named **`gate`**.
2. **PyPI Trusted Publisher** — do this once per package, at
   https://pypi.org/manage/account/publishing/ :
   - Repository: `vanmarkic/audit-logger`
   - Workflow: `release.yml`
   - Environment: `pypi`
   Register the core `audit-framework` first.
3. **GitHub Environment** named `pypi` (`Settings → Environments` on audit-logger).

## Publish (per package, core first)

Versions come from git tags via hatch-vcs (single source of truth). Tag, push:
```bash
git tag audit-framework-v0.1.0            && git push origin audit-framework-v0.1.0
# wait for the core to appear on PyPI, then the plugins:
git tag audit-framework-jsonl-v0.1.0          && git push origin audit-framework-jsonl-v0.1.0
git tag audit-framework-elasticsearch-v0.1.0  && git push origin audit-framework-elasticsearch-v0.1.0
git tag audit-framework-postgres-v0.1.0       && git push origin audit-framework-postgres-v0.1.0
```
Each tag triggers `release.yml`, which builds that package and publishes via OIDC
(no tokens). Publish the core first so the plugins' `audit-framework>=0.1,<0.2`
dependency resolves on PyPI.

## Clean up the monorepo (after the new repo is verified green)

On a branch off the monorepo:
```bash
git rm -r packages/audit-framework \
          packages/audit-framework-jsonl \
          packages/audit-framework-elasticsearch \
          packages/audit-framework-postgres \
          .github/workflows/audit-framework-ci.yml \
          .github/workflows/release-audit-framework.yml
git commit -m "chore: move audit-framework to its own repo (vanmarkic/audit-logger)"
```
Also drop `gate`/`audit-framework gate` from the monorepo's branch-protection
required checks if it was added there.

## Notes / gotchas

- **CI difference**: the standalone `ci.yml` has no path-filter / changes-detector
  (the repo *is* the package, so every push runs the full matrix). Its aggregator
  check is renamed `audit-framework gate` → **`gate`** and requires `success`.
- **Trigger branch**: standalone CI triggers on `main` (the monorepo used `master`).
- **History variant** also exists (`migrate-to-audit-logger.sh`, needs
  `pip install git-filter-repo`) if you'd rather preserve the full commit trail;
  it keeps the original workflow filenames, so its Trusted-Publisher workflow is
  `release-audit-framework.yml` and CI gate stays `audit-framework gate`.
