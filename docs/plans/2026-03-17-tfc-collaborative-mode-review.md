# TFC Simple-Collaborative Mode — Domain Review & Property Spec

**Date:** 2026-03-17
**Updated:** 2026-03-18
**Status:** Partially resolved — see §4 gap status
**Scope:** Domain audit, terminology mapping, property test coverage

---

## 1. Context

The Simple-Collaborative game mode was reviewed against a real scenario document (a 3-turn naval port approach tutorial). The review mapped external game mechanics onto the TFC generic domain model and identified terminology risks and structural gaps.

## 2. Domain Mapping

External game concepts mapped to TFC generic domain:

| Game Concept | TFC Domain Entity | Notes |
|---|---|---|
| Turn (1, 2, 3) | Implicit via `current_index` in `SimpleCollaborativeMode` | No first-class Turn entity; sequence position is sufficient |
| Inject (NAV, OPS, EO...) | `Event` with `EventLifecycle` | Each inject is a narrative event triggered at turn start |
| Card (SWB01, SWB02...) | `DecisionOptionDef` within `DecisionTemplateDef` | Defined per-scenario, not a shared pool |
| "Pick up to N cards" | `question_type: "multi_choice"` | Gap: no `max_selections` field yet |
| Stress | `accumulated_penalty_ms` | Time penalty — stress delta maps to penalty formula |
| System state (Green/Yellow) | Out of scope | Future game mode concern, not modeled |
| Consequence | `DecisionOptionDef.score` | Single float sufficient; stress = time penalty |
| Facilitator says | `Decision.description` or turn-level narrative event | Maps to event description or decision context |
| CO commits | `close_decision()` by decision-maker role | Direct match |
| Discussion phase + timer | Advisory phase (recommendations before ruling) | Timer = `base_time - accumulated_penalty` |

### Key mapping decisions

1. **Cards are options, not a shared pool.** Each `DecisionTemplateDef` owns its options. A reusable card pool across turns is a nice-to-have, not needed for current mode.
2. **Stress is time penalty (for now).** `accumulated_penalty_ms` is the sole mechanical consequence. PM wants a separate stress dimension — **deferred** pending mechanics definition.
3. **System state changes are out of scope.** May be relevant for a future game mode but not modeled in the current domain.
4. **`score: float` per option supports +/0/- values.** *(Updated 2026-03-18)* Cards can have positive, zero, or negative scores. Selected score = sum of selected cards. Penalty = (max_possible - selected_sum) * factor * 1000.
5. **Forced cards are enforced by the engine.** *(Added 2026-03-18)* `forced_option_ids` on `DecisionTemplate` causes auto-inclusion with penalty + `ForcedCardApplied` state change when omitted.

## 3. Terminology Risk: Recommendation vs Decision

The word "decision" is overloaded:

- **DecisionTemplate / ActiveDecision** = the question posed to players (a noun/object)
- **close_decision** = the decision-maker's binding choice (a verb/action)
- **submitResponse** (DB layer) = also the binding choice, but called "response"
- **submit_recommendation** = an advisor's non-binding input

Risk: "Did the advisor make a decision?" is ambiguous. The advisor submitted a recommendation, not the ruling.

### Recommended clarification (not yet implemented)

Keep **Decision** for the object (the question/prompt). Clarify actions:

| Role | Current Name | Recommended Name |
|---|---|---|
| Advisor action | `submit_recommendation` | `submit_advisory` |
| Decision-maker action | `close_decision` | `submit_ruling` or `close_decision` (acceptable) |
| DB persistence | `submitResponse` | Align with chosen term |

Severity: **Medium.** No code change required now, but terminology should be locked before onboarding external teams.

## 4. Domain Design Gaps

Identified during review, ordered by severity:

### High severity (blocking end-to-end collaborative flow)

