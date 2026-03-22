# Spec: System Targeting + Warfare Domains

Two features for the TFC exercise board: (A) system picker UI for blue cards with `targets_system: true`, and (B) warfare domain threat-level board.

---

## Feature A: System Targeting (`targets_system`)

### Problem Statement

Blue cards like SWB10 "Isolate System", SWB14 "Reboot Affected System", and SWB16 "Reconnect System" can target different ship systems. The `targets_system: bool` field already flows end-to-end (scenario JSON → Python model → codegen → TypeScript), but:

- The UI shows no system picker — players cannot choose which system to target.
- The backend applies hardcoded `system_effects[].system_id` from the scenario, ignoring player intent.
- The game mechanics doc says: _"If a card can target multiple systems, it can only be played on one of them."_

### User Story

As a **CO (decision-maker)**, when I select a blue card marked `targets_system: true`, I want to **choose which system it targets** from the available systems, so that the correct system receives the card's effect.

### Design

#### Backend Changes

**1. New field on `CloseDecisionRequest`:**
```python
class CloseDecisionRequest(BaseModel):
    selected_option_ids: list[str] = Field(default_factory=list)
    target_system_selections: dict[str, str] = Field(default_factory=dict)
    # Maps option_id → system_id chosen by the player
```

**2. Engine: `close_decision` accepts target overrides:**
```python
async def close_decision(
    self,
    decision_id: str,
    selected_option_ids: list[str],
    target_system_selections: dict[str, str] | None = None,
) -> list[StateChange]:
```

**3. Apply overrides in `_apply_system_effects`:**
When processing a `DecisionOptionSnapshot` where `targets_system is True`:
- Look up `target_system_selections[option_id]` for the player's chosen system_id.
- Substitute `system_id` in each `SystemEffect` before applying.
- If the option has `targets_system: true` but no selection was provided, raise `BadRequestError`.
- Validate the chosen system_id exists in `SystemManager._systems`.

**4. Validation in `EngineDecisionService`:**
- For each selected option with `targets_system: true`, require a corresponding entry in `target_system_selections`.
- Validate the target system_id exists.

#### Frontend Changes

**1. Role card option rendering:**
When an option has `targets_system: true` and is selected, show a system dropdown below the option label. Populate with current systems from `store.systems()`.

**2. Submission payload:**
Extend `RoleCardSubmission` to include `targetSystemSelections: Record<string, string>`. Pass through `submitDecision` → `closeEngineDecision` → HTTP request body.

**3. Decision API service:**
Update `closeEngineDecision()` to accept and forward `target_system_selections`.

### Acceptance Criteria

- [ ] Given a decision with an option where `targets_system: true`, when the CO selects that option, then a system picker appears showing all current systems.
- [ ] Given the CO has selected a system-targeting option and picked a system, when they submit, the backend applies the effect to the chosen system (not the hardcoded one).
- [ ] Given the CO selects a system-targeting option but does NOT pick a system, the submit button is disabled.
- [ ] Given a non-targeting option (`targets_system: false`), no system picker appears (no change to existing behavior).
- [ ] Given a timeout auto-select of a `targets_system` option, the hardcoded system_id from `system_effects` is used as fallback (no player choice possible on timeout).

### Non-Goals

- Multi-system targeting per card (game rules say one system per card).
- Filtering systems to only "valid targets" (e.g., only damaged systems for repair cards). Defer to a future `valid_target_filter` field.
- Advisor recommendations for system targeting — advisors recommend the card, not the target.

---

## Feature B: Warfare Domains

### Problem Statement

The Silent Wake game board has a **Warfare Domains** section separate from Ship Systems. Domains track threat level (Green = No threat / Yellow = Possible / Red = Actual), which is semantically different from system operational states (Green = OK / Yellow = Degraded / Red = Critical).

Currently not modeled in the engine, store, or UI.

### User Story

As a **player**, I want to see the current threat level in each warfare domain on my board, so that I understand the tactical picture and can make informed decisions.

As a **scenario author**, I want to define warfare domains and attach domain effects to injects, so that the threat picture evolves over the exercise.

### Domain Model

From the game mechanics doc, warfare domains for Silent Wake:

| Domain | Abbr | Description |
|--------|------|-------------|
| Anti-Air Warfare | AAW | Air threats |
| Anti-Surface Warfare | ASUW | Surface threats |
| Anti-Submarine Warfare | ASW | Submarine threats |
| Electronic/Cyber Warfare | CYBER | Cyber/EW threats |

Each domain has:
- `domain_id: str` (e.g., `"aaw"`, `"asuw"`, `"asw"`, `"cyber"`)
- `label: str` (e.g., `"AAW"`, `"ASUW"`, `"ASW"`, `"CYBER"`)
- `threat_level: str` — `"green"` | `"yellow"` | `"red"`

No power state. No categories. Just a threat-level traffic light.

### Design

#### Backend Changes

**1. New engine module: `engine/warfare_domain_manager.py`**

