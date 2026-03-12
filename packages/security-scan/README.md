# @aspect/security-scan

Orchestrates multiple security scanning tools with graceful skip-if-missing behavior and timestamped JSON reports.

## Tools orchestrated

| Tool | Purpose |
|---|---|
| `npm audit` | Node.js dependency vulnerabilities |
| `pip-audit` | Python dependency vulnerabilities |
| `bandit` | Python SAST (code patterns) |
| `semgrep` | Multi-language SAST |
| `trivy` | Filesystem vulnerability scanning |
| `gitleaks` | Secret detection |

Each tool is skipped if not installed — no hard dependencies.

## Install

```bash
npm install @aspect/security-scan
```

Or just copy `bin/security-scan.sh` into your project.

## Usage

```bash
# Run from your repo root
npx security-scan

# Or directly
./node_modules/.bin/security-scan
```

Reports are written to `security-reports/` with UTC timestamps.

## Output

```
==> Running npm audit (frontend)...
    npm audit (frontend): done
==> Skipping pip-audit (not installed or no backend/)
==> Running semgrep...
    semgrep: done

Security scan complete: 4 ran, 2 skipped
Reports written to: security-reports/
```
