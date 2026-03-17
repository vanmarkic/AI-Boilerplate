# TFC Simple-Collaborative Mode — Domain Review & Property Spec

**Date:** 2026-03-17
**Status:** Active
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
2. **Stress is time penalty.** No separate stress dimension — `accumulated_penalty_ms` in `SimpleCollaborativeMode` is the sole mechanical consequence of suboptimal choices.
3. **System state changes are out of scope.** May be relevant for a future game mode but not modeled in the current domain.
4. **`score: float` per option is sufficient.** Multi-dimensional consequences (stress + system changes) are not needed; the single score drives the penalty formula.

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

| # | Gap | Location | Impact |
|---|---|---|---|
| 1 | **Turn chaining not wired** | `get_next_decision_id()` exists but engine never calls it after `close_decision` | Next decision never opens automatically |
| 2 | **Timeout auto-submit not wired** | `on_decision_timeout()` exists but tick loop doesn't check deadlines | Decisions never auto-close on timeout |
| 3 | **Player identity hardcoded** | `engine_router.py:214` has `participant_id="TODO"` | All advisors overwrite same recommendation slot |
| 4 | **Dummy scores on close** | `engine_router.py:196` passes `0.0, 0.0` to `on_decision_closed` | Scoring is always zero regardless of choice |

### Medium severity

| # | Gap | Location | Impact |
|---|---|---|---|
| 5 | **Score not in snapshot** | `exercise_engine.snapshot()` | Reconnecting player loses score display |
| 6 | **PlayerType never set from scenario** | Frontend store `setPlayerType()` never called | Advisor/decision-maker distinction dead in UI |
| 7 | **No `max_selections` field** | `DecisionTemplateDef` | Cannot express "pick up to 2 cards" constraint |

## 5. Property Test Coverage

13 property tests added in `engine/game_modes/simple_collaborative_prop_test.py`, covering invariants that must hold for **all** valid inputs:

### Invariants tested

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

### Strategies added to `engine/strategies.py`

| Strategy | Generates |
|---|---|
| `scores()` | Non-negative floats [0, 100] |
| `penalty_factors()` | Positive floats [0.01, 10] |
| `decision_sequences()` | Lists of unique decision IDs |
| `option_lists()` | Lists of `{id, label, score}` dicts |

### Penalty formula under test

```
penalty_ms = (max_score - selected_score) * penalty_factor * 1000
effective_time = max(min_decision_time_ms, base_decision_time_ms - accumulated_penalty_ms)
```

## 6. Files Changed

| File | Change |
|---|---|
| `engine/game_modes/simple_collaborative_prop_test.py` | New — 13 property tests |
| `engine/strategies.py` | Added 4 reusable hypothesis strategies |
