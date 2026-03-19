# Player Board Layout — Solo / 2-Player Mode

**Date:** 2026-03-19
**Scope:** Player view for solo and 2-player game modes (`all_roles`, `all_advisors`, `solo_player`). Multi-player mode is unchanged.

## Problem

The current player view renders event descriptions inside a modal overlay (the decision panel uses `ui-dialog-panel`). Event descriptions are duplicated — once in the "Released Events" sidebar and again in the modal. Role-specific event descriptions are not surfaced as individual cards. In solo/2-player mode, all role-specific views of the single active decision should be visible simultaneously as individual cards, but currently only one decision panel is shown at a time.

## Design

### Layout Structure

The player view becomes a single flat board:

```
┌─────────────────────────────────────────────────┐
│  Header (title, RT clock, phase badge)          │
├─────────────────────────────────────────────────┤
│  Turn Banner (turn number, title, event desc)   │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ │
│  │ CO   │ │ OPS  │ │ NAV  │ │ EO   │ │ CYOP │ │
│  │      │ │      │ │      │ │      │ │      │ │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ │
│  ┌──────┐ ┌──────┐                              │
│  │ AAWO │ │ PWO  │     (wrapping flex grid)     │
│  │      │ │      │                              │
│  └──────┘ └──────┘                              │
│                                                 │
├─────────────────────────────────────────────────┤
│  Score bar (pinned to bottom of viewport)       │
├─────────────────────────────────────────────────┤
│  Footer                                         │
└─────────────────────────────────────────────────┘
```

### Removed Panels

The following are dropped from the solo/2-player layout:

- "Released Events" list (left column)
- "Active Issues" list (right column)
- Issue detail view
- Context panel (briefing/objectives/rules)
- Decision history — intentionally inaccessible in this mode for now

### Turn Banner

Displays at the top of the board area. This is a new section in the template (not the existing `TurnBannerComponent`, which only supports `label` and `turnNumber`).

- **Turn number** (e.g., "TURN 2")
- **Event title** (e.g., "Unexpected Current")
- **Event main description** — the generic `description` field from the event

This replaces the old "Released Events" sidebar for conveying the event narrative.

### Deriving the Current Turn Event

The engine opens one decision at a time (per `decision_sequence`). The current turn event is derived as:

1. Take the first active decision from `activeDecisions()`
2. Look up its `event_id` to find the associated `EventSnapshot` from the store
3. That event provides the turn banner text and `role_descriptions` for the cards

If no active decision exists (between turns or before the exercise starts), the card grid is empty and the turn banner shows "Waiting for next turn..."

### Blue Card Rules

The CO can play up to 2 blue cards per turn (normally different cards).

Each blue card (decision option) has a `role` field:

- **COMMON cards** (`role: null`) — available to all roles. Any team member can recommend them. Examples: SWB01 (Continue Mission), SWB03 (Internal Sync), SWB07 (Start Investigation), SWB20 (General Quarters).
- **Role-specific cards** (`role: "pwo"`, `role: "eo"`, etc.) — tied to a specific officer's domain. Only that role can recommend them. Examples: SWB18 (Damage Control Focus, PWO), SWB15 (Repair Component, EO).

The `DecisionOption` interface already has a `role: string | null` field. When rendering options on a role card:
- **Advisor cards**: show COMMON options + options matching that role's ID
- **CO card**: show ALL options (CO makes the final decision seeing the full picture)

### Combined Role Cards

Each role defined in the scenario gets one card. A card contains:

