# Scenario Creation Flow — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand DomainConfig to hold reusable foundations (systems, warfare domains, blue card catalog), expand TurnDefinition to be the primary authoring structure, and update the scenario loader to generate engine-compatible events/decisions from turns.

**Architecture:** DomainConfig becomes the reusable foundation (roles, systems, warfare domains, card catalog). ScenarioContent's `turns[]` array becomes the primary authored structure — per-turn injects, available cards with scoring/effects, and facilitator notes. The scenario loader merges DomainConfig foundations with scenario overrides and generates `ScheduledEvent` + `DecisionTemplate` from turn definitions for the engine. The engine itself does not change.

**Tech Stack:** Python 3.12 · FastAPI · SQLAlchemy (async) · Pydantic v2 · Alembic · PostgreSQL · pytest · Angular 21 · ngrx signals

**Design Doc:** `docs/plans/2026-03-22-scenario-creation-flow-design.md`

**Key Files:**
- Backend DomainConfig: `apps/tfc/backend/features/domain_config/domain_config_model.py`, `domain_config_schema.py`, `domain_config_service.py`
- Backend Scenario: `apps/tfc/backend/features/scenario/scenario_content.py`, `scenario_loader.py`, `scenario_schema.py`
- Backend Migration: `apps/tfc/backend/alembic/versions/`
- Backend Seed: `apps/tfc/backend/seed.py`, `apps/tfc/backend/seeds/`
- Frontend API: `apps/tfc/frontend/src/app/core/domain-config-api.service.ts`, `scenario-api.service.ts`
- Frontend Builder: `apps/tfc/frontend/src/app/features/scenario-builder/`

**Testing rules (from AGENTS.md):**
- API changes → router tests in `*_test.py`
- Engine changes → unit + property tests (Hypothesis)
- Frontend → colocated `.spec.ts` files
- Cross-path regression tests are highest value

---

## Task 1: Add `BlueCardDef` and new turn authoring models to `scenario_content.py`

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_content.py`
- Test: `apps/tfc/backend/features/scenario/scenario_content_test.py` (create if needed)

**Step 1: Write the failing test**

```python
# apps/tfc/backend/features/scenario/scenario_content_test.py
import pytest
from features.scenario.scenario_content import (
    BlueCardDef,
    TurnInjectDef,
    TurnCardConfig,
    PathNoteDef,
    TurnDefinition,
)


def test_blue_card_def_minimal():
    card = BlueCardDef(id="SWB01", title="Continue Mission")
    assert card.id == "SWB01"
    assert card.targets_system is False
    assert card.description == ""


def test_turn_inject_def():
    inject = TurnInjectDef(text="All systems nominal.")
    assert inject.target_roles == []
    assert inject.role_descriptions == {}


def test_turn_card_config():
    cfg = TurnCardConfig(card_id="SWB01", score=5.0, stress_delta=1)
    assert cfg.system_effects == []
    assert cfg.domain_effects == []
    assert cfg.max_plays == 0


def test_path_note_def():
    path = PathNoteDef(card_ids=["SWB01", "SWB03"], notes="Best combo")
    assert len(path.card_ids) == 2


def test_turn_definition_expanded():
    turn = TurnDefinition(
        turn_index=1,
        title="Steady Approach",
        facilitator_prompt="Transit phase has begun.",
        injects=[TurnInjectDef(target_roles=["ops"], text="Transit on schedule.")],
        available_cards=[TurnCardConfig(card_id="SWB01", score=5.0)],
        max_selections=2,
        best_path=PathNoteDef(card_ids=["SWB01", "SWB03"], notes="Keep tempo"),
    )
    assert turn.max_selections == 2
    assert len(turn.injects) == 1
    assert len(turn.available_cards) == 1
    assert turn.best_path is not None
    assert turn.system_effects_on_start == []
    assert turn.domain_effects_on_start == []
    assert turn.design_notes == ""
```

**Step 2: Run test to verify it fails**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/scenario_content_test.py -v`
Expected: FAIL — `ImportError: cannot import name 'BlueCardDef'`

**Step 3: Write minimal implementation**

Add to `apps/tfc/backend/features/scenario/scenario_content.py` (after `RoleDef`, before `ScenarioContent`):

