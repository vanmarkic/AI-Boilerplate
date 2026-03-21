# Player View Property Tests + Visual Snapshots

**Date**: 2026-03-21
**Status**: Approved
**Scope**: `apps/tfc/frontend/e2e/`

## Problem

The player view has 3 Playwright test files using hand-crafted state matrices
with documented invariants. These tests are well-structured but have gaps:

1. **No random generation** — combinations are hand-picked, not generated
2. **No shrinking** — failures show the full scenario, not minimal reproduction
3. **No visual regression** — tests check DOM presence but not rendering correctness
4. **Bounded coverage** — ~30 combos tested out of ~14,400 meaningful combinations

## Solution

Add fast-check for property-based testing and Playwright's built-in
`toHaveScreenshot()` for visual regression. Keep existing tests untouched as
pinned regressions.

## Deliverables

### 1. `e2e/helpers/arbitraries.ts` — State Generators

8-dimension arbitrary producing `{ snapshot, context, role, participantId }`:

| Dimension | Arbitrary | Values |
|-----------|-----------|--------|
| Phase | `fc.constantFrom(...)` | setup, briefing, running, paused, completed |
| Score | `fc.option(scoreRecord)` | null or { total_score, stress, turn_number, next_decision_time_ms } |
| Events | `fc.array(eventArb, {maxLength:3})` | 0-3 events with scheduled/running/completed lifecycle |
| Issues | `fc.array(issueArb, {maxLength:2})` | 0-2 issues with lifecycle + released flag |
| Decisions | `fc.array(decisionArb, {maxLength:1})` | 0-1 open decisions with target_roles + recommendations |
| Role | `fc.constantFrom(...)` | co, nav, ops |
| Systems | `fc.array(systemArb, {maxLength:4})` | 0-4 systems with power on/off, operational green/yellow/red |
| Practice mode | `fc.boolean()` | true/false |

**Constraint filtering** (`fc.filter`):
- `setup`/`briefing` → score is null, no open decisions
- Scheduled events have no `started_at_pt_ms`
- Completed events have both `started_at` and `completed_at`

### 2. `e2e/tests/player-view-properties.spec.ts` — 10 Properties × 30 Runs

Each invariant from the existing file header becomes an `fc.asyncProperty`:

| # | Property | Assertion |
|---|----------|-----------|
| P1 | Header always visible | `.player-header__title`, `tfc-phase-badge` visible |
| P2 | Phase badge matches state | `tfc-phase-badge` contains phase text |
| P3 | Turn banner visible iff score && phase ≠ briefing | `tfc-turn-banner` visibility matches condition |
| P4 | Score bar same condition as P3 | `tfc-score-bar` visibility matches condition |
| P5 | Events card shows running + completed only | Scheduled events hidden, others visible |
| P6 | Issues card shows released only | Unreleased hidden, released visible |
| P7 | Decision overlay iff matching role | `tfc-decision-panel` visibility matches role targeting |
| P8 | Advisor prefix iff advisor role | `[Advisor]` text visible iff role is advisor type |
| P9 | Advisor bubbles iff DM + recs exist | `tfc-advisor-bubbles` visibility matches condition |
| P10 | Context panel shows content when loaded | Briefing/objectives visible when context has them |

Each property: generate state → `installMocks()` → navigate → assert.
30 runs per property (configurable via `PROP_RUNS` env var).

### 3. `e2e/tests/player-view-snapshots.spec.ts` — 10 Visual Snapshots

Deterministic curated states with `toHaveScreenshot()`:

| # | State | Purpose |
|---|-------|---------|
| S1 | running, CO, score, events, issues, decision+recs | Full state |
| S2 | running, NAV, same data | Advisor perspective |
| S3 | briefing, CO, no score, no decisions | Briefing phase |
| S4 | paused, NAV, score, no decisions | Paused state |
| S5 | completed, CO, score | Completed state |
| S6 | setup, CO, no data | Empty setup |
| S7 | running, CO, systems red/yellow, decision | Systems degraded |
| S8 | running, NAV, practice mode, score | Practice mode advisor |
| S9 | running, CO, no events/issues/decisions | Clean running |
| S10 | running, CO, 3 events, 2 issues, decision targeted to nav | Busy, no decision for CO |

Baselines committed to `e2e/tests/player-view-snapshots.spec.ts-snapshots/`.
Regenerate with `--update-snapshots`.

## File Structure

```
e2e/
  helpers/
    arbitraries.ts              ← NEW: state generators
  tests/
    player-view-states.spec.ts        ← EXISTING (untouched)
    player-view-properties.spec.ts    ← NEW: fast-check properties
    player-view-snapshots.spec.ts     ← NEW: visual regression
```

## Dependencies

- `fast-check` — npm devDependency (MIT, ~200KB)
- `@playwright/test` — already installed, `toHaveScreenshot()` built-in

## CI Constraints

- Property tests: 30 runs × 10 properties × ~200ms = ~60s
- Visual snapshots: 10 states × ~500ms = ~5s
- Total new test time: ~65s (within 2-minute budget)

## Decisions

- **Separate files** over inline: existing tests are documentation, property tests are discovery
- **30 runs** default: balances coverage vs CI speed
- **No fast-check for snapshots**: deterministic baselines are easier to maintain
- **Systems + practice mode included**: covers the full player view state space
