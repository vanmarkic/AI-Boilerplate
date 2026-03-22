# Scenario Creation UI — Refined Spec (Tasks 11–14)

## Architecture

Two separate pages, both accessible from main navigation:

| Route | Page | Purpose |
|-------|------|---------|
| `/foundation` | Foundation Editor | Full CRUD for DomainConfig catalogs (roles, systems, warfare domains, blue cards) |
| `/builder` | Scenario Builder | Two-tab scenario authoring: Setup + Turns |

**Navigation entry points:**
- Home page 2x2 grid: add "Foundation" panel (indicator: `FND`, label: "Foundation", desc: "Manage roles, systems, and blue cards")
- Home page: small footer link alongside existing GM link
- `/builder` Setup tab: read-only foundation summary with "Edit Foundation" link → `/foundation`
- `/builder` Turns tab: card picker has "Card not in catalog?" link → `/foundation`

---

## Task 11: Foundation Editor Page (`/foundation`)

### Route

```typescript
{ path: "foundation", loadChildren: () => import("./features/foundation/foundation.routes").then(m => m.FOUNDATION_ROUTES) }
```

### Component: `FoundationEditorView`

Single scrollable page with four editable catalog sections. Each section follows the same pattern: section header with count + "Add" button, list of items as expandable cards, inline edit form when expanded.

**Section 1 — Roles**

| Field | Type | Notes |
|-------|------|-------|
| id | text (read-only after create) | e.g., "co", "ops" |
| label | text | e.g., "Commanding Officer (CO)" |
| description | textarea | Role responsibilities |

**Section 2 — Systems**

| Field | Type | Notes |
|-------|------|-------|
| id | text (read-only after create) | e.g., "nav_radar" |
| label | text | e.g., "NAV RADAR" |
| category | select: "system" / "weapon" | |
| description | textarea | Optional |

**Section 3 — Warfare Domains**

| Field | Type | Notes |
|-------|------|-------|
| id | text (read-only after create) | e.g., "aaw" |
| label | text | e.g., "AAW" |
| description | textarea | Optional |

**Section 4 — Blue Card Catalog**

| Field | Type | Notes |
|-------|------|-------|
| id | text (read-only after create) | e.g., "SWB01" |
| title | text | e.g., "Continue Mission" |
| description | textarea | What this card does generically |
| targets_system | checkbox | Whether player picks target system at play time |

### Data flow

- On load: `GET /api/domain-configs/by-slug/silent-wake` → populate all sections
- On save (per section or global save): `PUT /api/domain-configs/{id}` with updated catalog arrays
- No scenario data involved — this page only touches DomainConfig

### Sidebar navigation

Sticky sidebar with section links (same pattern as current builder): Roles · Systems · Warfare Domains · Blue Cards

### Back navigation

"← Back to Home" link at top, or browser back.

---

## Task 12: Scenario Builder — Setup Tab

### What changes in the current builder

The current builder view (`/builder`) has a single "global" view with sections: Roles → Events → Issues → Decisions → Turns → Settings.

**Replace with two tabs:** Setup | Turns

The tab bar replaces the current Global/Walkthrough toggle. The "Existing Scenarios" sidebar panel and save/clone/delete actions remain unchanged.

### Setup tab content

Single scrollable page with these sections:

**Section 1 — Foundation Summary (read-only)**

Compact display showing what the DomainConfig contains:
- "7 roles · 11 systems · 4 warfare domains · 23 blue cards"
- Expandable to preview each catalog (read-only tables)
- "Edit Foundation →" link navigates to `/foundation`

**Section 2 — Scenario Metadata**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | text input | yes | Already exists in action bar — keep there |
| Description | textarea | no | Already exists — keep in action bar collapsible |
| Briefing | rich textarea | yes | Full context for players. Currently in Settings — move here |
| Objectives | ordered list | yes | Add/remove/reorder |
| Rules | ordered list | no | Add/remove/reorder |
| Game Mode | toggle | yes | Classic / Simple Collaborative |
| Score Tier Thresholds | two number inputs | no | lo/mid boundaries |
| Default Time Factor | number input | no | Currently in Settings — move here |

**Section 3 — Initial State Overrides**

Two grids showing the foundation's systems and warfare domains with overridable initial states:

**Systems grid:**