```python
class BlueCardDef(BaseModel):
    """A card in the global catalog, independent of any turn."""

    id: str
    title: str
    description: str = ""
    targets_system: bool = False


class TurnInjectDef(BaseModel):
    """Per-role inject text within a turn."""

    target_roles: list[str] = []
    text: str
    role_descriptions: dict[str, str] = {}


class TurnCardConfig(BaseModel):
    """Per-turn configuration for an available blue card."""

    card_id: str
    score: float = 0.0
    stress_delta: int = 0
    system_effects: list[SystemEffectDef] = []
    domain_effects: list[DomainEffectDef] = []
    max_plays: int = Field(default=0, ge=0)


class PathNoteDef(BaseModel):
    """Facilitator notes for best/acceptable play paths."""

    card_ids: list[str] = []
    notes: str = ""
```

Update the existing `TurnDefinition` class to add the new fields:

```python
class TurnDefinition(BaseModel):
    """Groups injects and a decision template into a turn."""

    turn_index: int
    title: str = ""
    facilitator_prompt: str | None = None
    has_decisions: bool = True
    duration_ms: float | None = None
    # Legacy fields (kept for backward compat with existing seeds)
    inject_ids: list[str] = []
    decision_template_id: str | None = None
    # New turn-authoring fields
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

**Step 4: Run test to verify it passes**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/scenario_content_test.py -v`
Expected: PASS

**Step 5: Verify existing seed validation still passes**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/seed_validation_test.py -v`
Expected: PASS — existing seeds use legacy fields (`inject_ids`, `decision_template_id`), new fields have defaults

**Step 6: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_content.py apps/tfc/backend/features/scenario/scenario_content_test.py
git commit -m "feat(tfc): add BlueCardDef and expanded TurnDefinition models for turn-based authoring"
```

---

## Task 2: Expand DomainConfig with `systems`, `warfare_domains`, and `blue_card_catalog`

**Files:**
- Modify: `apps/tfc/backend/features/domain_config/domain_config_model.py`
- Modify: `apps/tfc/backend/features/domain_config/domain_config_schema.py`
- Modify: `apps/tfc/backend/features/domain_config/domain_config_service.py`
- Create: `apps/tfc/backend/alembic/versions/NNN_add_domain_config_catalogs.py`
- Test: `apps/tfc/backend/features/domain_config/domain_config_test.py` (existing)

**Step 1: Write the failing test**

Add to `apps/tfc/backend/features/domain_config/domain_config_test.py`:

```python
async def test_create_domain_config_with_catalogs(client, setup_db):
    """DomainConfig with systems, warfare_domains, and blue_card_catalog."""
    payload = {
        **VALID_PAYLOAD,
        "systems": [
            {"id": "nav-radar", "label": "NAV RADAR", "category": "system"},
            {"id": "ciws-fwd", "label": "CIWS FWD", "category": "weapon"},
        ],
        "warfare_domains": [
            {"id": "aaw", "label": "AAW"},
            {"id": "asuw", "label": "ASUW"},
        ],
        "blue_card_catalog": [
            {"id": "SWB01", "title": "Continue Mission"},
            {"id": "SWB07", "title": "Start Investigation", "targets_system": False},
        ],
    }
    resp = await client.post("/api/domain-configs", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["systems"]) == 2
    assert len(data["warfare_domains"]) == 2
    assert len(data["blue_card_catalog"]) == 2
    assert data["warfare_domains"][0]["id"] == "aaw"
    assert data["blue_card_catalog"][0]["title"] == "Continue Mission"


async def test_update_domain_config_catalogs(client, setup_db):
    """Update warfare_domains and blue_card_catalog."""
    # Create first
    resp = await client.post("/api/domain-configs", json=VALID_PAYLOAD)
    config_id = resp.json()["id"]

    # Update with new catalogs
    update = {
        "warfare_domains": [{"id": "cyber", "label": "CYBER"}],
        "blue_card_catalog": [
            {"id": "SWB01", "title": "Continue Mission", "targets_system": False},
        ],
    }
    resp = await client.put(f"/api/domain-configs/{config_id}", json=update)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["warfare_domains"]) == 1
    assert len(data["blue_card_catalog"]) == 1
```

**Step 2: Run test to verify it fails**

Run: `cd apps/tfc/backend && python -m pytest features/domain_config/domain_config_test.py::test_create_domain_config_with_catalogs -v`
Expected: FAIL — `warfare_domains` and `blue_card_catalog` not in schema/model

**Step 3: Add schema payloads**

In `apps/tfc/backend/features/domain_config/domain_config_schema.py`, add:

```python
class WarfareDomainPayload(BaseModel):
    id: str
    label: str
    description: str = ""


class BlueCardPayload(BaseModel):
    id: str
    title: str
    description: str = ""
    targets_system: bool = False
```