Mirrors `SystemManager` but simpler:

```python
@dataclass
class WarfareDomainState:
    domain_id: str
    label: str = ""
    threat_level: str = "green"  # "green" | "yellow" | "red"

class WarfareDomainManager:
    def load_domains(self, domains: list[WarfareDomainState]) -> None
    def set_threat_level(self, domain_id: str, level: str) -> WarfareDomainChange | None
    def snapshot(self) -> list[WarfareDomainSnapshot]
```

**2. New TypedDicts in `state_changes.py`:**

```python
class WarfareDomainSnapshot(TypedDict):
    domain_id: str
    label: str
    threat_level: str  # "green" | "yellow" | "red"

class WarfareDomainChange(TypedDict):
    type: str  # "warfare_domain_change"
    domain_id: str
    threat_level: str

# Add to EngineSnapshot:
warfare_domains: list[WarfareDomainSnapshot]

# Add to StateChange union
```

**3. New scenario content models:**

```python
class WarfareDomainDef(BaseModel):
    domain_id: str
    label: str = ""
    initial_threat_level: str = "green"

class DomainEffect(BaseModel):
    domain_id: str
    threat_level: str  # "green" | "yellow" | "red"
```

Add to `ScenarioContent`:
```python
initial_warfare_domains: list[WarfareDomainDef] = []
```

Add to `ScenarioEventDef`:
```python
domain_effects: list[DomainEffect] = []  # threat level changes on event start
```

**4. Engine integration:**

- `ExerciseEngine.__init__` creates `WarfareDomainManager`, loads domains from config.
- `_apply_event_domain_effects()` called in tick loop alongside `_apply_event_system_effects()`.
- `snapshot()` includes `warfare_domains`.

**5. WebSocket broadcast:**
`WarfareDomainChange` is broadcast to all connections (not role-targeted), same as `SystemStateChange`.

#### Frontend Changes

**1. Codegen:** Run `npm run generate:types` after adding TypedDicts — auto-generates `WarfareDomainSnapshot`, `WarfareDomainChange`.

**2. Store:** Add `warfare_domains: WarfareDomainSnapshot[]` to `ExerciseState`. Handle `warfare_domain_change` in `ws-state-handler.ts`.

**3. New component: `WarfareDomainBoardComponent`**
- Input: `WarfareDomainSnapshot[]`
- Renders domain chips with threat-level traffic lights (same color tokens as systems, different semantics)
- Labels: show domain abbreviation + threat level text (No Threat / Possible / Actual)

**4. Player view:** Render `<tfc-warfare-domain-board>` alongside `<tfc-system-status-board>`.

**5. CSS:** Add styles to `components-systems.css` (or new `components-warfare.css` if cleaner).

#### Seed Data

Update `silent_wake.json`:
```json
"initial_warfare_domains": [
  {"domain_id": "aaw",   "label": "AAW",   "initial_threat_level": "green"},
  {"domain_id": "asuw",  "label": "ASUW",  "initial_threat_level": "green"},
  {"domain_id": "asw",   "label": "ASW",   "initial_threat_level": "green"},
  {"domain_id": "cyber", "label": "CYBER", "initial_threat_level": "green"}
]
```

Add `domain_effects` to relevant events:
- Turn 5 (Cyber Alert): `cyber → yellow`
- Turn 6 (Hostile warship): `asuw → yellow`
- Turn 8 (Air threat): `aaw → yellow`
- Turn 9 (Hostile salvo): `aaw → red`
- Turn 14 (Ship neutralised): `asuw → green`
- Turn 15 (All clear): `aaw → green`, `cyber → green`

### Acceptance Criteria

- [ ] Given a scenario with `initial_warfare_domains`, when the exercise starts, all domains display at their initial threat levels.
- [ ] Given an event with `domain_effects`, when the event starts (RUNNING), the warfare domain board updates in real time.
- [ ] Given the warfare domain board, threat levels display as Green (No Threat) / Yellow (Possible) / Red (Actual) with traffic-light indicators.
- [ ] Given a fresh WebSocket connection (reconnect), the engine snapshot includes current `warfare_domains` state.
- [ ] Given a scenario WITHOUT `initial_warfare_domains`, the warfare domain board does not render (graceful absence).
- [ ] Warfare domain states are completely independent of system operational states.

### Non-Goals

- Decision options affecting warfare domains (threat levels are GM/inject-driven only — per game rules, facilitator adjudicates threat picture).
- Cascading domain-to-system effects (e.g., AAW red doesn't auto-degrade AAW radar). These are separate concepts.
- Domain-specific terminology mapping (reuse existing domain_config infrastructure later if needed).

---

## Dependencies

- Feature A has no dependency on Feature B (independent).
- Feature B has no dependency on Feature A (independent).
- Both can be implemented in parallel.

## SPECS.md Updates Required

After implementation:
- Mark `targets_system` todo as complete in § systems feature.
- Move warfare domains from § Backlog (Shaped) to § Features with implementation status.
