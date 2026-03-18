# TFC Change Report

> Auto-generated report of all changes to `apps/tfc/` based on git history.

## Summary

| Metric       | Value                    |
|--------------|--------------------------|
| Total commits | 65                      |
| Contributors | 3 (Claude, vanmarkic, Drago van Markic) |
| Date range   | March 17–18, 2026        |
| Categories   | Features, Fixes, Tests, Chores, Docs, Style, Merges |

---

## Chronological Changelog

### March 17, 2026

| Hash | Author | Message |
|------|--------|---------|
| `d619e95` | Claude | Add missing frontend service to TFC docker-compose |
| `3900b40` | Claude | Add waiting room with role assignment for TFC exercises |
| `7acd460` | Claude | Add exhaustive tests for waiting room store and router |
| `04d1a91` | Drago van Markic | Merge pull request #90 from vanmarkic/claude/remove-unused-component-l6Aoo |
| `6ac7031` | Drago van Markic | Merge pull request #89 from vanmarkic/claude/review-docker-compose-config-jxXSO |
| `5fa438c` | Drago van Markic | Merge pull request #91 from vanmarkic/claude/add-waiting-room-roles-mi4Js |
| `b7514ee` | Claude | Add Pareto integration tests for waiting room WebSocket broadcasts |
| `60ace48` | Claude | Add Playwright e2e tests for waiting room join/role/GM flows |
| `178d39a` | Claude | feat(game-master): add scenario selection before exercise start |
| `8d1df09` | Claude | test(game-master): add exhaustive tests for scenario selection flow |
| `31e507d` | Drago van Markic | Merge pull request #94 from vanmarkic/claude/gamemaster-scenario-selection-RerC8 |
| `aab9da5` | Claude | feat(tfc): implement all P2 tasks with unit and integration tests |
| `4113b20` | Claude | feat(tfc): add domain theming, presence indicators, and event timeline |
| `32f4297` | Claude | Add failure screenshots to TFC Playwright CI pipeline |
| `2bf49dc` | Claude | Capture one screenshot per route in TFC Playwright CI |
| `ba65608` | Claude | test(tfc): add exhaustive tests for domain theming, presence, and timeline |
| `664b5a7` | Claude | Set tfc-hoi as the default TFC theme |
| `6e7409f` | Claude | Merge origin/master into claude/review-tfc-tasks-2IEkl |
| `7656716` | Drago van Markic | Merge pull request #98 from vanmarkic/claude/hearts-of-iron-theme-6wQL4 |
| `f3a64a0` | Claude | Fix missing connected$ mock in GameMasterView test |
| `52d8d5c` | Claude | Add property testing to TFC engine with Hypothesis |
| `deb496c` | Claude | feat(tfc): add Simple-Collaborative game mode with advisor/decision-maker roles |
| `dd89aed` | Claude | test(tfc): add property tests for SimpleCollaborativeMode |
| `a599bb1` | Claude | feat(tfc): add Railway deployment config |
| `b1a2b2a` | Claude | fix(tfc): move domain terminology dictionary from hardcoded constants to DB |
| `e79a2f3` | Claude | feat(tfc): add GSAP micro-animations and visual polish to player view |
| `fbbed43` | Claude | test(tfc): add TDD + property tests for domain_config feature |
| `7243fd6` | Drago van Markic | Merge pull request #109 from vanmarkic/claude/assess-3d-visuals-cost-Pjq7p |
| `3a8b335` | Drago van Markic | Merge pull request #108 from vanmarkic/claude/deploy-tfc-akta8 |
| `f0fa22d` | vanmarkic | chore(tfc): add Railway deployment config + pre-deploy cleanup |
| `2dbe793` | vanmarkic | feat(exercise): add game_mode column and related logic; home view; join view; waiting room updates |
| `d8109cb` | vanmarkic | fix(tfc): use npm install instead of npm ci in frontend Dockerfile.railway |
| `bb9a16f` | vanmarkic | feat(scenario): add Silent Wake scenario with detailed game mechanics and phases |
| `abe00f8` | vanmarkic | Add new game scenario "Silent Wake" with detailed phases, events, and decision templates |
| `2eb7340` | vanmarkic | feat(scenario): add idempotent scenario seeder to load JSON seed files |
| `f40df50` | vanmarkic | feat: enhance scenario selection with game mode and update Docker setup for seeding |
| `441a979` | vanmarkic | feat: add game mode and session code to exercise creation; join view; naval operations theme |
| `52b8132` | vanmarkic | feat: add property-based and integration tests for collaborative exercise onboarding; Three.js sea backdrop |
| `0117e9c` | vanmarkic | fix: handle session code collisions gracefully; refine sea backdrop geometry |
| `fe82d32` | vanmarkic | style: enhance menu card styles for improved aesthetics |
| `56fd6b5` | vanmarkic | feat: enhance MockApi for session code; add Signal management for sea backdrop |
| `0488cec` | vanmarkic | feat: add Playwright e2e tests for collaborative exercise flow; signal management in sea backdrop |
| `ce32eb2` | vanmarkic | feat: update Playwright tests; enhance sea backdrop geometry and lighting |
| `3ea5d0d` | vanmarkic | feat: update collaborative session code tests; proper URL expectations |
| `7fca857` | vanmarkic | feat: update selectors in join page tests to use input elements |
| `88a43ef` | vanmarkic | feat: correct join page test description and URL expectations; enhance scenario builder |
| `5f333f0` | vanmarkic | feat: add session_code column to tfc_exercises; unique code generation and backfill |

