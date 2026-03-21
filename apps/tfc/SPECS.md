# TFC — Training Flow Control — Product Specification

<!--
  Single source of truth for WHAT TFC does and WHY.
  AGENTS.md tells agents HOW to write code — this tells them WHAT to build.

  Update in the same commit as any feature or business-rule change.
  If unsure whether a rule belongs here, it does.
-->

## What This Is

A domain-agnostic exercise simulation platform. A Game Master (GM) loads a scenario, starts the exercise, and players respond to events, issues, and decision points in real time. Think crisis-management tabletop exercise, but digital and real-time.

**Users:** Exercise facilitators (Game Masters) and participants (Players) in training, crisis management, or educational settings.

## Non-Goals

- Not a real-time multiplayer game — no physics, no spatial simulation.
- No player-vs-player mechanics — all decisions are collaborative or GM-driven.
- No persistent player accounts or progression — exercises are standalone sessions.
- No competitive scoring between teams — score is internal, never shown as numbers.
- Not a content authoring tool beyond the scenario builder — bulk content authored as JSON seeds.

## Domain Model

```
Scenario ──loads──▶ Exercise ──runs──▶ Engine
                        │                   │
                        │              ┌────┴──────┐
                     Participants    TimeManager
                     (GM + Players)  EventScheduler
                        │            IssueManager
                   WaitingRoom       DecisionManager
                   (lobby, roles)    SystemManager
                                     GameMode (strategy)
                                         │
                                    ┌────┴────┐
                                 Classic   SimpleCollaborative

DomainConfig ──referenced-by──▶ Scenario
  (terminology, theme, roles, severity levels)
```

### Entity Relationships

- **Scenario** 1:N **Exercise** — a scenario is a reusable template; exercises are instances.
- **Exercise** 1:N **Participant** — each exercise has a GM and multiple players.
- **Exercise** 1:1 **Engine** — each running exercise has one engine instance.
- **Engine** contains: TimeManager, EventScheduler, IssueManager, DecisionManager, SystemManager, GameMode.
- **Scenario** N:1 **DomainConfig** — a scenario references a domain config for terminology/theming.
- **DecisionTemplate** 1:N **DecisionOptionDef** — each decision template has multiple selectable options.

---

## Features & Business Rules

Each feature lists its **purpose**, **implemented rules**, and **planned work** (if any). Fully implemented features omit the Planned section.

### Feature: scenario · backend

CRUD for reusable exercise templates.

- A scenario must have a title and at least one event.
- Scenario content includes: briefing, objectives, rules, events, issues, decision templates.
- Scenario must define at least one role with `player_type='decision_maker'`.
- Simple collaborative scenarios must define at least 2 roles (poka-yoke).
- Decision template `target_roles` must reference valid role IDs defined in the scenario.
- Decision templates support an optional `max_selections` field to cap multi-choice selections (`null` = unlimited).
- Event `target_roles` (list of role IDs) controls visibility — empty means all players see the event. Event `role_descriptions` (dict mapping role ID → text) provides per-role inject text; players see their role's description or fall back to the main `description`.
- Both event `target_roles` and `role_descriptions` keys are validated against scenario-defined roles.
- Scenarios are loaded by `scenario_loader.py` and converted to `EngineConfig`.
- Seed script (`seed.py`) upserts scenarios by title — existing scenarios are updated with current seed content on restart. Supports multiple scenario seeds (e.g., full scenario + tutorial).

**API:** `POST /api/scenarios` · `GET /api/scenarios` · `GET /api/scenarios/{id}` · `PUT /api/scenarios/{id}` · `DELETE /api/scenarios/{id}`

### Feature: exercise · backend + frontend

Exercise lifecycle management + engine HTTP/WS API.