1. **Role ID + label** (e.g., "NAV — Navigator")
2. **Badge** indicating card state (see badge state machine below)
3. **Intel section** — the role-specific event description from `event.role_descriptions[roleId]`, if present. If no role-specific intel exists for this turn, show "No role-specific intel this turn."
4. **Decision section** (only if the role is in the decision's `target_roles`) — the decision question, filtered options (COMMON + role-matching), and a submit button.

### Card Badge State Machine

A role card's badge reflects its current state:

| Condition | Badge |
|-----------|-------|
| Has intel, no decision targeting | `INTEL` |
| Has decision targeting, not yet submitted | `DECISION` |
| Had decision targeting, now submitted | `DONE` |

Roles with both intel AND a decision show `DECISION` (or `DONE` after submission). The intel is always visible regardless of badge.

### Card Visual Types

| State | Border | Background | Opacity |
|-------|--------|------------|---------|
| Intel only | 1px border + 3px cyan left | Dark navy (`--color-card`) | 1.0 |
| Decision (active) | 2px green | Dark green | 1.0 |
| Decision (done) | 1px grey | Dark muted | 0.7 |

### Card Ordering

Cards follow the scenario's `roles` array order (e.g., co, ops, nav, eo, cyop, aawo, pwo). Roles that have neither intel nor a decision for the current turn are not shown.

### Game Mode to Card Visibility

| Mode | CO card visible? | Advisor cards visible? | Can submit CO decision? | Can submit advisor recs? |
|------|-----------------|----------------------|------------------------|------------------------|
| `all_roles` / `solo_player` | Yes | Yes (all) | Yes | Yes |
| `all_advisors` | No | Yes (all) | No | Yes |
| Practice mode | Yes | Yes (all) | Yes | Yes |

In `all_advisors` mode, the player only sees advisor cards and submits recommendations. The CO decision is made by a separate player/session.

### CO Card — Advisor Recommendations

The CO card (or whichever role has `player_type: "decision_maker"`) has an additional section: **Advisor Recommendations**. This section:

- Lists each advisor role targeted by the same decision
- Shows their selection once submitted (e.g., "NAV: SWB07 — Start Investigation")
- Shows "pending..." with a dashed border for advisors who haven't submitted yet
- Updates in real-time as advisors submit

**Recommendation key format:** The `ActiveDecision.recommendations` field is `Record<string, string>` keyed by `participantId:roleId`. To display on the CO card, parse the key by splitting on `:` to extract the `roleId`, then resolve to the role label from the scenario's `roles` array.

The CO card is **always active** — the CO can submit their decision at any time, before or after advisors have submitted.

### Submission Flow

- Each decision-target role has its own submit button on its card
- The player submits one role at a time
- On submission, the card transitions to "done" state (faded, showing selection)
- Advisor submissions appear on the CO card's recommendations section
- When the CO submits, the decision is closed and the turn advances

### Turn Transitions

When a new turn fires:

- All previous turn's cards are **replaced entirely** (clean slate)
- New turn banner appears with the new event info
- New role cards appear based on the new event's `role_descriptions` and the new decision's `target_roles`

**Data flow for turn transitions:** When a new `decision_opened` WebSocket message arrives, the store adds the new decision to `openDecisions()`. The `activeDecisions()` computed signal picks it up, and the view re-derives the current event via `decision.event_id`. The event's `description` and `role_descriptions` are already present in the store's `events()` array (populated from the initial snapshot and `event_change` WS messages). Note: `EventChange` WS messages carry `role_descriptions` and `title` but not `description` — the `description` is available from the `EventSnapshot` loaded at snapshot time.

### Scope Boundaries

- **In scope:** Solo/2-player modes (`all_roles`, `all_advisors`, `solo_player`, practice mode)
- **Out of scope:** Multi-player mode (each player sees only their role — existing behavior unchanged)
- **Out of scope:** Game master view

## Components Affected

1. **`DecisionPanelComponent`** — convert from `ui-dialog-panel` (modal) to `ui-card` (inline). Already started.
2. **`player-view.html` + `player-view.ts`** — replace the two-column layout + modal with the flat card grid. New computed signals for building role cards from events + decisions.
3. **`AllAdvisorsPanelComponent`** — replaced by the new per-role card grid. Can be removed or repurposed.
4. **`TurnBannerComponent`** — either extend with `eventTitle` and `eventDescription` inputs, or replace with a new inline turn banner section in the template.
5. **`components-player-view.css`** — new CSS for role card grid, card states (active/done/intel), and turn banner.
6. **`components-decision.css`** — update decision panel styles for inline rendering.

## Data Flow

### RoleCard Interface

```typescript
interface RoleCard {
  roleId: string;
  roleLabel: string;
  playerType: 'decision_maker' | 'advisor';
  intel: string | null;              // from event.role_descriptions[roleId]
  decision: ActiveDecision | null;   // if role is in decision.target_roles
  status: 'intel' | 'active' | 'done';
  selectedOptionIds?: string[];      // populated after submission
  advisorRecs?: { roleId: string; roleLabel: string; selection: string | null }[];  // CO card only
}
```

### Building the Card Array

For each turn, the board merges two data sources:

1. **Current event** — derived via `activeDecision.event_id` → `EventSnapshot`. Provides `role_descriptions` (intel per role) and `description` (turn banner).
2. **Active decision** — provides `target_roles`, `options`, `question_type`.

The view builds a `RoleCard[]` by iterating the scenario's `roles` array and for each role:
- Looking up intel from `event.role_descriptions[roleId]`
- Looking up decision targeting from `decision.target_roles.includes(roleId)`
- Skipping roles with neither intel nor decision for the current turn
- For the decision maker role, populating `advisorRecs` from `decision.recommendations`