### March 18, 2026

| Hash | Author | Message |
|------|--------|---------|
| `7f3dcbd` | Claude | fix: repair Three.js sea animation by fixing component lifecycle |
| `97a0985` | Claude | fix: prevent transient GHA cache errors from failing deploys |
| `bfec133` | Claude | refactor: rename Dockerfile.railway to Dockerfile |
| `d306d4f` | Claude | Fix test_ws_ping_pong race condition with state_changes message |
| `dd1eddd` | Claude | feat(tfc): wire per-card scoring, forced cards, and turn chaining |
| `245542a` | Claude | chore: add uv.lock for TFC backend dependencies |
| `850adba` | Claude | fix: include seed data and run seeder in Hetzner deployment |
| `82a4f55` | Drago van Markic | Merge pull request #117 from vanmarkic/claude/fix-hetzner-scenarios-yQYhz |
| `54135a6` | Drago van Markic | Merge pull request #118 from vanmarkic/claude/tfc-silent-wake-penalties-Tymz8 |
| `83e06b9` | Claude | feat(tfc): add glowing dot convergence effect on Three.js sea |
| `901790b` | Claude | fix(tfc): place glowing dot at mesh vertex instead of using vector lines |
| `b44aabc` | Claude | fix(tfc): allow glowing dot to spawn on any vertex including edges |
| `495d32b` | Drago van Markic | Merge pull request #119 from vanmarkic/claude/threejs-glowing-dot-effect-9Zs2P |
| `9bc22aa` | Claude | fix: wire participant_id through recommendation flow (gap #3) |
| `8dbce4c` | Drago van Markic | Merge pull request #121 from vanmarkic/claude/tfc-gaps-blockers-Kh8bA |
| `78f85c3` | Claude | docs(tfc): add inject/defect terminology aliases for LLM prompt alignment |
| `5ebf865` | Claude | Change sea backdrop camera FOV to 50mm full-frame equivalent (27°) |
| `f577bbe` | Drago van Markic | Merge pull request #122 from vanmarkic/claude/assess-terminology-rename-CEugZ |

---

## Changes by Category

### Features (25 commits)

- `d619e95` — Add missing frontend service to TFC docker-compose
- `3900b40` — Add waiting room with role assignment for TFC exercises
- `178d39a` — Game master scenario selection before exercise start
- `aab9da5` — Implement all P2 tasks with unit and integration tests
- `4113b20` — Domain theming, presence indicators, and event timeline
- `664b5a7` — Set tfc-hoi as the default TFC theme
- `deb496c` — Simple-Collaborative game mode with advisor/decision-maker roles
- `a599bb1` — Railway deployment config
- `e79a2f3` — GSAP micro-animations and visual polish to player view
- `2dbe793` — Game mode column, home view, join view, waiting room updates
- `bb9a16f` — Silent Wake scenario with detailed game mechanics and phases
- `abe00f8` — Silent Wake scenario: phases, events, decision templates
- `2eb7340` — Idempotent scenario seeder to load JSON seed files
- `f40df50` — Enhance scenario selection with game mode; Docker seeding
- `441a979` — Game mode and session code; join view; naval operations theme
- `52b8132` — Property-based tests for collaborative onboarding; Three.js sea backdrop
- `56fd6b5` — MockApi for session codes; Signal management for sea backdrop
- `0488cec` — Playwright e2e tests for collaborative flow; sea backdrop signals
- `5f333f0` — Session code column with unique code generation and backfill
- `dd1eddd` — Per-card scoring, forced cards, and turn chaining
- `83e06b9` — Glowing dot convergence effect on Three.js sea
- `5ebf865` — Sea backdrop camera FOV to 50mm full-frame equivalent (27°)
- `f0fa22d` — Railway deployment config + pre-deploy cleanup
- `ce32eb2` — Playwright test updates; sea backdrop geometry and lighting
- `3ea5d0d` — Collaborative session code tests; URL expectations

### Fixes (10 commits)

- `d8109cb` — Use npm install instead of npm ci in frontend Dockerfile.railway
- `0117e9c` — Handle session code collisions gracefully; sea backdrop geometry
- `b1a2b2a` — Move domain terminology dictionary from hardcoded constants to DB
- `f3a64a0` — Fix missing connected$ mock in GameMasterView test
- `7f3dcbd` — Repair Three.js sea animation by fixing component lifecycle
- `97a0985` — Prevent transient GHA cache errors from failing deploys
- `d306d4f` — Fix test_ws_ping_pong race condition with state_changes message
- `850adba` — Include seed data and run seeder in Hetzner deployment
- `901790b` — Place glowing dot at mesh vertex instead of using vector lines
- `b44aabc` — Allow glowing dot to spawn on any vertex including edges
- `9bc22aa` — Wire participant_id through recommendation flow (gap #3)

### Tests (8 commits)

- `7acd460` — Exhaustive tests for waiting room store and router
- `b7514ee` — Pareto integration tests for waiting room WebSocket broadcasts
- `60ace48` — Playwright e2e tests for waiting room join/role/GM flows
- `8d1df09` — Exhaustive tests for scenario selection flow
- `ba65608` — Exhaustive tests for domain theming, presence, and timeline
- `52d8d5c` — Property testing for TFC engine with Hypothesis
- `dd89aed` — Property tests for SimpleCollaborativeMode
- `fbbed43` — TDD + property tests for domain_config feature

### CI/Infra (2 commits)

- `32f4297` — Add failure screenshots to TFC Playwright CI pipeline
- `2bf49dc` — Capture one screenshot per route in TFC Playwright CI

### Chores / Refactoring (3 commits)

- `bfec133` — Rename Dockerfile.railway to Dockerfile
- `245542a` — Add uv.lock for TFC backend dependencies
- `6e7409f` — Merge origin/master into claude/review-tfc-tasks-2IEkl

### Documentation (1 commit)

- `78f85c3` — Add inject/defect terminology aliases for LLM prompt alignment

### Style (1 commit)

- `fe82d32` — Menu card style enhancements (padding, background, box-shadow)

### Merges (9 commits)

- `f577bbe` — Merge PR #122 (terminology rename)
- `8dbce4c` — Merge PR #121 (gaps & blockers)
- `495d32b` — Merge PR #119 (Three.js glowing dot effect)
- `54135a6` — Merge PR #118 (Silent Wake penalties)
- `82a4f55` — Merge PR #117 (Hetzner scenarios fix)
- `7243fd6` — Merge PR #109 (3D visuals cost assessment)
- `3a8b335` — Merge PR #108 (TFC deployment)
- `7656716` — Merge PR #98 (Hearts of Iron theme)
- `31e507d` — Merge PR #94 (game master scenario selection)
- `5fa438c` — Merge PR #91 (waiting room roles)
- `6ac7031` — Merge PR #89 (docker-compose config review)
- `04d1a91` — Merge PR #90 (remove unused component)

---

## Contributor Breakdown

| Author | Commits | Role |
|--------|---------|------|
| Claude | 37 | AI-assisted development (features, fixes, tests) |
| vanmarkic | 16 | Manual development (features, collaborative flow, scenarios) |
| Drago van Markic | 12 | PR merges and review |

---

## Major Milestones

1. **Waiting Room & Roles** (PR #89–#91) — Docker compose fix, waiting room with role assignment, exhaustive tests
2. **Game Master Scenario Selection** (PR #94) — Scenario selection UI before exercise start
3. **Hearts of Iron Theme** (PR #98) — Domain theming, presence indicators, timeline, tfc-hoi default theme
4. **Collaborative Game Mode** — Simple-Collaborative mode with advisor/decision-maker roles, property tests
5. **Deployment** (PR #108) — Railway deployment config, Dockerfile setup
6. **3D Visuals** (PR #109, #119) — GSAP animations, Three.js sea backdrop, glowing dot convergence effect
7. **Silent Wake Scenario** (PR #118) — Full scenario with phases, events, decision templates, per-card scoring
8. **Hetzner Deployment** (PR #117) — Seed data and seeder integration
9. **Gaps & Blockers** (PR #121) — participant_id wiring through recommendation flow
10. **Terminology Alignment** (PR #122) — Inject/defect aliases, camera FOV adjustment
