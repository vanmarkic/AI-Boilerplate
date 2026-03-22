# Scenario Creation Flow — Design

## Goal

Design the user flow for creating a TFC scenario from scratch, optimized for Naval Group facilitators who understand Silent Wake game mechanics (turns, injects, blue cards, stress, systems).

## Key Insight

Facilitators create **new narratives on reusable foundations**. Roles, systems, warfare domains, and the blue card catalog are mostly stable across scenarios. What changes is the story — which injects happen when, which cards are available each turn, and what the consequences are.

## Architecture Decision

**DomainConfig becomes the reusable foundation.** A single DomainConfig (e.g., "Silent Wake") holds the shared catalogs. Scenarios reference it and only define the turn-by-turn narrative. This replaces the current approach where every entity is duplicated inside each scenario's `ScenarioContent` JSON.

---

## The Creation Flow

### Phase 1 — Pick Your Foundation (5 seconds)

Single screen. The DomainConfig (Silent Wake) is pre-selected since there is only one.

**What the facilitator sees:**
- Foundation name and description
- Summary stats: "7 roles · 6 systems · 5 weapons · 4 warfare domains · 22 blue cards"
- Expandable preview of each catalog (roles table, systems table, cards table, etc.)
- Inline add/edit for any catalog item (changes apply to the foundation globally, affecting all future scenarios)

**No "Create New Domain" flow.** Out of scope. Single foundation, editable in place.

**Actions:**
- "Continue" → Phase 2

---

### Phase 2 — Scenario Setup (5–10 minutes)

Single scrollable form for scenario-level metadata.

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Title | text | yes | |
| Description | textarea | no | Short summary for scenario list |
| Briefing | rich textarea | yes | Full context read to players before Turn 1 |
| Objectives | ordered list | yes | Add/remove/reorder |
| Rules | ordered list | no | Add/remove/reorder |
| Game Mode | toggle | yes | Classic / Simple Collaborative |
| Score Tier Thresholds | two number inputs | no | lo/mid boundaries (e.g., 0.33, 0.66) |

**Initial State Overrides:**

Below the metadata, the foundation's systems and warfare domains are shown with their default initial states. The author can override per-scenario:

- System initial power state (ON/OFF) and operational state (Green/Yellow/Red)
- Warfare domain initial threat level (Green/Red — binary, two states only)

Overrides apply to this scenario only. Foundation defaults remain unchanged.

**Actions:**
- "Continue to Turns" → Phase 3
- "Save Draft" → saves without turns

---

### Phase 3 — Turn-by-Turn Authoring (the core)

Where the facilitator spends 90% of their time.

**Layout:** Split panel. Left: turn timeline. Right: turn editor.

#### Left Panel — Turn Timeline

- Vertical list of turns: Turn 0, Turn 1, Turn 2, ...
- Each turn shows: index, title, colored pip for stress delta (+0 green, +1/+2 amber, -1 blue)
- "Add Turn" button at the bottom
- Drag to reorder (auto-renumbers `turn_index`)
- Duplicate and delete actions per turn
- Click a turn to edit it in the right panel

#### Right Panel — Turn Editor

A single turn has these sections, top to bottom:

**1. Turn Header**

| Field | Type | Notes |
|-------|------|-------|
| Turn index | read-only | Auto-numbered |
| Title | text | e.g., "Steady Approach", "Unexpected Current" |
| Facilitator prompt | textarea | What the facilitator reads aloud |
| Has decisions | toggle | Turn 0 defaults to false. Hides blue card section when off |
| Duration (ms) | number | Only shown when `has_decisions: false` (e.g., Turn 0 = 15 min) |

**2. Injects**

List of inject entries. Each inject:
- **Target role(s)** — pick from foundation's role catalog (single role, multiple, or "all")
- **Inject text** — the situation update for that role
- Not every role gets an inject every turn — only add what's needed

**3. Available Blue Cards** (hidden when `has_decisions: false`)

The foundation's card catalog shown as a checklist. Tick cards available this turn. For each selected card, an expandable configuration row:

| Field | Type | Notes |
|-------|------|-------|
| Score | number | Points for picking this card this turn (+/−/0) |
| Stress delta | int | Stress change if picked (+1, −1, 0) |
| System effects | list | system_id → new operational_state or power_state |
| Domain effects | list | domain_id → new threat level |
| Targets system | read-only | Inherited from catalog. If true, player picks target at play time |
| Max plays | int | Times this card can be played this turn (0 = unlimited) |

**Max selections per turn:** Number input, default 2 (how many cards CO can pick).

**4. Turn Consequences**

