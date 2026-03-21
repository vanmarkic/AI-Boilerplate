# Scoring Tiers — Design Decisions

## Decision 1: Tier computed on backend (not frontend)
Backend owns `score_tier_thresholds` on `ScenarioContent` — single source of truth.
Tier added to score snapshot as `score_tier: "lo" | "mid" | "hi" | null`.
`null` during gameplay, computed when snapshot is requested.
Available for audit/reporting without frontend logic.

## Decision 2: Tier calculation formula
`ratio = total_score / max_possible_score` (sum of best option scores across all decisions in sequence).
`ratio < lo_threshold` → "lo", `ratio < mid_threshold` → "mid", else → "hi".
`max_possible_score` precomputed from decision templates at scenario load time.

## Decision 3: max_possible_score computation
Per decision template:
- `single_choice`: max score among options
- `multi_choice`: sum of top N scores (N = max_selections or all options)
Only templates in `decision_sequence` are counted.
Passed to `SimpleCollaborativeMode` via game mode config at init.

## Decision 4: Remove numeric score from player-facing data
`total_score` stripped from frontend `ScoreState` — players never see numbers.
`ScoreBarComponent` keeps stress/turn/timer display but drops score counter.
Backend still tracks `total_score` internally for tier calculation.

## Decision 5: Completion overlay pattern
Follows `BriefingOverlayComponent` pattern — fullscreen overlay with backdrop.
Shows tier as encouraging message, never raw label or number.
Tier messaging (all positive per SPECS):
- Lo: "Solid Effort" + "Your team showed determination..."
- Mid: "Great Performance" + "Your team demonstrated strong skills..."
- Hi: "Outstanding" + "Your team achieved exceptional results..."

## Decision 6: score_tier delivery to frontend
Added `score_tier` field to the engine snapshot's `score` dict.
Frontend reads it from store when `phase === 'completed'`.
No new WebSocket message type needed — existing snapshot sync covers it.

## Decision 7: ScenarioContext extended
`score_tier_thresholds` added to `ScenarioContext` dataclass and `/context` endpoint.
Frontend can read thresholds if needed for display, but currently only uses the computed tier.

## Decision 8: score_tier in ScoreChange WS messages
Added `score_tier` to `ScoreChange` state change (not just snapshot). This keeps the
frontend tier value up-to-date on every turn close, not just on initial page load.

## Decision 9: Don't call svc.stop() on completion
The `complete_engine` endpoint previously called `svc.stop()` which tore down
WS connections immediately after completion. This prevented the completion overlay
from rendering because clients lost their connection before receiving the phase_change.

Fix: `complete_engine` now only broadcasts the phase_change and logs to audit.
The engine and WS connections stay alive. Clients disconnect naturally when the
user clicks "Return to Home" in the completion overlay. The engine can be cleaned
up lazily (e.g., on server restart or via a TTL).

Frontend mitigations for `exercise_stopped`:
- `reason=completed` → set phase to completed + disconnect WS (don't navigate away)
- `phase_change(completed)` via state_changes → disconnect WS intentionally
- Other stop reasons (stopped_by_gm) → navigate to home as before
