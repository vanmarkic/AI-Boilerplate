# TFC — Gaps, Deferred Items & Open PM Questions

**Date:** 2026-03-18
**Status:** Active — gaps 3, 5, 6, 10, 11 resolved in this PR
**Source:** `2026-03-17-tfc-collaborative-mode-review.md` §4, `2026-03-18-tfc-silent-wake-scoring-plan.md` §Remaining Gaps

---

## Medium Severity (remaining)

| # | Gap | Blocker? | Status | Details |
|---|---|---|---|---|
| 7 | **No `max_selections` field** | No | Open | `DecisionTemplateDef` can't express "pick up to N cards". No server-side validation of multi-choice selection count. Zero matches in codebase. |
| 8 | **Domain terminology hardcoded** | No | Partial | DB migration `003` created `tfc_domain_configs` table. `features/domain_config/` feature exists with CRUD. Two divergent `DomainConfig` interfaces still exist in shared package vs frontend service. Not yet wired to scenario loading via `scenario.domain_config_id`. |
| 9 | **Stress dimension not modeled** | No — waiting on PM | Deferred | Only `accumulated_penalty_ms` (time penalty) exists. PM wants stress as a running state shaped by good/bad decisions across turns. Mechanics undefined. Separate PR after PM defines formula. |

## Open PM Questions

- **Stress formula:** How does stress accumulate? Derived from score gap, or independent per-card deltas? Can it decrease? What does it affect beyond timer (narrative, UI)? PM needs to define before implementation.

---

## Resolved Gaps (for reference)

| # | Gap | Resolution |
|---|---|---|
| 1 | Turn chaining not wired | `close_decision` now calls `get_next_decision_id()` and opens next decision. Timeout loop also chains. |
| 2 | Timeout auto-submit not wired | Timeout calls `on_decision_timeout()` → selects worst option → applies scoring → chains. |
| 3 | **Participant identity not wired end-to-end** | Waiting room now passes `role` query param alongside `participantId` when navigating to `/player`. `player-view.ts` calls `store.setParticipantId()` and `store.setPlayerRole()` on init. Backend validates `participant_id` is non-empty. |
| 4 | Dummy scores on close | `CloseDecisionRequest` accepts `selected_option_ids`. Real scores computed from options and passed to `on_decision_closed_v2()`. |
| 5 | **Score not in snapshot** | `GameMode` protocol now has `snapshot()` method. `SimpleCollaborativeMode.snapshot()` returns `{total_score, penalty_ms, turn_number, next_decision_time_ms}`. `ClassicMode.snapshot()` returns `None`. `ExerciseEngine.snapshot()` includes `"score"` key. Frontend `applySnapshot()` reads score from snapshot. 3 property tests verify snapshot consistency. |
| 6 | **PlayerType never set from scenario** | `ScenarioContext` now carries `roles: list[RoleInfo]`. `scenario_loader.py` maps `RoleDef` → `RoleInfo`. `/engine/context` endpoint returns `roles`. Frontend `ScenarioContext` type includes `roles: RoleInfo[]`. Player view resolves `player_type` from context roles using the participant's assigned role and calls `store.setPlayerType()`. |
| 10 | **Frontend API client needs update** | `closeEngineDecision()` now accepts `selectedOptionIds: string[]` and sends `{ selected_option_ids }` body. Player view calls `closeEngineDecision()` with selected options to trigger engine scoring + turn chaining. |
| 11 | **`on_decision_closed` v1 deprecated** | v1 `on_decision_closed()` removed from `GameMode` protocol, `ClassicMode`, and `SimpleCollaborativeMode`. v2 `on_decision_closed_v2()` now inlines the scoring logic directly. All 46 existing tests migrated to v2 signatures. 3 new snapshot property tests added (24 total). |
| 12 | **Events not role-targeted** | `ScenarioEventDef` now has `target_roles: list[str]` (visibility filter, empty = all) and `role_descriptions: dict[str, str]` (per-role text override). `EventSnapshot` and `EventChange` include both fields. `split_targeted_changes()` handles `event_change` alongside `decision_opened`. Frontend `visibleEvents()` filters by player role; resolves role-specific description with fallback. Validation ensures role IDs exist in scenario. |
| 13 | **Tutorial scenario seed missing** | `silent_wake_tutorial.json` added: 3-turn port approach tutorial with 7 roles, 3 events, 3 decisions. Auto-discovered by seed loader. |
