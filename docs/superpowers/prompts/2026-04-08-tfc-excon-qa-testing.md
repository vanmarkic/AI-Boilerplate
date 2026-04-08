# TFC EXCON Default Mode — QA, Testing & UAT Prompt

> **Branch:** `feat/tfc-excon-default-mode` (19 commits, 57 files, +2316/-169 lines)
> **Spec:** `docs/superpowers/specs/2026-04-07-tfc-excon-default-mode-design.md`
> **Plan:** `docs/superpowers/plans/2026-04-07-tfc-excon-default-mode.md`

## What was built

This branch implements the initial EXCON (trainer-driven) default game mode for TFC. It touches the engine data model, audit trail, codegen, trainer cockpit UI, trainee UI, and scenario builder. Here is every change, grouped by subsystem:

### Backend engine (pure Python, no DB/HTTP)
1. **ExecutionMode enum** — `AUTOMATIC` / `MANUAL` on `ScheduledEvent`. MANUAL events don't auto-activate on schedule; they require GM `force_trigger`.
2. **Defect ETBOL RT/PT split** — `auto_resolve_ms` renamed to `auto_resolve_pt_ms`, new `auto_resolve_rt_ms`. `tick()` now takes `current_rt_ms`; first expiry (PT or RT) resolves the defect. `activated_at_rt_ms` tracked.
3. **`all_respond` completion mode** — `DecisionManager.all_target_roles_responded()` checks every `target_role` has a recommendation. `submit_recommendation` endpoint auto-closes when all roles respond.
4. **Scoring visibility** — `snapshot()` returns `score=None` unless `phase == COMPLETED`.
5. **`DecisionTemplate.issue_id` optional** — `str | None = None` on both engine config and scenario content.

### Audit trail
6. **8 entity action endpoints wired** — `cancel_event`, `complete_event`, `pause_event`, `resume_event`, `delay_event`, `skip_event`, `mitigate_issue`, `resolve_issue`, `release_issue` now call `engine._on_state_change([change])` for broadcast + audit logging.

### Scenario layer
7. **Scenario content / loader / seeds** — `execution_mode` on events, `auto_resolve_pt_ms` + `auto_resolve_rt_ms` on issues, wired through loader and Hypothesis strategies. All seed JSON files migrated.
8. **Scenario content CRUD API** — 9 new endpoints under `/api/scenarios/{id}/content/` for adding, updating, deleting injects, defects, and decision templates. Includes `validate_content_integrity()` cross-reference checking.

### Frontend — TypeScript types
9. **Codegen** — `state-changes.types.ts` regenerated with `execution_mode`, `auto_resolve_pt_ms`, `auto_resolve_rt_ms`, `activated_at_rt_ms`.

### Frontend — Trainer cockpit (`/gm`)
10. **Defect list component** (`gm-defect-list.component.ts`) — issues grouped by lifecycle, ETBOL countdown, severity-colored borders.
11. **Details panel** (`gm-details-panel.component.ts`) — full metadata for selected inject/defect with action buttons (Pause/Resume/Cancel/Complete for events; Activate/Mitigate/Resolve for defects).
12. **Trainee monitor** (`trainee-monitor.component.ts`) — per-trainee cards showing name, role, connection status, per-decision submission status.
13. **Layout restructure** — overview row now flex: timeline (2) + defect list (1); trainee monitor strip between overview and details.

### Frontend — Trainee view (`/player`)
14. **Inject feed** (`inject-feed.component.ts`) — chronological feed of RUNNING/COMPLETED events, newest first, with role-specific descriptions. Shown in classic (non-collaborative) mode.
15. **Defect panel** (`defect-panel.component.ts`) — active defects with lifecycle badges, ETBOL countdown, severity colors. Resolved defects in collapsible section.
16. **Decision overlay** — blocking modal when `hasOpenDecision()` is true in classic mode.
17. **3-column classic layout** — inject feed (left), defect panel (center), board content (right). Collaborative mode layout unchanged.

### Frontend — Scenario builder
18. **Inject editor** — execution mode dropdown (Automatic/Manual).
19. **Defect editor** — two ETBOL fields: "Auto-resolve PT (ms)" and "Auto-resolve RT (ms)".
20. **Decision editor** — completion mode dropdown (First response / All respond / GM closes) with target_roles picker when "All respond" is selected.

---

## Your job

You are a QA engineer and user acceptance tester. Your goal is to systematically verify every change listed above through **three passes**, fixing issues as you find them (one at a time, TDD where feasible). Do not batch fixes. After each fix, re-run the failing test to confirm it passes, then move to the next issue.