Add to `CreateDomainConfigRequest`:
```python
    warfare_domains: list[WarfareDomainPayload] = []
    blue_card_catalog: list[BlueCardPayload] = []
```

Add to `UpdateDomainConfigRequest`:
```python
    warfare_domains: list[WarfareDomainPayload] | None = None
    blue_card_catalog: list[BlueCardPayload] | None = None
```

Add to `DomainConfigResponse`:
```python
    warfare_domains: list[WarfareDomainPayload] = []  # noqa: RUF012
    blue_card_catalog: list[BlueCardPayload] = []  # noqa: RUF012
```

**Step 4: Add model columns**

In `apps/tfc/backend/features/domain_config/domain_config_model.py`, add after `severity_levels`:

```python
    systems: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    warfare_domains: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
    blue_card_catalog: Mapped[list] = mapped_column(JSON, nullable=False, server_default="[]")
```

**Step 5: Update service create/update**

In `domain_config_service.py`, update `create()` entity construction to include:
```python
    systems=[s.model_dump() for s in request.systems],
    warfare_domains=[w.model_dump() for w in request.warfare_domains],
    blue_card_catalog=[c.model_dump() for c in request.blue_card_catalog],
```

In `update()`, add handling for the new list fields alongside `roles`/`severity_levels`:
```python
    elif field in ("systems", "warfare_domains", "blue_card_catalog"):
        setattr(entity, field, value)
```

**Step 6: Create Alembic migration**

Run: `cd apps/tfc/backend && alembic revision --autogenerate -m "add_domain_config_catalogs"`

Verify the generated migration adds `systems`, `warfare_domains`, `blue_card_catalog` columns with `server_default="[]"`.

**Step 7: Run migration**

Run: `cd apps/tfc/backend && alembic upgrade head`

**Step 8: Run tests**

Run: `cd apps/tfc/backend && python -m pytest features/domain_config/domain_config_test.py -v`
Expected: ALL PASS

**Step 9: Commit**

```bash
git add apps/tfc/backend/features/domain_config/ apps/tfc/backend/alembic/
git commit -m "feat(tfc): expand DomainConfig with systems, warfare_domains, blue_card_catalog"
```

---

## Task 3: Update DomainConfig seed data with Silent Wake catalogs

**Files:**
- Modify: `apps/tfc/backend/seed.py` (or domain config seed file if separate)
- Check: `apps/tfc/backend/seeds/` for existing seed JSON files

**Step 1: Identify where DomainConfig is seeded**

Read the seed script and any existing domain config seed data. The DomainConfig seed must be updated to include the full Silent Wake catalogs:
- 6 systems + 5 weapons (from game mechanics doc § Ship Systems)
- 4 warfare domains (AAW, ASUW, ASW, CYBER)
- 22 blue cards (from baseline scenario § Cards Used)

**Step 2: Write seed test**

```python
# In an appropriate test file
def test_silent_wake_domain_config_has_catalogs():
    """Verify the Silent Wake domain config seed includes all catalogs."""
    # Load the seed data
    # Assert systems count >= 11 (6 systems + 5 weapons)
    # Assert warfare_domains count == 4
    # Assert blue_card_catalog count >= 20
    # Assert each card has id, title, targets_system
```

**Step 3: Update seed data**

Add to the Silent Wake DomainConfig seed:

