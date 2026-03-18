# Silent Wake — Scoring Logic Clarifications

**Status:** Resolved — answers informed implementation in `2026-03-18-tfc-silent-wake-scoring-plan.md`

The scenario document categorizes card combinations each turn as **Best** or **Acceptable**, with a stress delta for each. The following questions were resolved with the PM before implementation.

## Resolved Questions

### 1. How do Best and Acceptable influence game mechanics and scoring?

**PM Answer:** Each card has its own point value: positive (+) for good, zero (0) for neutral, negative (-) for bad. Score = sum of selected cards. No combo-matching — per-card scoring only.

**Implementation:** `on_decision_closed_v2()` sums selected option scores. Penalty = (max_possible - selected_sum) * factor * 1000.

### 2. What happens when players pick a combination that is neither Best nor Acceptable?

**PM Answer:** Cards have individual scores. Poor choices have negative scores, which reduce total score and increase time penalty.

**Implementation:** Silent Wake scenario updated with -5.0 and -3.0 scores for poor choices (e.g., premature Decoy Deployment, premature Gun Engagement).

### 3. What about partial combos — is it all-or-nothing?

**PM Answer:** No combo-matching. Score is purely additive per card. Selecting 1 of 2 best cards gets partial credit.

**Implementation:** `max_score = sum(top-N scores)` where N = number of cards selected. Selecting fewer good cards still earns their individual scores.

### 4. Should there be a graduated scale or just categories?

**PM Answer:** Per-card point values create a natural gradient. No binary categories.

**Implementation:** Cards range from +10.0 (best) through +6.0 (acceptable) to -5.0 (counterproductive).

### 5. Cards noted as "also valid" in the facilitator notes

**PM Answer:** Covered by per-card scoring — "also valid" cards get moderate positive scores (6.0).

### 6. Facilitator-forced actions

**PM Answer:** If a mandatory card is not selected, the player is penalized and the forced card is auto-played with an explanation.

**Implementation:** `forced_option_ids` field on `DecisionTemplate`. Engine auto-adds missing forced cards and emits `ForcedCardApplied` state change. Turn 6 has `forced_option_ids: ["SWB20"]`.

## Open Question (deferred)

### Stress as a separate dimension

**PM direction:** Stress is a running state shaped by good/bad decisions across turns — not just score→timer.

**Status:** Deferred to a follow-up task. Currently only `accumulated_penalty_ms` (time pressure) exists. PM needs to define:
- How stress accumulates (derived from score gap? independent per-card stress deltas?)
- How stress affects gameplay (timer only? narrative? UI indicator?)
- Whether stress can decrease (good decisions reduce stress?)