### Pass 1 — Automated test sweep

Run all existing tests and confirm no regressions from the implementation:

```bash
# Backend (from apps/tfc/backend/)
uv run python -m pytest -v --tb=short

# Frontend unit tests (from apps/tfc/frontend/, need node 22)
source ~/.nvm/nvm.sh && nvm use 22 && npx ng test --no-watch

# Playwright e2e (requires dev stack running)
docker compose -f infra/docker-compose.tfc.yml up -d db tfc-api
source ~/.nvm/nvm.sh && nvm use 22
cd apps/tfc/frontend && npx ng serve --port 4201 &
npx playwright test --reporter=line
```

**Known pre-existing failures to ignore:**
- `waiting_room_integration_test.py` (5 tests) — broadcast count mismatch, unrelated
- `migration_rollback_test.py` (3 errors) — requires live PostgreSQL
- `role-card.component.spec.ts` (5 tests) — DOM query issues in existing component
- Collaborative-mode Playwright tests that look for `tfc-decision-panel` — these test the collaborative UI which was not changed

**Expected passing counts:** ≥791 backend, ≥290 frontend unit, ≥108 Playwright e2e.

### Pass 2 — Targeted feature verification

For each of the 20 changes above, write or verify that a test covers the specific behavior. Focus on:

#### Engine behavior (unit tests)
- [ ] MANUAL event does NOT auto-activate when `tick(current_pt_ms)` passes its `scheduled_pt_ms`
- [ ] MANUAL event CAN be force-triggered by GM
- [ ] AUTOMATIC event still auto-activates normally
- [ ] Snapshot includes `execution_mode` field
- [ ] Defect with `auto_resolve_pt_ms=500` resolves when PT elapsed ≥ 500 (even if RT < 500)
- [ ] Defect with `auto_resolve_rt_ms=200` resolves when RT elapsed ≥ 200 (even if PT < 200)
- [ ] Defect with BOTH set resolves on whichever fires first
- [ ] `activated_at_rt_ms` is recorded on activation
- [ ] `all_target_roles_responded()` returns False when one role is missing
- [ ] `all_target_roles_responded()` returns True when all roles present
- [ ] `all_target_roles_responded()` returns False for nonexistent decision
- [ ] Score is `None` in snapshot when phase is RUNNING
- [ ] Score is present in snapshot when phase is COMPLETED
- [ ] `DecisionTemplate` with `issue_id=None` is valid

#### Audit trail (integration test or manual)
- [ ] `POST /events/{id}/cancel` produces an audit entry
- [ ] `POST /events/{id}/pause` produces an audit entry
- [ ] `POST /issues/{id}/mitigate` produces an audit entry
- [ ] `POST /issues/{id}/resolve` produces an audit entry
- [ ] Verify by: `GET /api/audit?exercise_id={id}` — check all 8 action types appear

#### Scenario CRUD (integration tests)
- [ ] `POST /api/scenarios/{id}/content/events` adds an inject
- [ ] `PUT /api/scenarios/{id}/content/events/{eid}` updates it
- [ ] `DELETE /api/scenarios/{id}/content/events/{eid}` removes it
- [ ] Same 3 for issues and decisions
- [ ] Adding an event with `dependencies: ["nonexistent"]` fails validation
- [ ] Adding a decision with `target_roles: ["fake"]` fails validation

#### Seed validation
- [ ] `python -m pytest features/scenario/seed_validation_test.py -v` — all seeds pass with renamed fields

#### Frontend build + types
- [ ] `npx ng build --configuration=development` succeeds with no errors
- [ ] `grep "execution_mode" src/app/core/generated/state-changes.types.ts` finds the field
- [ ] `grep "auto_resolve_pt_ms" src/app/core/generated/state-changes.types.ts` finds the field

#### Scenario builder UI (Playwright or manual)
- [ ] Inject editor shows "Execution Mode" dropdown with Automatic/Manual
- [ ] Defect editor shows two ETBOL fields (PT and RT)
- [ ] Decision editor shows completion mode dropdown
- [ ] Selecting "All respond" reveals target_roles checkboxes

### Pass 3 — End-to-end user acceptance (manual or Playwright)

This is the critical flow. Start the full dev stack and walk through the EXCON game mode as both trainer and trainee.

**Prerequisites:**
```bash
make dev-tfc-local  # or: docker compose up + ng serve manually
cd apps/tfc/backend && python seed.py  # load Silent Wake scenario
```