```python
"systems": [
    {"id": "nav-radar", "label": "NAV RADAR", "category": "system"},
    {"id": "ibms-ins", "label": "IBMS / INS (incl. WECDIS)", "category": "system"},
    {"id": "nav-sensors", "label": "NAV SENSORS", "category": "system"},
    {"id": "asuw-tracking-radar", "label": "ASUW TRACKING RADAR", "category": "system"},
    {"id": "comms", "label": "COMMS", "category": "system"},
    {"id": "aaw-radar", "label": "AAW RADAR", "category": "system"},
    {"id": "ciws-fwd", "label": "CIWS FWD", "category": "weapon"},
    {"id": "ciws-aft", "label": "CIWS AFT", "category": "weapon"},
    {"id": "missile-launcher", "label": "Missile Launcher", "category": "weapon"},
    {"id": "gun", "label": "Gun", "category": "weapon"},
    {"id": "decoys", "label": "Decoys", "category": "weapon"},
],
"warfare_domains": [
    {"id": "aaw", "label": "AAW"},
    {"id": "asuw", "label": "ASUW"},
    {"id": "asw", "label": "ASW"},
    {"id": "cyber", "label": "CYBER"},
],
"blue_card_catalog": [
    {"id": "SWB01", "title": "Continue Mission"},
    {"id": "SWB02", "title": "Reduce Speed / Safer Nav"},
    {"id": "SWB03", "title": "Internal Sync (60 seconds)"},
    {"id": "SWB04", "title": "Increase Speed"},
    {"id": "SWB05", "title": "Increase Lookouts / Visual Confirm"},
    {"id": "SWB07", "title": "Start Investigation"},
    {"id": "SWB08", "title": "Start In-Depth Investigation"},
    {"id": "SWB09", "title": "AIS Tracks Re-evaluation"},
    {"id": "SWB10", "title": "Isolate System", "targets_system": true},
    {"id": "SWB14", "title": "Reboot Affected System", "targets_system": true},
    {"id": "SWB15", "title": "Repair Component"},
    {"id": "SWB16", "title": "Reconnect System", "targets_system": true},
    {"id": "SWB18", "title": "Damage Control Focus"},
    {"id": "SWB19", "title": "Correct Course"},
    {"id": "SWB20", "title": "General Quarters"},
    {"id": "SWB21", "title": "Prepare Target"},
    {"id": "SWB23", "title": "Close Range to Compensate"},
    {"id": "SWB24", "title": "Approach Target"},
    {"id": "SWB26", "title": "Shift to Gun Focus"},
    {"id": "SWB27", "title": "Fire Missile Counterattack"},
    {"id": "SWB28", "title": "Engage Target with Guns"},
    {"id": "SWB29", "title": "Decoy Deployment"},
    {"id": "SWB30", "title": "Approach Land (Emergency Concealment)"},
],
```

**Step 4: Run seed and tests**

Run: `cd apps/tfc/backend && python -m pytest -v -k "domain_config"`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add apps/tfc/backend/seed* apps/tfc/backend/seeds/
git commit -m "feat(tfc): seed Silent Wake DomainConfig with systems, warfare domains, blue card catalog"
```

---

## Task 4: Scenario loader — generate events and decisions from turn definitions

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py`
- Test: `apps/tfc/backend/features/scenario/scenario_loader_test.py` (create)

This is the critical task. The loader must transform turn-based authoring into engine-compatible `ScheduledEvent` + `DecisionTemplate` objects.

**Step 1: Write the failing test**

```python
# apps/tfc/backend/features/scenario/scenario_loader_test.py
from features.scenario.scenario_content import (
    ScenarioContent,
    TurnDefinition,
    TurnInjectDef,
    TurnCardConfig,
    PathNoteDef,
    RoleDef,
    SystemEffectDef,
    DomainEffectDef,
)
from features.scenario.scenario_loader import (
    generate_events_from_turns,
    generate_decisions_from_turns,
)


ROLES = [
    RoleDef(id="co", label="CO", player_type="decision_maker"),
    RoleDef(id="ops", label="OPS", player_type="advisor"),
]


def test_generate_events_from_turn_with_injects():
    """Each turn inject becomes a ScenarioEventDef."""
    turn = TurnDefinition(
        turn_index=1,
        title="Steady Approach",
        facilitator_prompt="Transit phase has begun.",
        injects=[
            TurnInjectDef(target_roles=["ops"], text="Transit on schedule."),
            TurnInjectDef(target_roles=["co"], text="All normal."),
        ],
    )
    events = generate_events_from_turns([turn])
    assert len(events) == 2
    assert events[0].id == "turn-1-inject-0"
    assert events[0].target_roles == ["ops"]
    assert events[0].description == "Transit on schedule."
    assert events[0].event_type == "informational"


def test_generate_events_with_system_effects_on_start():
    """Turn-level system effects are attached to the first event."""
    turn = TurnDefinition(
        turn_index=5,
        title="Cyber Alert",
        injects=[TurnInjectDef(text="Anomaly detected.")],
        system_effects_on_start=[
            SystemEffectDef(system_id="comms", operational_state="yellow"),
        ],
        domain_effects_on_start=[
            DomainEffectDef(domain_id="cyber", threat_level="red"),
        ],
    )
    events = generate_events_from_turns([turn])
    assert len(events) == 1
    assert len(events[0].system_effects) == 1
    assert events[0].system_effects[0].system_id == "comms"
    assert len(events[0].domain_effects) == 1
    assert events[0].domain_effects[0].domain_id == "cyber"


def test_generate_decision_from_turn_with_cards():
    """Turn with available_cards generates a DecisionTemplateDef."""
    turn = TurnDefinition(
        turn_index=1,
        title="Steady Approach",
        has_decisions=True,
        available_cards=[
            TurnCardConfig(card_id="SWB01", score=5.0, stress_delta=0),
            TurnCardConfig(card_id="SWB03", score=3.0, stress_delta=0),
        ],
        max_selections=2,
        base_stress_delta=0,
    )
    decisions = generate_decisions_from_turns([turn])
    assert len(decisions) == 1
    dt = decisions[0]
    assert dt.id == "turn-1-decision"
    assert len(dt.options) == 2
    assert dt.options[0].id == "SWB01"
    assert dt.options[0].score == 5.0
    assert dt.options[1].id == "SWB03"
    assert dt.max_selections == 2
    assert dt.stress_delta == 0


def test_no_decision_when_has_decisions_false():
    """Turn 0 (no decisions) should not generate a DecisionTemplateDef."""
    turn = TurnDefinition(
        turn_index=0,
        title="Pre-Sail Briefing",
        has_decisions=False,
        injects=[TurnInjectDef(text="You are a crew of a Frigate.")],
    )
    decisions = generate_decisions_from_turns([turn])
    assert len(decisions) == 0


def test_turn_card_system_effects_map_to_decision_options():
    """Per-card system_effects become DecisionOptionDef.system_effects."""
    turn = TurnDefinition(
        turn_index=7,
        title="Reboot Decision",
        has_decisions=True,
        available_cards=[
            TurnCardConfig(
                card_id="SWB14",
                score=3.0,
                stress_delta=1,
                system_effects=[
                    SystemEffectDef(system_id="aaw-radar", operational_state="yellow"),
                ],
            ),
        ],
    )
    decisions = generate_decisions_from_turns([turn])
    opt = decisions[0].options[0]
    assert opt.stress_delta == 1
    assert len(opt.system_effects) == 1
    assert opt.system_effects[0].system_id == "aaw-radar"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/scenario_loader_test.py -v`