- Exercise phases: `setup → briefing → running → paused → completed`.
- **Briefing phase:** `start()` transitions SETUP → BRIEFING. Player reads the scenario context (briefing, objectives, rules, roles). Time does **not** advance. `begin()` transitions BRIEFING → RUNNING. `reset()` returns BRIEFING → SETUP.
- An exercise is created from a scenario and a game mode (`classic` or `simple_collaborative`).
- **Practice mode:** Solo-play variant for facilitator training. `simple_collaborative` only. Max 1 player. Decision time ×1.5. Excluded from joinable list.
- Session codes are unique 6-character alphanumeric strings, generated on creation.
- Engine tick loop runs at 250ms interval.
- Speed factor adjusts play time vs real time (e.g., 2× = 2 play-minutes per 1 real minute).
- In classic mode, DECISION events auto-pause the engine until resolved. In collaborative mode, the engine continues running.
- **Decision sequencing (backend-driven):** In simple collaborative mode, the backend owns turn advancement. After a decision is closed (player submission or timeout), the engine force-triggers the next event in the game mode's `decision_sequence` and opens the next decision. The tick loop guard skips DECISION events when one is already open, preventing pile-up. The frontend is purely reactive — no frontend-side auto-advance logic. Classic mode is unaffected (GM-driven).
- WebSocket broadcasts state changes to all connected participants. Role-targeted events/decisions are split-broadcast: matching roles + GMs + generic `player` connections.
- Force-triggering a decision-type event via `POST .../engine/events/{id}/trigger` opens the decision immediately.

**API:**
- CRUD: `POST /api/exercises` · `GET /api/exercises` · `GET /api/exercises/joinable` · `GET /api/exercises/by-code/{code}` · `GET /api/exercises/{id}` · `PUT /api/exercises/{id}` · `DELETE /api/exercises/{id}`
- Engine: `POST .../engine/start|begin|pause|resume|reset|complete` · `PUT .../engine/speed` · `GET .../engine/snapshot` · `GET .../engine/context` (includes `roles[]`)
- Events: `POST .../engine/events/{id}/trigger|cancel|complete|pause|resume|delay|skip`
- Issues: `POST .../engine/issues/{id}/activate|mitigate|resolve|release`
- Decisions: `GET .../engine/decisions` · `POST .../engine/decisions/{id}/close` · `POST .../engine/decisions/recommend`

### Feature: decision · backend

Decision CRUD — questions, responses, outcomes.

- Decisions have a `question_type`: `single_choice` or `multi_choice`.
- In collaborative mode, advisors submit non-binding recommendations; the decision-maker submits the binding ruling.
- Scoring: `penalty_ms = (max_possible_score - selected_score) * penalty_factor * 1000`.
- Effective decision time: `max(min_decision_time_ms, base_decision_time_ms - accumulated_penalty_ms)`.
- Timeout auto-submits the worst option (lowest `score`).
- `forced_option_ids` on a decision template causes auto-inclusion with penalty when omitted.
- `max_selections` caps how many options can be selected in a `multi_choice` decision (`null` = unlimited).

**API:** `POST /api/decisions` · `GET /api/decisions` · `GET /api/decisions/{id}` · `POST /api/decisions/{id}/respond` · `POST /api/decisions/{id}/close`

### Feature: scoring · backend + frontend

Score tracking with contextual per-option scores and tiered end-of-exercise summary.

- Scores are decoupled from blue cards — a decision option's score depends on context and can be +/−/0.
- Score is **never shown to players** — not during play, not at the end of the exercise.
- Total score expressed at end-of-exercise in 3 tiers: **Lo / Mid / Hi**. No numbers shown.
- Tier thresholds defined in `ScenarioContent.score_tier_thresholds` (e.g., `{"lo": 0.33, "mid": 0.66}`).
- No negative wording — all feedback is encouraging and praises effort, even if score is low.

**Planned:**
- [ ] Hide score from player UI — currently visible in player header, must be removed → `player-view.html`, `exercise.store.ts`
- [ ] End-of-exercise tier display (Lo/Mid/Hi with encouraging messaging)
- [ ] Positive-only feedback wording for all tier levels

### Feature: systems · backend + frontend

Ship/facility systems displayed for all roles and players with power (ON/OFF) and operational status (Red/Yellow/Green).

- Each system has: `system_id`, `label`, `category` (system | weapon), `power: bool`, `operational: red|yellow|green`.
- Systems are visible to all players and roles at all times.
- **Decision system effects:** Blue cards can repair or affect systems via `system_effects` on decision options (`power_state`, `operational_state`).
- **Multi-system repair cap:** A card that can repair multiple systems is limited to `max_selections` on the decision template.
- **Event-triggered degradation:** Injects (events) can degrade system states (power off, operational → red/yellow).
- **General Quarters:** Certain forced cards turn all systems ON via `SystemManager.set_all_power(True)`.

**Planned:**
- [ ] Event-triggered system degradation — events need `system_effects` field + engine logic → `event_scheduler.py`, `exercise_engine.py`
- [ ] General Quarters seed data — wire `system_effects` to `set_all_power(True)` → `seeds/silent_wake.json`
- [ ] `targets_system` / `max_plays` submission data plumbing → `exercise_engine.py:348`

