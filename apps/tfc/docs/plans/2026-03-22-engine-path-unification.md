# Engine Path Unification — Merge-First Refactor Plan

## Context

On 2026-03-21, `feature/scoring-systems-merged` added scoring tiers, event-triggered
system degradation, General Quarters, max_plays enforcement, and auto-complete on
sequence exhaustion. A cross-model audit (Claude Opus 4.6 + GPT 5.4) found that
these features work on the player-close happy path but break on alternate paths
(timeout, GM manual trigger). The root cause is structural: decision lifecycle
logic is duplicated across three locations with divergent side-effect chains.

## Decision: Merge Features First, Then Refactor

**Merge `feature/scoring-systems-merged` into master with targeted hotfixes,
then do the structural refactor as a clean branch.**

### Why merge first

- The branch contains ~1,200 lines of working feature code (scoring tiers, systems,
  completion overlay) that is functionally correct on the primary user path.
- The path-asymmetry bugs only manifest on edge paths (timeout of final decision,
  GM manual trigger of non-decision events with system effects, forced+exhausted
  option combos on second playthrough). These are real but low-probability in
  current usage (single-scenario, facilitator-supervised sessions).
- Doing the refactor on top of unmerged feature branches creates a tangled git
  history and makes review harder. A clean branch off master isolates the
  structural change.

### Why not merge as-is

Three bugs must be fixed before merge. They are small, targeted, and don't
require the full structural refactor:

## Phase 1: Hotfixes Before Merge

### Hotfix 0: `max_plays` default (BLOCKER, ~3 LOC)

**File:** `apps/tfc/backend/features/scenario/scenario_content.py`

`max_plays: int = 1` silently caps every existing seed option at 1 play.
The `is_option_exhausted` contract defines `0` as unlimited.

**Fix:** `max_plays: int = Field(default=0, ge=0)`

### Hotfix 1: Timeout auto-complete (BLOCKER, ~8 LOC)

**File:** `apps/tfc/backend/engine/exercise_engine.py` (`_timeout_loop`)

When the last decision times out, `force_trigger_next_decision()` returns empty
but the engine stays in RUNNING. The player-close path has auto-complete logic
(commit `0748a10`) but the timeout path does not.

**Fix:** After `force_trigger_next_decision()` returns empty in `_timeout_loop`,
check `get_next_decision_id` and phase, then call `self.complete()`:

```python
advance = self.force_trigger_next_decision(pt)
all_changes.extend(advance)
if (
    not advance
    and self._config.game_mode.get_next_decision_id(d.id) is None
    and self._phase == EnginePhase.RUNNING
):
    try:
        all_changes.append(await self.complete())
    except EngineStateError:
        pass
```

### Hotfix 2: `get_next_decision_id("")` → pass real ID (IMPORTANT, ~2 LOC)

**Files:** `engine_decision_service.py`, `exercise_engine.py`

Both callers pass `""` which accidentally works because `SimpleCollaborativeMode`
ignores the parameter. Fix to pass the actual `decision_id` to honor the protocol
contract.

### Merge checklist

After applying hotfixes:

- [ ] `make test-tfc-backend` passes
- [ ] `make test-tfc-frontend` passes
- [ ] Smoke test: play through full scenario, verify last-turn timeout completes
- [ ] PR to master, squash-merge the hotfixes, preserve feature commits

## Phase 2: Engine Path Unification (Clean Branch Off Master)

### Problem statement

Decision lifecycle is scattered across three paths that each inline their own
side-effect chain:

| Path | Location | Side effects implemented |
|---|---|---|
| Player submit | `EngineDecisionService` | close, score, forced cards, plays, sys effects, advance, complete |
| Timeout | `ExerciseEngine._timeout_loop` | close, score, plays, sys effects, advance (missing: forced+exhausted sys effects, complete) |
| GM trigger | `engine_actions_router` | force-trigger, open decision (missing: event sys effects, broadcast for non-decision events) |

When a new side effect is added, it must be wired into all three. Nobody does.

### Design principle

> Every simulation transition gets one public engine entry point.
> Every caller uses that entry point.
> Every entry path is tested for state equivalence.

### Proposed public engine API

```python
class ExerciseEngine:

    async def close_decision(
        self,
        decision_id: str,
        selected_option_ids: list[str],
    ) -> list[StateChange]:
        """Single canonical path for closing a decision.

        Handles: validate → close → score → resolve forced cards →
        record plays → system effects → advance turn → auto-complete.

        Raises NotFoundError if decision missing/closed.
        Raises BadRequestError if max_selections violated.
        Raises EngineStateError if phase is invalid.
        """

    def trigger_event(self, event_id: str) -> list[StateChange]:
        """Single canonical path for triggering an event.

        Handles: force-trigger → event system effects → open decision (if applicable).

        Raises NotFoundError if event missing/not triggerable.
        """
```

