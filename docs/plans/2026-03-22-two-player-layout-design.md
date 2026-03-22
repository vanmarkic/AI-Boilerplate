# TFC Two-Player Layout Redesign

## Problem

In 2-player mode (CO + all_advisors), the crew player's 3 role cards use a flex-wrap layout where cards resize based on content. Events/injects and decisions/bluecards change size depending on state, causing layout shift and making it hard to scan across roles predictably.

## Design Decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Target screen | Laptop-first (1280+), scales to larger monitors |
| 2 | Column layout | Equal thirds by default, inline expand on demand |
| 3 | Vertical zones | Fixed: intel ~40%, decision ~60% of column height |
| 4 | Focus mode | Inline expand: clicked column → 2fr, others → 0.5fr |
| 5 | Turn banner | Minimal 1-line strip, bigger font. No description paragraph |
| 6 | CO view | 3-column mirror of crew + bottom decision bar |
| 7 | CO rec display | Full mirror — CO sees exactly what each crew role sees |
| 8 | CO decision bar | Hybrid — all options shown, recommended ones get advisor badges |
| 9 | Systems/warfare boards | Shared strips above columns (not role-specific) |
| 10 | Stress bar | Stays in header |

## Crew Player Screen (all_advisors)

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Title ──── [████ Stress Bar ████] ──── RT / Turn   │
├─────────────────────────────────────────────────────────────┤
│ TURN 3 — Phishing Attack Detected                          │  ← 1-line, big font
├─────────────────────────────────────────────────────────────┤
│ Systems: [NAV ●] [COMMS ●] [RADAR ●]   Warfare: [ASW ●]…  │  ← shared strips
├───────────────────┬───────────────────┬─────────────────────┤
│    OPS            │    NAV            │    PWO              │
│  ┌─────────────┐  │  ┌─────────────┐  │  ┌─────────────┐   │
│  │ INTEL ZONE  │  │  │ INTEL ZONE  │  │  │ INTEL ZONE  │   │  ← fixed ~40%
│  │ (scrolls    │  │  │             │  │  │             │   │
│  │  internally)│  │  │             │  │  │             │   │
│  ├─────────────┤  │  ├─────────────┤  │  ├─────────────┤   │
│  │ DECISION    │  │  │ DECISION    │  │  │ DECISION    │   │  ← fixed ~60%
│  │ ZONE        │  │  │ ZONE        │  │  │ ZONE        │   │
│  │ (options +  │  │  │ (waiting…)  │  │  │ (options +  │   │
│  │  submit)    │  │  │             │  │  │  submit)    │   │
│  └─────────────┘  │  └─────────────┘  │  └─────────────┘   │
├───────────────────┴───────────────────┴─────────────────────┤
│ FOOTER: You are the All Advisors player          [Logs]     │
└─────────────────────────────────────────────────────────────┘
```

### Key rules

- 3 columns always equal width: `grid-template-columns: 1fr 1fr 1fr`
- Column height locked to remaining viewport after header/strips/footer
- Intel zone = fixed 40% of column height, scrolls internally on overflow
- Decision zone = fixed 60% of column height, shows empty state when no active decision
- No layout shift — zones never resize regardless of content state

### Focus mode (expand on demand)

- Click column header → expands to `2fr`, others shrink to `0.5fr`
- Shrunk columns show: role header + badge + first line of intel (truncated)
- Click again or Esc to reset to equal thirds
- CSS transition: `grid-template-columns 200ms ease`

## CO (Decision Maker) Screen

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Title ──── [████ Stress Bar ████] ──── RT / Turn   │
├─────────────────────────────────────────────────────────────┤
│ TURN 3 — Phishing Attack Detected                          │
├─────────────────────────────────────────────────────────────┤
│ Systems: [NAV ●] [COMMS ●] [RADAR ●]   Warfare: [ASW ●]…  │
├───────────────────┬───────────────────┬─────────────────────┤
│    OPS (mirror)   │    NAV (mirror)   │    PWO (mirror)     │
│  ┌─────────────┐  │  ┌─────────────┐  │  ┌─────────────┐   │
│  │ INTEL       │  │  │ INTEL       │  │  │ INTEL       │   │
│  ├─────────────┤  │  ├─────────────┤  │  ├─────────────┤   │
│  │ DECISION    │  │  │ DECISION    │  │  │ DECISION    │   │
│  │ OPTIONS     │  │  │ OPTIONS     │  │  │ OPTIONS     │   │
│  │ ☑ picked ←  │  │  │ pending…    │  │  │ ☑ picked ←  │   │
│  └─────────────┘  │  └─────────────┘  │  └─────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ CO DECISION BAR                                             │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│ │ Option A │ │ Option B │ │ Option C │ │ Option D │        │
│ │          │ │ ★OPS,PWO │ │          │ │          │[CONFIRM]│
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Key rules

- Top 3 columns = full mirror of crew roles (intel + decision options), read-only
- When advisor submits: their pick highlighted (green border + checkmark)
- "pending..." for advisors who haven't submitted yet
- CO Decision Bar = full-width bottom strip with all decision options
- Recommended options get badges: "★ OPS, PWO"
- CO picks option(s) then clicks Confirm
- No active decision: bar shows "Waiting for next decision..." (muted)
- CO's own intel (from `role_descriptions[co_role_id]`) shown as callout above decision bar

## Interaction States

### Card states (both screens)

| State | Intel Zone | Decision Zone |
|-------|-----------|---------------|
| No event, no decision | "Waiting for next turn..." (muted) | "No active decision" (muted) |
| Event only (intel) | Role-specific description | "No active decision" (muted) |
| Event + active decision | Role-specific description | Options + submit button |
| Decision submitted (done) | Role-specific description | "Selected: [option]" + muted opacity |

Both zones maintain fixed height in ALL states. Empty/waiting states use centered muted text.

### Focus mode columns (crew screen)

| Element | Expanded column (2fr) | Shrunk columns (0.5fr) |
|---------|----------------------|----------------------|
| Role header | Full: ID + label + badge | Compact: ID + badge only |
| Intel zone | Full text, scrollable | Single line, truncated + ellipsis |
| Decision zone | Full options + submit | Status badge only: "DECISION" or "DONE ✓" |

### CO mirror columns

- Read-only — no radio buttons, no submit button
- Options listed as plain text, not interactive
- Advisor pick: `role-card__option--selected` styling + checkmark
- Unpicked options muted
- "pending..." in decision zone header until advisor submits

## Responsive Scaling

| Breakpoint | Behavior |
|-----------|----------|
| 1280–1440px (laptop) | 3 equal columns, comfortable spacing |
| 1920px+ (monitor) | Columns capped ~500px each, centered with margin auto |
| 1024–1280px (narrow) | Columns compress, font sizes step down one tier, chips may wrap |
| <1024px (fallback) | Tabbed view — one role at a time + tab strip |

## CSS Architecture

```css
/* Crew screen: 3 equal columns */
.board-columns {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--spacing-md);
  flex: 1;
  min-height: 0;
}