Expected: FAIL — `ImportError: cannot import name 'generate_events_from_turns'`

**Step 3: Implement the generator functions**

Add to `apps/tfc/backend/features/scenario/scenario_loader.py`:

```python
def generate_events_from_turns(
    turns: list[TurnDefinition],
) -> list[ScenarioEventDef]:
    """Generate ScenarioEventDef list from turn-based authoring structure."""
    events: list[ScenarioEventDef] = []
    for turn in turns:
        for i, inject in enumerate(turn.injects):
            event = ScenarioEventDef(
                id=f"turn-{turn.turn_index}-inject-{i}",
                title=f"{turn.title} — Inject {i + 1}" if turn.title else f"Turn {turn.turn_index} Inject {i + 1}",
                description=inject.text,
                event_type="decision" if (i == 0 and turn.has_decisions) else "informational",
                scheduled_pt_ms=turn.turn_index * 60_000,  # placeholder; real timing depends on game flow
                target_roles=inject.target_roles,
                role_descriptions=inject.role_descriptions,
                system_effects=turn.system_effects_on_start if i == 0 else [],
                domain_effects=turn.domain_effects_on_start if i == 0 else [],
            )
            events.append(event)
        if not turn.injects:
            # Turn with no injects but with effects still needs a marker event
            if turn.system_effects_on_start or turn.domain_effects_on_start:
                events.append(ScenarioEventDef(
                    id=f"turn-{turn.turn_index}-marker",
                    title=turn.title or f"Turn {turn.turn_index}",
                    description=turn.facilitator_prompt or "",
                    event_type="operational",
                    scheduled_pt_ms=turn.turn_index * 60_000,
                    system_effects=turn.system_effects_on_start,
                    domain_effects=turn.domain_effects_on_start,
                ))
    return events


def generate_decisions_from_turns(
    turns: list[TurnDefinition],
) -> list[DecisionTemplateDef]:
    """Generate DecisionTemplateDef list from turn-based authoring structure."""
    decisions: list[DecisionTemplateDef] = []
    for turn in turns:
        if not turn.has_decisions or not turn.available_cards:
            continue
        options = [
            DecisionOptionDef(
                id=card.card_id,
                label=card.card_id,  # Label resolved from catalog at load time
                score=card.score,
                stress_delta=card.stress_delta,
                system_effects=card.system_effects,
                targets_system=False,  # Resolved from catalog at load time
                max_plays=card.max_plays,
            )
            for card in turn.available_cards
        ]
        # Link to a synthetic issue for the turn
        issue_id = f"turn-{turn.turn_index}-issue"
        dt = DecisionTemplateDef(
            id=f"turn-{turn.turn_index}-decision",
            title=turn.title or f"Turn {turn.turn_index} Decision",
            description=turn.facilitator_prompt or "",
            issue_id=issue_id,
            question_type="multi_choice",
            options=options,
            max_selections=turn.max_selections,
            stress_delta=turn.base_stress_delta,
        )
        decisions.append(dt)
    return decisions
```