### Feature: waiting_room · backend + frontend

Pre-exercise lobby with role assignment.

- Players join via session code.
- Role assignment is first-come-first-served from scenario-defined roles.
- In practice mode, max players is capped at 1 (overrides scenario role count).
- WebSocket broadcasts presence changes (join, leave, ready-up).

**API:** `POST /api/exercises/{id}/waiting-room/join` · `GET /api/exercises/{id}/waiting-room` · `DELETE /api/exercises/{id}/waiting-room/participants/{pid}`

### Feature: domain_config · backend + frontend

DB-backed domain terminology, theming, and role definitions.

- Each config has a unique `slug` (e.g., `default`, `military`, `cybersecurity`).
- Terminology maps generic code terms to domain-specific labels (e.g., "Event" → "Inject").
- Theme includes colors, fonts, and density.
- Seeded with 4 presets; extensible via API without redeploy.

**API:** `POST /api/domain-configs` · `GET /api/domain-configs` · `GET /api/domain-configs/{id}` · `GET /api/domain-configs/by-slug/{slug}` · `PUT /api/domain-configs/{id}` · `DELETE /api/domain-configs/{id}`

### Feature: audit · backend

Immutable audit trail for all exercise events.

- All engine state changes are logged with timestamp, exercise ID, and event type.
- Audit entries are append-only.
- Action derived from change type: `decision_closed` → "decided", `decision_opened` → "opened", `score_change` → "scored"; falls back to `action` or `lifecycle` field.
- `target_id` resolves from `decision_id`, `event_id`, or `issue_id` (priority order).
- Audit logging is non-fatal — write failures are warnings, never interrupt the engine tick loop.

**API:** `GET /api/audit?exercise_id={id}`

### Feature: player_view · frontend

Player-facing exercise UI with real-time state display.

- **Turn countdown clock:** Decision countdown when open (timeout > 0), otherwise time to next scheduled event. Falls back to real-time clock.
- **Logs drawer:** Right-side drawer with audit trail — previous turns for all roles (inject + decision log). Decision entries show selected option IDs inline.

### Feature: health · backend

Readiness/liveness probe. Returns `{ status: "ok" }`, no auth, < 100ms.

**API:** `GET /api/health`

---

## Game Modes

- **Classic:** GM-driven, no scoring. GM manually triggers events and closes decisions. Engine pauses on decisions. Requires a Game Master.
- **Simple Collaborative:** Turn-based with advisor/decision-maker roles. Sequential decisions with time-penalty scoring. Advisors recommend, decision-maker rules. Engine continues running during decisions. Does not require a GM. Supports practice mode (solo play with 1.5× decision timer).

### Stress Model (Simple Collaborative)

Stress is **independent from score**. A decision can be both high-scoring and high-stress.

1. **Option `stress_delta`** — each decision option carries `stress_delta` (integer, +/−/0). Independent of `score`.
2. **Turn-induced stress** — modelled via options where all choices carry positive `stress_delta`, or via forced cards.

Stress clamped to `[0, 10]`. Reduces the decision timer:

| Stress | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|--------|---|---|---|---|---|---|---|---|---|---|---|
| Time | 300s | 290s | 280s | 270s | 260s | 250s | 240s | 230s | 210s | 190s | 180s |

### Decision Timer

Each decision has `timeout_ms`. If the template specifies a timeout, that value is used. Otherwise, the game mode provides the timeout from the stress table. Timer resets per decision. Timeout auto-submits the worst option (lowest `score`).

---

## Backlog

Identified from domain reference docs, PM questions, and known gaps. Items graduate from **Raw** to **Shaped** when they have a clear problem statement and solution sketch.

### Shaped (ready to build)

#### Blue card prerequisite chains
- **Problem:** SWB08 requires SWB07 on the same component in a prior turn. Without validation, players can play cards in invalid order.
- **Solution:** Cross-turn card history on `DecisionManager`; validation hook in `close_decision()`.
- **No-gos:** No generic prerequisite DSL — hardcode the SWB07→SWB08 chain for now.

#### Blue card uniqueness constraint
- **Problem:** If 2 cards chosen per turn, they must be different. Exception: SWB07/SWB08 may repeat if each targets a different component.
- **Solution:** Card-play validation in `close_decision()` checking selected IDs against same-turn history.

#### Manual GM stress override
- **Problem:** In Classic mode, the facilitator sets stress directly. No endpoint exists.
- **Solution:** `PUT .../engine/stress` endpoint + `SystemManager.set_stress()` method.

