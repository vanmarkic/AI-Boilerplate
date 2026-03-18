# TFC Practice Mode (Single-Player) — Design Document

## Context

TFC's `simple_collaborative` game mode requires 2+ players (decision-maker + advisors). The #1 adoption barrier is scheduling multiple people. Practice mode lets a single player run through a scenario solo, handling all roles — primarily for facilitator training and scenario testing.

This builds on the existing **2-player mode** precedent, which already collapses multiple advisor roles into one synthetic `all_advisors` role via composite recommendation keys.

## Decisions Made

| Question | Decision |
|----------|----------|
| Advisor recommendations in solo? | Keep as "thinking aloud" — player submits per-role recommendations before deciding |
| Entry flow | Reuse the 2-player toggle pattern (segmented control in waiting room) |
| In-game UX | Two-phase per decision: advisor panel first, then decision-maker view |
| Joinable list visibility | Hidden — practice exercises excluded from `GET /api/exercises/joinable` |

---

## 1. Data Model

### New column: `tfc_exercises.practice_mode`

```
practice_mode: Boolean, default=False, not null
```

Migration: `006_add_practice_mode.py` (with working `downgrade()`).

### No other schema changes

Scenarios, decisions, waiting room, and engine state are unchanged.

---

## 2. Backend

### Exercise Creation

`POST /api/exercises` accepts optional `practice_mode: bool`.

Validation: `practice_mode=true` requires `game_mode="simple_collaborative"`.

### Waiting Room

When `practice_mode=true`:
- `max_players = 1` (overrides `len(scenario.roles)`)
- Single participant gets synthetic role `"solo_player"`
- Role uniqueness trivially satisfied

### Joinable Exercises

`GET /api/exercises/joinable` filters out `practice_mode=true`.

### Engine

**No changes to `SimpleCollaborativeMode`.** The engine is player-count-agnostic.

Timer adjustment: when `practice_mode=true`, the scenario loader passes `base_decision_time_ms * 1.5` to the `SimpleCollaborativeMode` constructor, compensating for solo cognitive load.

### Recommendations

Solo player submits via `POST /api/decisions/{id}/recommendations` with composite key `participant_id:role_id` — identical to 2-player `all_advisors` pattern. Then closes via `POST /api/decisions/{id}/close`.

---

## 3. Frontend — Waiting Room

### Player-count selector

Replace the 2-player checkbox with a segmented control:

```
Players:  [Full Team]  [2 Players]  [Practice (Solo)]
```

- **Full Team** — all scenario roles shown individually (existing)
- **2 Players** — decision-maker + all-advisors (existing)
- **Practice (Solo)** — single slot, all roles auto-assigned

When "Practice (Solo)" selected:
- Role list collapses to: `"All Roles — You"`
- Player auto-claims on selection
- Start button enables immediately (1/1 filled)
- Banner: *"Practice mode — you'll play all roles"*

### Store changes

`ExerciseStore` signal: `twoPlayerMode()` → `playerCountMode()` with values `'full' | 'two_player' | 'practice'`.

---

## 4. Frontend — Player View (Two-Phase Decision Flow)

### Phase 1: Advisor Recommendations

When a decision opens in practice mode:
1. `AllAdvisorsPanelComponent` appears with tabs per advisor role
2. Player selects a recommendation for each role
3. Visual indicator (checkmark) on completed tabs
4. "Proceed to Decision" button appears after recommendations submitted

Submissions: `POST /api/decisions/{id}/recommendations` with `participant_id:role_id` composite keys.

### Phase 2: Final Decision

1. View transitions to decision-maker view
2. `AdvisorBubblesComponent` shows the recommendations just submitted
3. Player selects final option(s) and confirms

Submission: `POST /api/decisions/{id}/close`.

### Phase gate

The transition is **local component state** only — no server-side phase concept. Player view detects `practice_mode` from the exercise store and sequences Phase 1 → Phase 2 within the same component.

### Timer

Single timer runs across both phases. Base time multiplied by 1.5x for practice mode (set at engine start, not in frontend).

---

## 5. Files to Modify

### Backend
| File | Change |
|------|--------|
| `alembic/versions/006_add_practice_mode.py` | **New** — migration |
| `features/exercise/exercise_model.py` | Add `practice_mode` column |
| `features/exercise/exercise_router.py` | Accept `practice_mode` in create, filter joinable |
| `features/exercise/exercise_service.py` | Pass practice_mode through |
| `features/waiting_room/waiting_room_router.py` | Override `max_players=1` when practice |
| `features/scenario/scenario_loader.py` | Apply 1.5x timer multiplier when practice |
| `core/game_mode_constants.py` | No change needed |
| `engine/game_modes/simple_collaborative.py` | No change needed |

### Frontend
| File | Change |
|------|--------|
| `features/waiting-room/waiting-room-view.ts` | Segmented control replacing checkbox |
| `core/exercise.store.ts` | `playerCountMode` signal (replaces `twoPlayerMode`) |
| `features/player/player-view.ts` | Phase gate logic for practice mode |
| `features/player/player-decision-handlers.ts` | Handle phase transitions |

### Tests
| File | Change |
|------|--------|
| `features/exercise/practice_mode_flow_test.py` | **New** — full API integration test |
| `features/waiting_room/waiting_room_store_test.py` | Practice mode capacity tests |
| `features/exercise/exercise_joinable_test.py` | Filter exclusion test |
| `e2e/tests/practice-mode.spec.ts` | **New** — full E2E flow |

---

## 6. Verification

1. Create simple_collaborative exercise with practice_mode=true
2. Toggle "Practice (Solo)" in waiting room
3. Start exercise
4. Phase 1: submit advisor recommendations via tabbed panel
5. Phase 2: see bubbles, make final decision
6. Verify scoring, penalty accumulation, decision chaining
7. Verify timer reflects 1.5x multiplier
8. Verify exercise NOT in joinable list
9. Run all existing collaborative flow tests (no regressions)
