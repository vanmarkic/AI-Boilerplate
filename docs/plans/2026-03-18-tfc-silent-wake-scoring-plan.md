# Plan: Silent Wake Per-Card Scoring and Forced Cards

**Date:** 2026-03-18
**Status:** Active
**Scope:** Wire scoring end-to-end, multi-card +/0/- scoring, forced card enforcement
**Depends on:** `2026-03-17-tfc-collaborative-mode-review.md` (gaps 1–4)

---

## PM Decisions

- Each card has its own point value: **positive** (good), **zero** (neutral), **negative** (bad)
- Score = sum of selected cards (no combo-matching)
- Forced actions: if a mandatory card is not selected → penalize, auto-play forced card with explanation
- Stress: deferred to a follow-up task once PM defines exact mechanics

---

## Phase 1: Fix the Wiring (gaps 1–4 from review)

Make existing scoring, turn chaining, and timeout work end-to-end.

### 1a. Pass real scores on decision close (gap 4)

| File | Change |
|---|---|
| `engine/decision_manager.py` | Add `selected_option_ids: list[str]` to `ActiveDecision`; accept in `close_decision()` |
| `features/exercise/engine_router.py` | Add `CloseDecisionRequest(selected_option_ids)`, compute `selected_score` and `max_score`, pass to `on_decision_closed()` |
| `engine/state_changes.py` | Add `selected_option_ids` to `DecisionClosed` |

### 1b. Wire turn chaining (gap 1)

| File | Change |
|---|---|
| `features/exercise/engine_router.py` | After `on_decision_closed()`, call `get_next_decision_id()`; if non-None, open next decision |

### 1c. Wire timeout auto-submit (gap 2)

| File | Change |
|---|---|
| `engine/exercise_engine.py` | When `DecisionManager.tick()` returns timed-out decisions, call `on_decision_timeout()` → get worst option → close with that selection → apply scoring |

---

## Phase 2: Multi-card +/0/- scoring

### 2a. Update `on_decision_closed` signature

| File | Change |
|---|---|
| `engine/game_modes/simple_collaborative.py` | Change from `(decision_id, selected_score, max_score)` to `(decision_id, selected_options, all_options)` so game mode computes scores internally |
| `engine/game_modes/__init__.py` | Align protocol |

Formula: `selected_score = sum(opt["score"] for opt in selected_options)`, `max_score = sum of top-N scores from all_options` (N = number selected).

### 2b. Update scenario data

| File | Change |
|---|---|
| `seeds/silent_wake.json` | Assign +/0/- scores per card per turn based on scenario doc |

### 2c. Update tests

| File | Change |
|---|---|
| `engine/game_modes/simple_collaborative_test.py` | Adapt to new signature, test negative scores |
| `engine/game_modes/simple_collaborative_prop_test.py` | Adapt strategies for negative scores, verify invariants hold |
| `engine/strategies.py` | Allow negative floats in `scores()` strategy |

---

## Phase 3: Forced card enforcement

### 3a. Add `forced_option_ids` to decision template

| File | Change |
|---|---|
| `engine/engine_config.py` | Add `forced_option_ids: list[str] = []` to `DecisionTemplateDef` |
| `seeds/silent_wake.json` | Add `"forced_option_ids": ["SWB20"]` to Turn 6 (`dec-t6`) |

### 3b. Add `ForcedCardApplied` state change

| File | Change |
|---|---|
| `engine/state_changes.py` | New `ForcedCardApplied` TypedDict: `type`, `decision_id`, `forced_option_id`, `reason` |

### 3c. Enforce on decision close

| File | Change |
|---|---|
| `features/exercise/engine_router.py` (or game mode) | On close: check if `forced_option_ids ⊆ selected_option_ids`. If missing: auto-add forced card, apply penalty, emit `ForcedCardApplied` with explanation |

### 3d. Tests

| File | Change |
|---|---|
| `engine/game_modes/simple_collaborative_test.py` | Test forced card auto-inclusion and penalty |
| `engine/game_modes/simple_collaborative_prop_test.py` | Property: forced cards always present in final selection |

---

## Verification

1. `pytest apps/tfc/backend/engine/game_modes/` — unit + property tests
2. `make validate` — full suite
3. Manual: start Silent Wake, play through turns, verify score/timer/forced-card in WebSocket messages

---

## Deferred

- **Stress dimension**: separate from score, TBD once PM defines mechanics
- **`max_selections` field**: "pick up to N cards" constraint (gap 7 from review)
- **Score in snapshot**: reconnecting player sees score (gap 5)
- **Player identity**: participant_id="TODO" (gap 3)