#### Warfare domains
- **Problem:** Separate board section from systems with own Green/Yellow/Red states meaning threat level (No threat / Possible / Actual), not operational status. Currently not modelled.
- **Solution:** New `WarfareDomainManager` in engine, separate from `SystemManager`. Frontend `WarfareDomainBoardComponent`.
- **No-gos:** Do not merge with system operational states — semantics are different.

### Raw (ideas, not yet shaped)

**Turn structure:**
- Turn phases (4-phase cycle) — Resolve/Comment → Inject → Discuss → Decide+Justify. Currently implicit.
- Turn 0 as explicit concept — briefing phase linked to Turn 0 inject delivery.
- Post-game phases — Hot wash-up, Team Lightning Report, Instructor's Debrief.

**Blue card mechanics:**
- Blue card turn availability — cards only available on certain turns (per scenario).
- Blue card system targeting — system picker UI for cards like SWB10 "Isolate System", SWB14 "Reboot".
- Investigation mechanic — SWB07 → SWB08 chain with component targeting.
- Turn-dependent scoring — same blue card scores differently per inject context/turn.

**Systems:**
- Cascading system effects — system-to-system propagation (WECDIS → INS → speed feed; AAW → ASUW).
- Weapon 2-tier state — weapons use OK/Damaged (binary), not Green/Yellow/Red.
- Cyber propagation paths — scenario-defined attack chains evaluated by engine.

**Stress & scoring:**
- Latent/conditional stress — triggered by what was NOT played (prior-turn history check).

**Advisor protocol:**
- CO decision protocol — structured 15s advisor prompts: Recommendation, Expected effect, Tradeoff, Time.

---

## Glossary & Code Mapping

| Domain Term | Code Term | Definition |
|-------------|-----------|------------|
| Inject | `Event` / `ScheduledEvent` / `EventScheduler` | A scheduled occurrence in the exercise timeline. Supports `target_roles` and `role_descriptions`. |
| Defect | `Issue` / `TrackedIssue` / `IssueManager` | A problem surfaced during the exercise. |
| Blue Card | `DecisionTemplate` / `DecisionOption` | A decision card played during a turn. Carries `score`, `stress_delta`, optional `system_effects`. |
| Decision | `DecisionPoint` / `DecisionManager` | A question posed to players with options and timeout. |
| System | `SystemState` / `SystemManager` | A subsystem with power (ON/OFF) and operational status (red/yellow/green). |
| System Effect | `system_effects` on `DecisionOption` | State change applied to a system when a blue card is played or an inject fires. |
| General Quarters | `SystemManager.set_all_power(True)` | A forced blue card that turns all systems ON. |
| Exercise | `Exercise` / `ExerciseEngine` | A running instance of a scenario. |
| Scenario | `Scenario` / `ScenarioContent` | A reusable exercise template. |
| Engine | `ExerciseEngine` | Pure-Python tick-based runtime (250ms). No DB, no HTTP. |
| Game Mode | `GameMode` protocol / `ClassicMode` / `SimpleCollaborativeMode` | Pluggable strategy for scoring and turn mechanics. |
| GM (Game Master) | — | The facilitator who runs the exercise. |
| Player / Participant | `Participant` | Someone responding to injects and making decisions. |
| Advisor | — | In collaborative mode, submits non-binding recommendations. |
| Decision-Maker | — | In collaborative mode, submits the binding ruling. |
| Domain Config | `DomainConfig` | Terminology/theme/role config per domain (military, cybersecurity, etc.). |
| Score Tier | `score_tier_thresholds` on `ScenarioContent` | End-of-exercise classification: Lo / Mid / Hi. No raw numbers shown. |
| Stress | `stress` on score snapshot | Team-level counter (0–10). Reduces decision timer. |
| Briefing Phase | `phase = "briefing"` | Pre-game phase where players read scenario context. Time does not advance. |
| Practice Mode | `practice_mode = True` | Solo-play variant. 1 player, 1.5× decision timer. |
| Session Code | `session_code` | Unique 6-char alphanumeric code for joining exercises. |
| Turn | `current_index` on `SimpleCollaborativeMode` | Implicit sequence position in collaborative mode. |
| Role-Targeted Event | Event with non-empty `target_roles` | Only matching roles + GMs receive it via WebSocket. |
| Tutorial Scenario | — | Simplified scenario (2-3 turns) for teaching game mechanics. |