**Step 4: Run tests**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/scenario_loader_test.py -v`
Expected: ALL PASS

**Step 5: Verify existing loader tests still pass**

Run: `cd apps/tfc/backend && python -m pytest -v -k "loader or seed_validation"`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_loader.py apps/tfc/backend/features/scenario/scenario_loader_test.py
git commit -m "feat(tfc): generate events and decisions from turn definitions in scenario loader"
```

---

## Task 5: Integrate turn-based generation into `build_engine_config`

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py`
- Test: `apps/tfc/backend/features/scenario/scenario_loader_test.py`

**Step 1: Write the failing test**

```python
def test_build_engine_config_uses_turns_when_present():
    """When turns have injects/cards, build_engine_config generates events/decisions from them."""
    content = ScenarioContent(
        roles=ROLES,
        turns=[
            TurnDefinition(
                turn_index=0,
                title="Briefing",
                has_decisions=False,
                injects=[TurnInjectDef(text="You are a crew of a Frigate.")],
            ),
            TurnDefinition(
                turn_index=1,
                title="Steady Approach",
                has_decisions=True,
                injects=[
                    TurnInjectDef(target_roles=["ops"], text="Transit on schedule."),
                ],
                available_cards=[
                    TurnCardConfig(card_id="SWB01", score=5.0),
                    TurnCardConfig(card_id="SWB03", score=3.0),
                ],
            ),
        ],
    )
    config = build_engine_config(
        exercise_id=1, title="Test", content=content,
    )
    # Should have generated events from turn injects
    assert len(config.events) >= 2
    # Should have one decision template from turn 1
    assert len(config.decision_templates) == 1
    assert config.decision_templates[0].id == "turn-1-decision"


def test_build_engine_config_falls_back_to_legacy_events():
    """When turns have no injects, existing events/decisions are used (backward compat)."""
    content = ScenarioContent(
        roles=ROLES,
        events=[
            ScenarioEventDef(
                id="evt-1", title="Test Event", event_type="informational",
                scheduled_pt_ms=0,
            ),
        ],
        issues=[],
        decision_templates=[],
    )
    config = build_engine_config(
        exercise_id=1, title="Test", content=content,
    )
    assert len(config.events) == 1
    assert config.events[0].event_id == "evt-1"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/scenario_loader_test.py::test_build_engine_config_uses_turns_when_present -v`
Expected: FAIL — turn-based events not generated by build_engine_config yet

**Step 3: Update `build_engine_config`**

In `scenario_loader.py`, update `build_engine_config()` to detect turn-based authoring:

```python
def build_engine_config(...) -> EngineConfig:
    # Detect if turns contain authored content (injects or cards)
    has_turn_content = any(
        t.injects or t.available_cards for t in content.turns
    )

    if has_turn_content:
        # Generate events and decisions from turns
        generated_events = generate_events_from_turns(content.turns)
        generated_decisions = generate_decisions_from_turns(content.turns)
        events = load_scenario_events_from_defs(generated_events)
        decision_templates = load_decision_templates_from_defs(generated_decisions)
        # Also generate synthetic issues for turn decisions
        generated_issues = _generate_issues_for_turns(content.turns)
        issues = load_scenario_issues_from_defs(generated_issues)
    else:
        # Legacy path: use directly authored events/decisions
        events = load_scenario_events(content)
        decision_templates = load_decision_templates(content)
        issues = load_scenario_issues(content)

    # Rest of config building unchanged...
```

**Step 4: Run all tests**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/ -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_loader.py apps/tfc/backend/features/scenario/scenario_loader_test.py
git commit -m "feat(tfc): integrate turn-based generation into build_engine_config with legacy fallback"
```

---

## Task 6: Merge DomainConfig foundations with scenario overrides in loader

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py`
- Test: `apps/tfc/backend/features/scenario/scenario_loader_test.py`

**Step 1: Write the failing test**

```python
def test_merge_domain_config_systems_with_scenario_overrides():
    """Scenario overrides DomainConfig initial system states."""
    domain_systems = [
        {"id": "nav-radar", "label": "NAV RADAR", "category": "system"},
        {"id": "comms", "label": "COMMS", "category": "system"},
    ]
    # Scenario says COMMS starts Yellow (override), nav-radar inherits Green default
    content = ScenarioContent(
        roles=ROLES,
        initial_system_states=[
            SystemStateDef(system_id="comms", operational_state="yellow", power_state=True),
        ],
    )
    merged = merge_system_states(domain_systems, content.initial_system_states)
    assert len(merged) == 2
    comms = next(s for s in merged if s.system_id == "comms")
    assert comms.operational_state == "yellow"
    nav = next(s for s in merged if s.system_id == "nav-radar")
    assert nav.operational_state == "green"  # default from domain