| System | Category | Operational State | Power |
|--------|----------|------------------|-------|
| NAV RADAR | system | [Green ▼] | [ON ▼] |
| COMMS | system | [Green ▼] | [ON ▼] |
| CIWS FWD | weapon | [Green ▼] | [OFF ▼] |
| ... | ... | ... | ... |

- Dropdown for operational state: Green / Yellow / Red
- Dropdown for power: ON / OFF
- Default values from DomainConfig (all Green, all OFF)
- Overrides saved in `ScenarioContent.initial_system_states`

**Warfare Domains grid:**

| Domain | Threat Level |
|--------|-------------|
| AAW | [Green ▼] |
| ASUW | [Green ▼] |
| ... | ... |

- Dropdown for threat level: Green / Red (binary)
- Overrides saved in `ScenarioContent.initial_warfare_domains`

### What gets removed from current builder

The following editors are **removed** from the global view (they're replaced by turn-based authoring):
- `scenario-event-editor` — events are now generated from turns
- `scenario-issue-editor` — issues are now generated from turns
- `scenario-decision-editor` — decisions are now generated from turns
- `scenario-turns-placeholder` — replaced by the full Turns tab
- `scenario-roles-editor` — roles live in DomainConfig now (Foundation page)

The `scenario-settings-editor` is **absorbed** into Section 2 (briefing + time factor move to metadata).

### Sidebar navigation update

Sidebar sections for Setup tab: Foundation · Metadata · Initial States

---

## Task 13: Scenario Builder — Turns Tab

The core creative workspace. Full-height split panel.

### Layout

```
┌─────────────────┬───────────────────────────────────────────┐
│  Turn Timeline   │  Turn Editor                              │
│  (left, narrow)  │  (right, wide)                            │
│                  │                                           │
│  [Turn 0] BRF    │  ┌─ Turn Header ───────────────────────┐ │
│  [Turn 1] +0     │  │ Title: Steady Approach               │ │
│  [Turn 2] +0  ←  │  │ Facilitator: Transit phase begun...  │ │
│  [Turn 3] +1     │  └─────────────────────────────────────┘ │
│  [Turn 4] +1     │                                           │
│  ...             │  ┌─ Injects ───────────────────────────┐ │
│                  │  │ [OPS] Transit on schedule...          │ │
│                  │  │ [NAV] Course steady at 15 kts...      │ │
│                  │  │ + Add Inject                          │ │
│                  │  └─────────────────────────────────────┘ │
│                  │                                           │
│                  │  ┌─ Blue Cards ─────────────────────────┐ │
│                  │  │ ☑ SWB01 Continue Mission    Score: 5  │ │
│                  │  │ ☑ SWB07 Start Investigation Score: 3  │ │
│                  │  │ ☐ SWB03 Internal Sync                 │ │
│                  │  │ ...                                    │ │
│  ┌───────────┐  │  │ Max selections: [2]                    │ │
│  │ + Add Turn│  │  │ "Not in catalog?" → /foundation        │ │
│  └───────────┘  │  └─────────────────────────────────────┘ │
│                  │                                           │
│                  │  ┌─ Turn Consequences ──────────────────┐ │
│                  │  │ Base stress: [+0]                      │ │
│                  │  │ System effects: COMMS → Yellow         │ │
│                  │  │ Domain effects: CYBER → Red            │ │
│                  │  └─────────────────────────────────────┘ │
│                  │                                           │
│                  │  ┌─ Facilitator Notes ──────────────────┐ │
│                  │  │ Best: SWB01 + SWB07 — Keep tempo      │ │
│                  │  │ Acceptable: SWB07 + SWB07 — Double... │ │
│                  │  │ Notes: Teaches investigation + ...     │ │
│                  │  └─────────────────────────────────────┘ │
└─────────────────┴───────────────────────────────────────────┘
```

### Left Panel — Turn Timeline

- Vertical list of turns
- Each turn shows: index badge, title (truncated), stress delta pip (color-coded: +0 green, +N amber, -N blue)
- Selected turn highlighted
- Click to select → loads in right panel
- "Add Turn" button at bottom
- Context menu or action buttons per turn: Duplicate, Delete
- Drag handle for reorder (updates `turn_index` automatically)
- Turn 0 auto-created when scenario has no turns, pre-filled with `has_decisions: false`

### Right Panel — Turn Editor

**Section 1: Turn Header**

| Field | Type | Notes |
|-------|------|-------|
| Turn index | badge (read-only) | Auto-numbered |
| Title | text input | e.g., "Steady Approach" |
| Facilitator prompt | textarea | What facilitator reads aloud |
| Has decisions | toggle | Hides blue card section when off. Turn 0 defaults off |
| Duration | number input (ms) | Only visible when has_decisions = false |

**Section 2: Injects**

List of inject entries. Each inject:
- Role picker: multi-select from DomainConfig roles (or "All")
- Inject text: textarea
- Per-role text overrides: expandable section with role_descriptions dict
- Delete button per inject
- "Add Inject" button at bottom

**Section 3: Blue Cards** (hidden when `has_decisions: false`)

Checklist of cards from DomainConfig's `blue_card_catalog`:
- Full catalog shown with checkboxes
- Checked = available this turn
- For each checked card, expandable config row:

| Field | Type | Notes |
|-------|------|-------|
| Score | number | Points for this card this turn |
| Stress delta | number | Stress change if picked |
| System effects | add/remove list | system_id → operational_state / power_state |
| Domain effects | add/remove list | domain_id → threat_level |
| Max plays | number | 0 = unlimited |
| Targets system | read-only badge | From catalog. If true, shows "Player picks target" |

- "Max selections" input: how many cards CO can pick (default 2)
- "Card not in catalog? Edit Foundation →" link to `/foundation`

**Section 4: Turn Consequences**

Effects that happen at turn start, independent of card choice:
- Base stress delta: number input
- System effects on start: add/remove list (same pattern as card effects)
- Domain effects on start: add/remove list

**Section 5: Facilitator Notes** (collapsible)

| Field | Type |
|-------|------|
| Best path cards | multi-select from this turn's available cards |
| Best path notes | textarea |
| Acceptable path cards | multi-select |
| Acceptable path notes | textarea |
| Design notes | textarea (why this turn exists, what it teaches) |

### Data flow

- Card catalog loaded from DomainConfig API on tab activation (or cached from Setup tab)
- Roles loaded from DomainConfig API for inject role picker
- Systems/domains loaded from DomainConfig API for effect dropdowns
- All turn edits go through the store's turn CRUD methods (Task 10, already implemented)
- Save persists the full `ScenarioContent` with populated `turns[]` array

---

## Task 14: Wiring — Routes, Navigation, Cleanup

### New route

Add to `app.routes.ts`:
```typescript
{ path: "foundation", loadChildren: () => import("./features/foundation/foundation.routes").then(m => m.FOUNDATION_ROUTES) }
```

### Home page changes

Add "Foundation" to the 2x2 grid (becomes 2x3 or rearranged):
```html
<a class="tac-panel" routerLink="/foundation">
  <span class="tac-panel__indicator">FND</span>
  <span class="tac-panel__label">Foundation</span>
  <span class="tac-panel__desc">Manage roles, systems, and blue cards</span>
</a>
```

Add footer links (small text below the grid):
```html
<footer class="home-footer">
  <a routerLink="/foundation">Foundation</a>
  <a routerLink="/gm">Game Master</a>
</footer>
```

### Builder view changes

- Replace `viewMode` signal from `"global" | "walkthrough"` to `"setup" | "turns"`
- Replace the Global/Walkthrough toggle with Setup/Turns tab bar
- Setup tab renders the new setup sections (Task 12)
- Turns tab renders the turn editor (Task 13)
- Remove imports for deleted editors (event, issue, decision, roles, turns placeholder)
- Keep: sidebar nav (updated sections), action bar (save/clone/delete), error display

### Sidebar updates

- Setup tab sidebar: Foundation · Metadata · Initial States
- Turns tab sidebar: the turn timeline IS the left panel (no separate sidebar needed — the split panel layout replaces the sidebar layout for the Turns tab)

---

## Out of Scope

- Walkthrough preview (NTH, deferred)
- JSON export/import with LLM schema metadata (NTH, deferred)
- Multiple DomainConfigs
- Drag-and-drop for turn injects reordering
- Card prerequisite validation (e.g., SWB08 requires SWB07 played previously)
- Filtering systems to valid targets for targeting cards