/* Focus mode via data attribute */
.board-columns[data-focus="0"] { grid-template-columns: 2fr 0.5fr 0.5fr; }
.board-columns[data-focus="1"] { grid-template-columns: 0.5fr 2fr 0.5fr; }
.board-columns[data-focus="2"] { grid-template-columns: 0.5fr 0.5fr 2fr; }

/* Each column: fixed vertical zones */
.board-column {
  display: grid;
  grid-template-rows: auto 2fr 3fr; /* header | intel ~40% | decision ~60% */
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 2px;
  background: var(--color-card);
  transition: grid-template-columns 200ms ease;
}

/* Fixed zones scroll internally */
.board-column__intel,
.board-column__decision {
  overflow-y: auto;
  padding: var(--spacing-md);
}

/* CO decision bar */
.co-decision-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-top: 2px solid var(--color-success);
  background: color-mix(in oklch, var(--color-success) 5%, var(--color-card));
}

.co-decision-bar__option {
  flex: 1 1 0;
}

.co-decision-bar__option[data-recommended] {
  border-color: var(--color-primary);
  box-shadow: var(--glow-sm);
}
```

## Component Changes

| Component | Change |
|-----------|--------|
| `player-view.ts` | Detect `isDecisionMaker` vs `isAllAdvisors`, render different layouts |
| `board-column.component.ts` (new) | Wraps role content in fixed-zone column, handles focus click |
| `co-decision-bar.component.ts` (new) | Horizontal option picker with recommendation badges |
| `role-card.component.ts` | Add `readonly` input for CO mirror mode (hide submit, show advisor pick) |
| CSS | New `.board-columns` grid replaces `.board-grid` flexbox |

## Game Mechanics Compliance

Verified against backend implementation:

- CO can pick ANY option — not restricted to recommended ones ✓
- Recommendations are purely informational (separate API flow) ✓
- `max_selections` is the only constraint on CO picks ✓
- `completion_mode` field exists but is not currently enforced ✓
- The hybrid decision bar (all options + recommendation badges) preserves full CO autonomy ✓

## Research Backing

Design informed by:

- **Artemis/EmptyEpsilon bridge simulator pattern**: each role = dedicated station screen, captain synthesizes
- **Endsley's 3-level SA model**: perception (status chips), comprehension (role intel), projection (decision options)
- **Gestalt proximity principle**: spatial consistency between CO and crew screens for role positions
- **Fixed-size card best practices**: 4/8px grid, fixed height zones with internal scroll, consistent margins
- **Progressive disclosure**: equal columns by default, expand on demand for detail
- **Nielsen's heuristics**: visibility of system status (badges), consistency (mirrored layouts), user control (focus mode)