```

**Step 2: Implement `merge_system_states` and `merge_warfare_domains`**

```python
def merge_system_states(
    domain_systems: list[dict],
    scenario_overrides: list[SystemStateDef],
) -> list[SystemStateDef]:
    """Merge domain config systems with scenario-level overrides."""
    override_map = {s.system_id: s for s in scenario_overrides}
    merged = []
    for sys_def in domain_systems:
        sid = sys_def["id"]
        if sid in override_map:
            merged.append(override_map[sid])
        else:
            merged.append(SystemStateDef(
                system_id=sid,
                label=sys_def.get("label", ""),
                category=sys_def.get("category", "system"),
                operational_state="green",
                power_state=False,
            ))
    return merged


def merge_warfare_domains(
    domain_wds: list[dict],
    scenario_overrides: list[WarfareDomainDef],
) -> list[WarfareDomainDef]:
    """Merge domain config warfare domains with scenario-level overrides."""
    override_map = {w.domain_id: w for w in scenario_overrides}
    merged = []
    for wd_def in domain_wds:
        did = wd_def["id"]
        if did in override_map:
            merged.append(override_map[did])
        else:
            merged.append(WarfareDomainDef(
                domain_id=did,
                label=wd_def.get("label", ""),
                initial_threat_level="green",
            ))
    return merged
```

**Step 3: Run tests**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/scenario_loader_test.py -v`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_loader.py apps/tfc/backend/features/scenario/scenario_loader_test.py
git commit -m "feat(tfc): merge DomainConfig foundations with scenario overrides in loader"
```

---

## Task 7: Resolve blue card labels and `targets_system` from DomainConfig catalog

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py`
- Test: `apps/tfc/backend/features/scenario/scenario_loader_test.py`

**Step 1: Write the failing test**

```python
def test_resolve_card_labels_from_catalog():
    """Decision options get their labels and targets_system from the catalog."""
    catalog = [
        {"id": "SWB01", "title": "Continue Mission", "targets_system": False},
        {"id": "SWB10", "title": "Isolate System", "targets_system": True},
    ]
    turn = TurnDefinition(
        turn_index=1,
        has_decisions=True,
        available_cards=[
            TurnCardConfig(card_id="SWB01", score=5.0),
            TurnCardConfig(card_id="SWB10", score=3.0),
        ],
    )
    decisions = generate_decisions_from_turns([turn], blue_card_catalog=catalog)
    assert decisions[0].options[0].label == "Continue Mission"
    assert decisions[0].options[0].targets_system is False
    assert decisions[0].options[1].label == "Isolate System"
    assert decisions[0].options[1].targets_system is True
```

**Step 2: Update `generate_decisions_from_turns` to accept catalog**

Add optional `blue_card_catalog: list[dict] | None = None` parameter. When provided, resolve `label` and `targets_system` from catalog entries by matching `card_id`.

**Step 3: Run tests**

Run: `cd apps/tfc/backend && python -m pytest features/scenario/scenario_loader_test.py -v`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_loader.py apps/tfc/backend/features/scenario/scenario_loader_test.py
git commit -m "feat(tfc): resolve blue card labels and targets_system from DomainConfig catalog"
```

---

## Task 8: Update frontend TypeScript interfaces for DomainConfig

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/domain-config-api.service.ts`

**Step 1: Add new interfaces**

```typescript
export interface WarfareDomainDef {
  id: string;
  label: string;
  description?: string;
}

export interface BlueCardDef {
  id: string;
  title: string;
  description?: string;
  targets_system: boolean;
}
```

**Step 2: Update `DomainConfigResponse`**

Add fields:
```typescript
  systems: SystemDef[];
  warfare_domains: WarfareDomainDef[];
  blue_card_catalog: BlueCardDef[];
```

Where `SystemDef` already exists (check current interface name — may be named differently).

**Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/core/domain-config-api.service.ts
git commit -m "feat(tfc): add warfare_domains and blue_card_catalog to frontend DomainConfig types"
```

---

## Task 9: Update frontend ScenarioContent interfaces for turn-based authoring

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/scenario-api.service.ts`