| # | Gap | Location | Status | Resolution |
|---|---|---|---|---|
| 1 | **Turn chaining not wired** | `engine_router.py`, `exercise_engine.py` | **RESOLVED** | `close_decision` now calls `get_next_decision_id()` and opens next decision. Timeout loop also chains. |
| 2 | **Timeout auto-submit not wired** | `exercise_engine.py:_timeout_loop()` | **RESOLVED** | Timeout calls `on_decision_timeout()` → selects worst option → applies scoring → chains. |
| 3 | **Player identity hardcoded** | `engine_router.py` | **RESOLVED** | `participant_id` wired through waiting room → player view → recommendation flow (PR #121). |
| 4 | **Dummy scores on close** | `engine_router.py` | **RESOLVED** | `CloseDecisionRequest` accepts `selected_option_ids`. Real scores computed from options and passed to `on_decision_closed_v2()`. |

### Medium severity

| # | Gap | Location | Status | Resolution |
|---|---|---|---|---|
| 5 | **Score not in snapshot** | `exercise_engine.snapshot()` | **RESOLVED** | `GameMode.snapshot()` returns score data. `ExerciseEngine.snapshot()` includes `"score"` key. Frontend `applySnapshot()` reads score (PR #118). |
| 6 | **PlayerType never set from scenario** | Frontend store | **RESOLVED** | `ScenarioContext` carries `roles: list[RoleInfo]`. Player view resolves `player_type` from context roles and calls `store.setPlayerType()` (PR #121). |
| 7 | **No `max_selections` field** | `DecisionTemplateDef` | **OPEN** | Cannot express "pick up to 2 cards" constraint. |
| 8 | **Domain terminology hardcoded** | `tfc-shared/constants/domains.ts`, `domain.service.ts` | **OPEN** | See §4.1 |

### New gaps identified during 2026-03-18 implementation

| # | Gap | Location | Severity | Impact |
|---|---|---|---|---|
| 9 | **Stress dimension not modeled** | `SimpleCollaborativeMode` | Medium | PM wants stress as a running state shaped by good/bad decisions. Currently only `accumulated_penalty_ms` (time pressure) exists. Stress mechanics TBD by PM. |
| 10 | **Duplicate close_decision endpoint removed but not verified in frontend** | `engine_actions_router.py` | Low | The close_decision endpoint was consolidated into `engine_router.py`. Frontend API client may need regeneration (`make generate`). |
| 11 | **`on_decision_closed` vs `on_decision_closed_v2` coexistence** | `GameMode` protocol | Low | Both methods exist. `on_decision_closed` (scalar) is used internally by v2. Consider deprecating scalar version once all callers migrate. |

### §4.1 Domain terminology should live in the DB

`DomainConfig` (terminology, theme, roles, severity levels) is currently hardcoded as compile-time constants in two places:

- **Shared package:** `packages/tfc-shared/src/constants/domains.ts` — 3 presets (default, cybersecurity, healthcare)
- **Frontend service:** `apps/tfc/frontend/src/app/core/domain.service.ts` — 4 presets (default, cybersecurity, healthcare, military) with a different `DomainConfig` interface

Problems:
1. **Duplicated and divergent.** The two `DomainConfig` interfaces don't match (shared has `theme: ThemeConfig` object, frontend has `theme: string`). The preset lists differ (shared has no military, frontend has no `scenario` term).
2. **Not scenario-bound.** A scenario author cannot pick or customize terminology — it's a frontend-only toggle with no persistence.
3. **Not extensible.** Adding a new domain (e.g., naval, emergency management) requires code changes and a redeploy.

Target state:
- `DomainConfig` becomes a DB entity, seeded with current presets.
- A scenario references a `domain_config_id`. When the exercise loads, terminology is fetched from the API and applied.
- `DomainService` loads from the API at exercise start instead of from a hardcoded map.
- The shared package defines the **interface only** (`TerminologyMap`, `DomainConfig`), not the presets.
- This is functionally i18n: the scenario says "use military locale" and all UI terms resolve at runtime.

## 5. Property Test Coverage

21 property tests in `engine/game_modes/simple_collaborative_prop_test.py`, covering invariants that must hold for **all** valid inputs:

### Original invariants (2026-03-17)

| Test Class | Invariant | Examples |
|---|---|---|
| `TestScoreMonotonicity` | `total_score` never decreases across turns | 200 |
| `TestPenaltyMonotonicity` | `accumulated_penalty_ms` never decreases | 200 |
| `TestTimerFloor` | Effective decision time >= `min_decision_time_ms` | 300 |
| `TestTimerFloor` | Zero penalty yields base time | 100 |
| `TestTurnCounting` | `turn_number` == number of `on_decision_closed` calls | 100 |
| `TestSequenceAdvancement` | Walks sequence in order, returns `None` at end | 200 |
| `TestSequenceAdvancement` | `current_index` never causes out-of-bounds | 100 |
| `TestPenaltyFormula` | `penalty_ms == (max - selected) * factor * 1000` | 300 |
| `TestPenaltyFormula` | Perfect score (selected == max) yields zero penalty | 200 |
| `TestScoreChangeStructure` | Returns exactly 1 well-formed `ScoreChange` dict | 200 |
| `TestAutoSubmitPicksWorst` | Timeout selects minimum-score option | 200 |
| `TestAutoSubmitPicksWorst` | Empty options returns `None` | 1 |
| `TestMultiTurnAccumulation` | Full sequence: score, penalty, turn, index all consistent | 200 |

### V2 scoring invariants (added 2026-03-18)

| Test Class | Invariant | Examples |
|---|---|---|
| `TestV2ScoringFormula` | Penalty is always non-negative (even with negative card scores) | 200 |
| `TestV2ScoringFormula` | Selecting the best single option yields zero penalty | 200 |
| `TestV2ScoringFormula` | Total score equals sum of selected option scores | 200 |
| `TestV2ScoringFormula` | V2 scoring advances turn number | 100 |
| `TestV2TimerFloor` | Timer floor holds with v2 scoring + signed scores | 200 |
| `TestForcedCardInvariant` | Omitting a forced card emits `ForcedCardApplied` | 200 |
| `TestForcedCardInvariant` | Including a forced card emits no forced change | 200 |
| `TestForcedCardInvariant` | No forced IDs → no forced change | 100 |

### Strategies in `engine/strategies.py`

| Strategy | Generates |
|---|---|
| `scores()` | Non-negative floats [0, 100] |
| `signed_scores()` | Floats [-50, 100] (positive, zero, or negative) |
| `penalty_factors()` | Positive floats [0.01, 10] |
| `decision_sequences()` | Lists of unique decision IDs |
| `option_lists()` | Lists of `{id, label, score}` dicts (non-negative scores) |
| `signed_option_lists()` | Lists of `{id, label, score}` dicts (+/0/- scores) |

### Penalty formula under test

```
# V1 (scalar): still used internally
penalty_ms = (max_score - selected_score) * penalty_factor * 1000
effective_time = max(min_decision_time_ms, base_decision_time_ms - accumulated_penalty_ms)

# V2 (option-list): selected_score = sum(selected), max_score = sum(top-N)
selected_score = sum(opt["score"] for opt in selected_options)
max_score = sum(sorted([o["score"] for o in all_options], reverse=True)[:N])
```

## 6. Files Changed

### 2026-03-17 (initial review)

| File | Change |
|---|---|
| `engine/game_modes/simple_collaborative_prop_test.py` | New — 13 property tests |
| `engine/strategies.py` | Added 4 reusable hypothesis strategies |

### 2026-03-18 (scoring + forced cards)

| File | Change |
|---|---|
| `engine/decision_manager.py` | `selected_option_ids` on `ActiveDecision` and `close_decision()` |
| `engine/engine_config.py` | `forced_option_ids` on `DecisionTemplate` |
| `engine/exercise_engine.py` | Timeout wiring: auto-submit + scoring + turn chaining |
| `engine/game_modes/__init__.py` | `on_decision_closed_v2` added to `GameMode` protocol |
| `engine/game_modes/classic.py` | No-op `on_decision_closed_v2` |
| `engine/game_modes/simple_collaborative.py` | `on_decision_closed_v2` with forced card enforcement |
| `engine/game_modes/simple_collaborative_prop_test.py` | +8 property tests (v2 scoring, forced cards) |
| `engine/game_modes/simple_collaborative_test.py` | +9 unit tests (v2 scoring, forced cards) |
| `engine/state_changes.py` | `ForcedCardApplied` TypedDict, `selected_option_ids` on `DecisionClosed` |
| `engine/strategies.py` | `signed_scores()`, `signed_option_lists()` |
| `features/exercise/engine_actions_router.py` | Removed duplicate `close_decision` endpoint |
| `features/exercise/engine_router.py` | `CloseDecisionRequest`, real scoring, turn chaining |
| `features/scenario/scenario_content.py` | `forced_option_ids` on `DecisionTemplateDef` |
| `features/scenario/scenario_loader.py` | Pass `forced_option_ids` through |
| `seeds/silent_wake.json` | Negative scores on poor choices, `forced_option_ids` on Turn 6 |