#### Trainer flow (`/gm`)
1. Open `/gm`, select Silent Wake scenario, create exercise
2. Verify: **defect list** appears to the right of the timeline (empty initially)
3. Verify: **trainee monitor** strip shows below the overview (empty until trainees join)
4. Start exercise → transition to briefing
5. Click "Begin" → transition to running
6. Verify: AUTOMATIC injects fire on schedule (appear in timeline)
7. Verify: MANUAL injects stay SCHEDULED (don't auto-fire)
8. Force-trigger a MANUAL inject → verify it transitions to RUNNING
9. Verify: defects activate when their trigger conditions are met
10. Verify: clicking a defect in the defect list opens the **details panel** with metadata + action buttons
11. Verify: clicking an event in the timeline opens the details panel for that event
12. Verify: Pause/Cancel/Complete buttons work on events
13. Verify: Activate/Mitigate/Resolve buttons work on defects
14. Complete the exercise → verify **score appears** in snapshot (was hidden during RUNNING)

#### Trainee flow (`/player`)
15. Open `/player?exerciseId={id}&participantId=test&role=co` (classic mode, no gameMode param)
16. Verify: **inject feed** appears on the left (chronological, newest on top)
17. Verify: **defect panel** appears in the center with active defects
18. Verify: **systems + domains** appear on the right
19. Verify: when a decision opens → **blocking overlay** appears on top of the feed
20. Verify: overlay shows decision options, trainee can submit
21. Verify: after submission → overlay closes, feed is visible again

#### Multi-user flow (2 browser tabs)
22. Open GM in tab 1, trainee in tab 2
23. GM starts exercise → trainee sees briefing
24. GM begins → injects start firing → trainee sees them in inject feed
25. Decision opens → both tabs update (GM sees trainee monitor, trainee sees overlay)
26. Trainee submits → GM sees recommendation in trainee monitor
27. GM closes decision → overlay closes on trainee side

#### Audit verification
28. After the exercise: `GET /api/audit?exercise_id={id}`
29. Verify: trigger_event, cancel_event, pause_event, complete_event, activate_issue, mitigate_issue, resolve_issue appear
30. Verify: each entry has both RT and PT timestamps

#### Collaborative mode regression
31. Open `/player?exerciseId={id}&participantId=test&role=co&gameMode=simple_collaborative`
32. Verify: **role cards layout** renders (NOT the inject feed layout)
33. Verify: decisions show as inline role cards (NOT as overlay)
34. This confirms the classic/collaborative conditional doesn't break collaborative mode

---

## How to fix issues

When you find a failure:
1. Diagnose the root cause (read error, check selectors, inspect snapshot)
2. Write a failing test that captures the bug (TDD)
3. Fix the code
4. Verify the test passes
5. Run the broader test suite to check for regressions
6. Commit: `fix(tfc): <description>`
7. Move to the next issue

Do NOT batch multiple fixes. One issue at a time.

## Files to know

| Subsystem | Key files |
|-----------|-----------|
| Engine core | `apps/tfc/backend/engine/event_scheduler.py`, `issue_manager.py`, `decision_manager.py`, `exercise_engine.py` |
| Engine config | `apps/tfc/backend/engine/engine_config.py`, `state_changes.py` |
| Scenario | `apps/tfc/backend/features/scenario/scenario_content.py`, `scenario_loader.py`, `scenario_service.py`, `scenario_content_router.py` |
| Audit | `apps/tfc/backend/features/exercise/engine_actions_router.py`, `engine_router.py` |
| Codegen | `apps/tfc/codegen/generate-types.py` → `apps/tfc/frontend/src/app/core/generated/state-changes.types.ts` |
| GM view | `apps/tfc/frontend/src/app/features/game-master/game-master-view.ts`, `gm-defect-list.component.ts`, `gm-details-panel.component.ts`, `trainee-monitor.component.ts` |
| Player view | `apps/tfc/frontend/src/app/features/player/player-view.ts`, `player-view.html`, `inject-feed.component.ts`, `defect-panel.component.ts` |
| Builder | `apps/tfc/frontend/src/app/features/scenario-builder/scenario-event-editor.ts`, `scenario-issue-editor.ts`, `scenario-decision-editor.ts` |
| Store | `apps/tfc/frontend/src/app/core/exercise.store.ts` |
| Layout CSS | `apps/tfc/frontend/src/app/shared/components-exercise-layout.css`, `components-inject-feed.css` |

## Commit when done (do not push)

After all 3 passes are complete and all fixable issues are resolved, commit any remaining test fixes and report your findings.