**Step 1: Add new interfaces**

```typescript
export interface TurnInjectDef {
  target_roles: string[];
  text: string;
  role_descriptions: Record<string, string>;
}

export interface TurnCardConfig {
  card_id: string;
  score: number;
  stress_delta: number;
  system_effects: SystemEffectDef[];
  domain_effects: DomainEffectDef[];
  max_plays: number;
}

export interface PathNoteDef {
  card_ids: string[];
  notes: string;
}

export interface DomainEffectDef {
  domain_id: string;
  threat_level: string;
}
```

**Step 2: Update `TurnDefinition`**

Add the new fields matching the backend:
```typescript
export interface TurnDefinition {
  turn_index: number;
  title: string;
  facilitator_prompt: string | null;
  has_decisions: boolean;
  duration_ms: number | null;
  inject_ids: string[];           // legacy
  decision_template_id: string | null;  // legacy
  injects: TurnInjectDef[];
  available_cards: TurnCardConfig[];
  max_selections: number;
  base_stress_delta: number;
  system_effects_on_start: SystemEffectDef[];
  domain_effects_on_start: DomainEffectDef[];
  best_path: PathNoteDef | null;
  acceptable_path: PathNoteDef | null;
  design_notes: string;
}
```

**Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/core/scenario-api.service.ts
git commit -m "feat(tfc): add turn-based authoring interfaces to frontend ScenarioContent types"
```

---

## Task 10: Frontend — Scenario builder store expansion for turn-based authoring

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts`
- Test: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.spec.ts` (create)

**Step 1: Add turn CRUD methods to store**

```typescript
addTurn(turn: TurnDefinition): void
removeTurn(turnIndex: number): void
updateTurn(turnIndex: number, updates: Partial<TurnDefinition>): void
reorderTurns(fromIndex: number, toIndex: number): void
duplicateTurn(turnIndex: number): void

// Turn inject CRUD
addInjectToTurn(turnIndex: number, inject: TurnInjectDef): void
removeInjectFromTurn(turnIndex: number, injectIndex: number): void
updateInjectInTurn(turnIndex: number, injectIndex: number, updates: Partial<TurnInjectDef>): void

// Turn card CRUD
addCardToTurn(turnIndex: number, cardConfig: TurnCardConfig): void
removeCardFromTurn(turnIndex: number, cardId: string): void
updateCardInTurn(turnIndex: number, cardId: string, updates: Partial<TurnCardConfig>): void
```

**Step 2: Write colocated spec tests**

Test each method: add/remove/update turns, add/remove cards from turns, duplicate turn auto-increments index, reorder updates indices.

**Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/
git commit -m "feat(tfc): add turn CRUD methods to scenario builder store"
```

---

## Tasks 11–14: Frontend UI Components (outline — detail when ready)

These tasks build the actual UI for the three-phase creation flow. They depend on Tasks 1–10 being complete.

### Task 11: Phase 1 — Foundation picker component
- New component: `scenario-foundation-picker.ts`
- Shows DomainConfig with editable catalog tables (roles, systems, warfare domains, cards)
- Uses `DomainConfigApiService` to fetch and update

### Task 12: Phase 2 — Scenario setup form
- New component: `scenario-setup-form.ts`
- Title, description, briefing, objectives, rules, game mode, score thresholds
- Initial state overrides grid (systems power/operational, domains threat level)

### Task 13: Phase 3 — Turn editor (split panel)
- New component: `scenario-turn-editor.ts`
- Left panel: turn timeline with drag-to-reorder, stress pips
- Right panel: turn header, injects, blue card picker, turn consequences, facilitator notes

### Task 14: Wire the three phases into the scenario builder view
- Update `scenario-builder-view.ts` with phase navigation (foundation → setup → turns)
- Connect to existing save/load/clone flow
- Update validation for turn-based content

---

## Verification Checklist

Before declaring complete:

- [ ] Existing seed validation tests pass (`seed_validation_test.py`)
- [ ] Existing scenario CRUD tests pass (`scenario_test.py`)
- [ ] Existing domain config tests pass (`domain_config_test.py`)
- [ ] New turn-based loader tests pass
- [ ] DomainConfig migration runs cleanly (up and down)
- [ ] Silent Wake seed data includes full catalogs
- [ ] Frontend builds without errors (`ng build`)
- [ ] `SPECS.md` updated with new DomainConfig fields and turn-based authoring
- [ ] `manifest.yaml` updated for scenario and domain_config features
