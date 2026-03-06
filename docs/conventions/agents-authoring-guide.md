# AGENTS.md, SPECS.md, and manifest.yaml Authoring Guide

Reference this document when creating or updating AGENTS.md, SPECS.md, or manifest.yaml files.

---

## SPECS.md (Product Context)

SPECS.md is the single source of truth for **what the software does** — domain model, business rules, user stories, and glossary. AGENTS.md tells agents HOW to write code; SPECS.md tells them WHAT they're building.

### When to update
- When a new feature is added → add a "Feature" section with purpose and business rules.
- When business rules change → update the relevant feature section.
- When a new domain entity is introduced → update the Domain Model section.
- When new domain terms emerge → add to the Glossary.

### Quality rules
- Be specific: "Email must be unique" is good. "Validate user input" is vague.
- Include constraints: min/max lengths, allowed values, error codes.
- State edge cases: what happens on conflict, not-found, invalid input.

### Relationship to other files
- `AGENTS.md` has a `## First Steps` section that tells agents to check for SPECS.md before coding.
- `.continue/rules/product.md` has a brief product context for Continue.dev.
- The OpenAPI spec is generated from FastAPI routers via `make generate` (code-first).
- Feature `manifest.yaml` files have `business_rules` arrays for per-feature domain context.

### Template
`SPECS.template.md` provides a blank template. Copy it when starting a new project.

---

## AGENTS.md

### Instruction budget
- Small models (8B–14B): max 50–100 instructions per AGENTS.md.
- Every line loads on every request — each rule must earn its token cost.
- Prefer one specific rule over two vague ones.
- Product context belongs in SPECS.md, NOT in AGENTS.md (except the "First Steps" check).

### Required sections and size (per AGENTS.md file)
| Section | Target lines |
|---|---|
| First Steps (root only) | 3–4 (check for SPECS.md) |
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
- Root `AGENTS.md`: project-wide rules only (stack, universal rules, tiering, product pointer).
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
- `api_endpoints` must mirror routes declared in the FastAPI routers. Keep them in sync.
- `dependencies.internal` lists feature folder names this feature imports from.
- `version` uses semver. Bump minor on new endpoints, patch on fixes.
- When scaffolding a new feature, copy an existing manifest and fill all fields. Empty lists (`[]`) are valid for fields with no values.
- `business_rules` (optional) lists domain-specific validation rules, constraints, and invariants. Each rule should be specific and falsifiable. Helps LLM agents understand feature behavior without reading SPECS.md.