Effects that happen at turn start, independent of card choice:
- Base stress delta (applied regardless of card choice)
- System effects on turn start (e.g., "COMMS → Yellow" from the inject narrative)
- Domain effects on turn start (e.g., "CYBER → red")

**5. Facilitator Notes** (optional)

| Field | Type | Notes |
|-------|------|-------|
| Best path | Card IDs + notes | Which cards are optimal, expected outcome |
| Acceptable path | Card IDs + notes | Suboptimal but valid alternative |
| Design notes | free text | Why this turn exists, what it teaches |

#### Turn 0 — Special Case

Turn 0 (Pre-Sail Briefing) is auto-created with:
- `has_decisions: false`
- Blue card section hidden
- Duration field visible (default 15 min)
- Injects are briefing cards (background context per role), not situation updates

The facilitator can create non-decision turns at other indices by toggling `has_decisions: false`.

---

## Data Model Changes

### DomainConfig — New Fields

Add three new JSON fields to `tfc_domain_configs`:

```python
systems: list[SystemStateDef]        # Ship systems + weapons with default initial states
warfare_domains: list[WarfareDomainDef]  # Warfare domains with default initial threat levels
blue_card_catalog: list[BlueCardDef]     # Global card definitions
```

The existing `roles`, `terminology`, `theme`, `severity_levels` fields remain.

### New Model: BlueCardDef

A card in the global catalog, independent of any turn:

```python
class BlueCardDef(BaseModel):
    id: str                    # e.g., "SWB01"
    title: str                 # e.g., "Continue Mission"
    description: str = ""      # What this card does generically
    targets_system: bool = False  # Whether player picks target system at play time
```

### ScenarioContent Changes

- `roles` — removed (inherited from DomainConfig)
- `initial_system_states` — becomes optional overrides only (if absent, use DomainConfig defaults)
- `initial_warfare_domains` — becomes optional overrides only (if absent, use DomainConfig defaults)
- `decision_templates` and `events` — **generated** from the turn definitions at save/load time. The editor writes `turns[]` and derives the rest.
- `turns` array becomes the primary authored structure

### TurnDefinition — Expanded

```python
class TurnInjectDef(BaseModel):
    target_roles: list[str] = []   # Empty = all roles
    text: str                       # The inject content
    role_descriptions: dict[str, str] = {}  # Per-role text overrides

class TurnCardConfig(BaseModel):
    card_id: str               # References BlueCardDef.id in DomainConfig
    score: float = 0.0
    stress_delta: int = 0
    system_effects: list[SystemEffectDef] = []
    domain_effects: list[DomainEffectDef] = []
    max_plays: int = 0         # 0 = unlimited

class PathNoteDef(BaseModel):
    card_ids: list[str] = []
    notes: str = ""

class TurnDefinition(BaseModel):
    turn_index: int
    title: str = ""
    facilitator_prompt: str | None = None
    has_decisions: bool = True
    duration_ms: float | None = None          # Only for non-decision turns
    injects: list[TurnInjectDef] = []
    available_cards: list[TurnCardConfig] = []
    max_selections: int = 2
    base_stress_delta: int = 0
    system_effects_on_start: list[SystemEffectDef] = []
    domain_effects_on_start: list[DomainEffectDef] = []
    best_path: PathNoteDef | None = None
    acceptable_path: PathNoteDef | None = None
    design_notes: str = ""
```

### Scenario Loader Impact

`scenario_loader.py` must be updated to:
1. Merge DomainConfig foundations with scenario overrides
2. Generate `ScenarioEventDef` and `DecisionTemplateDef` from `TurnDefinition[]` for the engine
3. Build `EngineConfig` from the merged + generated data

The engine itself does not change — it still receives `EngineConfig` with events, decision templates, and system states. The transformation happens in the loader.

---

## Nice-to-Have (Deferred)

### Walkthrough Preview
Read-only full-width view stepping through one turn at a time. Shows facilitator prompt, role injects, available cards, best/acceptable paths, and cumulative board state. Not editable — click to jump back to turn editor. Deferred.

### JSON Export/Import with Schema Metadata
- **Export:** Downloads scenario as `.json` with a metadata header describing the schema — enables LLM-assisted scenario generation
- **Import:** File picker loads a `.json` file into the editor as a new unsaved scenario
- Schema header format TBD — should include field descriptions and valid value enums so an LLM can generate valid scenario JSON from a narrative prompt

---

## Out of Scope

- Multiple DomainConfigs / "Create New Domain" flow
- Node/graph-based visual editor
- Editing in walkthrough view
- Phases (exist in data model but not surfaced in this iteration)
- Multi-foundation scenarios (mixing catalogs from different domains)