### Caller responsibilities after refactor

**Service** (`EngineDecisionService`):
- Pre-validate request shape (optional, for better HTTP errors)
- Call `engine.close_decision()`
- Broadcast returned changes

**Router** (`engine_actions_router`):
- Call `engine.trigger_event()`
- Broadcast returned changes

**Timeout loop** (`_timeout_loop`):
- Detect timeout
- Select auto-submit option
- Call `self.close_decision()`
- Emit via `_on_state_change`

### Internal helpers

```python
# Inside ExerciseEngine (private)

def _resolve_effective_options(
    self, selected, all_options, forced_ids,
) -> list[DecisionOptionSnapshot]:
    """Selected + auto-added forced cards. Used for plays + system effects."""

def _advance_to_next_turn(self, decision_id, pt) -> list[StateChange]:
    """Sequence advance + auto-complete. Absorbs current force_trigger_next_decision."""

def _is_timed_out(self, decision) -> bool
def _select_timeout_option(self, decision) -> str | None
```

### Key design constraints

1. **Engine enforces its own invariants.** `max_selections` checked inside
   `engine.close_decision()`, not only in the service. The service can
   pre-validate for nicer HTTP errors, but the engine is the authority.

2. **Domain errors, not silent empty returns.** `close_decision()` raises
   `NotFoundError` / `BadRequestError` / `EngineStateError`. Callers
   translate to HTTP status codes.

3. **`tick()` uses the same internal trigger path.** Scheduled event starts
   go through `_apply_event_system_effects` just like manual triggers.
   Both paths share `_apply_effects_list`.

4. **`force_trigger_next_decision()` becomes `_advance_to_next_turn()`.**
   It's an internal helper called only from `close_decision()`. The public
   `trigger_event()` handles individual events; sequencing stays inside the
   close-decision workflow.

### Task breakdown

| # | Task | Est. LOC | Depends |
|---|---|---|---|
| 1 | Add `engine.close_decision()`, migrate service to delegate | ~80 | — |
| 2 | Migrate `_timeout_loop` to call `engine.close_decision()` | ~40 | 1 |
| 3 | Add `engine.trigger_event()`, migrate router + unify tick path | ~60 | — |
| 4 | Path-equivalence regression tests | ~120 | 1, 2, 3 |
| 5 | Architecture guard test (no private engine access from service/router) | ~30 | 1, 3 |

Tasks 1 and 3 are independent — can be parallel work.

### Test matrix

**Decision close equivalence:**
- Single-turn: player close → completed
- Single-turn: timeout → completed (same final state)
- Multi-turn: intermediate close does not complete
- Final decision: forced + exhausted option still applies system effects
- Classic mode: does NOT auto-complete (phase is PAUSED, not RUNNING)
- Concurrent close + timeout: one succeeds, other raises, no corruption

**Event trigger equivalence:**
- Scheduled tick start vs GM manual trigger → same system state
- Sequence-advance force-trigger vs manual trigger → same decision opened
- Non-decision event with system effects → broadcasts correctly via both paths
- Decision event with system effects → opens decision AND mutates systems

**Boundary tests:**
- Invalid decision ID → NotFoundError
- Already-closed decision → NotFoundError
- Too many selections → BadRequestError
- `get_next_decision_id(decision_id)` called with real ID

### File size management

After refactor, `exercise_engine.py` should stay under 350 lines:
- `_timeout_loop` shrinks by ~30 lines (delegates to `close_decision`)
- New `close_decision` adds ~40 lines
- New `trigger_event` adds ~15 lines
- Helper extraction (`_is_timed_out`, `_select_timeout_option`) saves ~15 lines
- Net: roughly flat. If it exceeds 350, extract timeout monitor to
  `engine/timeout_monitor.py` — not a new abstraction, just a file split.

## Audit Trail

This plan was produced from a cross-model code audit:

- **Claude Opus 4.6** found: `max_plays` default blocker, forced+exhausted system
  effects gap, private method access from service, `get_next_decision_id("")`
  contract violation, `engine.complete()` race condition, missing ws-handler tests,
  file size violation, CSS token violations, loose `ScoreTier` typing.

- **GPT 5.4** found: timeout path never auto-completes (confirmed with runtime
  reproduction), GM manual trigger bypasses system effects + broadcast,
  `max_possible_score` product assumption for negative-only options.

- **Shared insight:** path independence is the quality bar for a simulation engine.
  Features that work on the happy path but break on timeout or manual trigger
  are not release-grade.

The structural fix (this plan) addresses the mechanism that produced the bugs,
not just the individual symptoms.
