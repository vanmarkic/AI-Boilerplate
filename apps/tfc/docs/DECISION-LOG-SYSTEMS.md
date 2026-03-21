# Systems Feature — Decision Log

## Task 1: Event-triggered system degradation

**Decision:** Apply system_effects when event transitions to RUNNING (started action), not on PENDING or COMPLETED.
- **Why:** Matches domain semantics — "the inject fires and its effects happen immediately." Issue activation happens on COMPLETED, but system degradation is immediate on inject start.
- **Alternative considered:** Apply on event completion — rejected because the game narrative says systems degrade *when* the event occurs, not after it resolves.

**Decision:** Add `system_effects: list[SystemEffect]` to both `ScheduledEvent` (engine dataclass) and `ScenarioEventDef` (Pydantic model).
- **Why:** Keeps the same pattern as decision options which also carry `system_effects`.

**Decision:** Add full system catalog to `initial_system_states` in silent_wake.json (13 systems/weapons vs previous 5).
- **Why:** Game mechanics doc lists NAV RADAR, IBMS/INS, NAV SENSORS, COMMS, AAW RADAR, ASUW TRACKING RADAR, EW SUITE, CIC NETWORK + 5 weapons (CIWS FWD, CIWS AFT, Missile Launcher, Gun, Decoys). All are needed for event-triggered degradation to work.
- Weapons start OFF per game mechanics. ASUW TRACKING RADAR also starts OFF.

**Decision:** Added `category` field to `SystemStateDef` (Pydantic) with default "system".
- **Why:** Weapons need distinct display treatment. Category was already on `SystemState` dataclass but not exposed in scenario content schema.

**Seed events with system_effects added:**
- evt-t5 (Turn 5): COMMS → yellow (SATCOM/HF degradation)
- evt-t10 (Turn 10): CIWS FWD → red/OFF, Missile Launcher → red/OFF (combat damage)
- evt-t11 (Turn 11): IBMS/INS → yellow (cyber-attack confirmed)

## Task 2: General Quarters — set_all_power(True)

**Decision:** Use a dedicated `"set_all_power": true` flag on `SystemEffectDef` rather than listing all systems individually.
- **Why:** More maintainable — adding/removing systems from the scenario doesn't require updating every General Quarters card. Matches the domain concept of "General Quarters powers everything."
- **Alternative considered:** List all system_ids explicitly — rejected as fragile and verbose.

**Decision:** Engine checks for `set_all_power` flag in `_apply_system_effects` and `_apply_event_system_effects`, delegates to `SystemManager.set_all_power(True)`.

## Task 3: max_plays enforcement

**Decision:** Track play counts in a `dict[str, int]` on `ExerciseEngine` keyed by option ID.
- **Why:** Simple, engine-scoped tracking. Resets on engine reset. No DB needed since this is per-exercise-session state.
- Play count increments when a decision closes with that option selected.
- When max_plays reached, option is excluded from auto-timeout selection.

**Decision:** `targets_system` remains informational for now — field flows through to frontend but no engine enforcement.
- **Why:** System picker UI is deferred per SPECS.md backlog. The field exists in the schema for forward compatibility.
