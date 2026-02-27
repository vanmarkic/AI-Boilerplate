# AGENTS.md and manifest.yaml Authoring Guide

Reference this document when creating or updating AGENTS.md or manifest.yaml files.

---

## AGENTS.md

### Instruction budget
- Small models (8B–14B): max 50–100 instructions per AGENTS.md.
- Every line loads on every request — each rule must earn its token cost.
- Prefer one specific rule over two vague ones.

### Required sections and size (per AGENTS.md file)
| Section | Target lines |
|---|---|
| Stack / tech declaration | 1–3 |
| Architecture pattern | 2–4 |
| Coding standards | 10–20 bullets |
| File structure | 5–10 lines |
| Testing conventions | 5–10 lines |
| Common pitfalls / anti-patterns | 5–10 lines |

### Quality rules
- BAD: "Write clean code." — not actionable.
- GOOD: "Limit functions to 20 lines. Use camelCase for variables." — specific, verifiable.
- Every rule must be falsifiable: an agent must be able to check compliance.

### Scope rules
- Root `AGENTS.md`: project-wide rules only (stack, universal rules, tiering).
- `frontend/AGENTS.md`: frontend-only rules. No duplication of root rules.
- `backend/AGENTS.md`: backend-only rules. No duplication of root rules.
- When a rule applies to both frontend and backend, it lives in root AGENTS.md only.

### When to update
- When a new library or pattern is adopted project-wide → root AGENTS.md.
- When a layer boundary rule changes → the relevant scoped AGENTS.md.
- When a rule is violated repeatedly by an agent → add it as an explicit anti-pattern.

---

## manifest.yaml

- Schema is defined in `shared/manifest.schema.yaml`. All fields listed there are required.
- `api_endpoints` must mirror routes declared in `shared/openapi.yaml`. Keep them in sync.
- `dependencies.internal` lists feature folder names this feature imports from.
- `version` uses semver. Bump minor on new endpoints, patch on fixes.
- When scaffolding a new feature, copy an existing manifest and fill all fields. Empty lists (`[]`) are valid for fields with no values.
