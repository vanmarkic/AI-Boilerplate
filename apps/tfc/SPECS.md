# TFC — Training Flow Control — Product Specification

<!--
  This file tells LLM agents WHAT the software does.
  AGENTS.md tells them HOW to write code — this tells them WHY and WHAT.

  Fill every section before starting implementation.
  Update whenever you add a feature or change business rules.
  Stale specs are worse than no specs.
-->

## What This Is

A domain-agnostic exercise simulation platform. A Game Master (GM) loads a scenario, starts the exercise, and players respond to events, issues, and decision points in real time. Think crisis-management tabletop exercise, but digital and real-time.

**Users:** Exercise facilitators (Game Masters) and participants (Players) in training, crisis management, or educational settings.

## Domain Model

```
Scenario ──loads──▶ Exercise ──runs──▶ Engine
                        │                   │
                        │              ┌────┴──────┐
                     Participants    TimeManager
                     (GM + Players)  EventScheduler
                        │            IssueManager
                   WaitingRoom       DecisionManager
                   (lobby, roles)    GameMode (strategy)
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
- **Engine** contains: TimeManager, EventScheduler, IssueManager, DecisionManager, GameMode.
- **Scenario** N:1 **DomainConfig** — a scenario references a domain config for terminology/theming.
- **DecisionTemplate** 1:N **DecisionOptionDef** — each decision template has multiple selectable options.

## Features & Business Rules

### Feature: scenario (tier 1, backend)

- **Purpose:** CRUD for reusable exercise templates.
- **Rules:**
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
- **API:**
  - `POST /api/scenarios` — Create scenario
  - `GET /api/scenarios` — List scenarios
  - `GET /api/scenarios/{id}` — Get scenario
  - `PUT /api/scenarios/{id}` — Update scenario
  - `DELETE /api/scenarios/{id}` — Delete scenario

### Feature: exercise (tier 1, backend + frontend)

- **Purpose:** Exercise lifecycle management + engine HTTP/WS API.
- **Rules:**
  - Exercise phases: `setup → briefing → running → paused → completed`.
  - **Briefing phase:** `start()` transitions from SETUP to BRIEFING (not directly to RUNNING). The player reads the scenario context (briefing text, objectives, rules, roles). Time does **not** advance. `begin()` transitions BRIEFING → RUNNING. `reset()` can return BRIEFING → SETUP.
  - An exercise is created from a scenario and a game mode (`classic` or `simple_collaborative`).
  - **Practice mode:** A solo-play variant for facilitator training and scenario testing. Available only with `simple_collaborative` game mode. Enforces max 1 player in the waiting room. Decision base time is multiplied by 1.5× to compensate for solo cognitive load. Practice exercises are excluded from the joinable list. Auto-advances to the next turn when a decision is resolved (frontend triggers the next scheduled event automatically).
  - Session codes are unique 6-character alphanumeric strings, generated on creation.
  - Engine tick loop runs at 250ms interval.
  - Speed factor adjusts play time vs real time (e.g., 2× = 2 play-minutes per 1 real minute).
  - In classic mode, DECISION events auto-pause the engine until resolved. In collaborative mode, the engine continues running.
  - WebSocket broadcasts state changes to all connected participants. Events and decisions with non-empty `target_roles` are split-broadcast: sent only to matching roles + GMs + generic `player` connections (so solo/practice mode receives all role-targeted changes).
  - Force-triggering a decision-type event via `POST .../engine/events/{id}/trigger` opens the decision immediately (same as a scheduled trigger).
- **API:**
  - `POST /api/exercises` — Create exercise
  - `GET /api/exercises` — List exercises (optional `?phase=` filter)
  - `GET /api/exercises/joinable` — List joinable exercises with available slots
  - `GET /api/exercises/by-code/{code}` — Lookup exercise by session code
  - `GET /api/exercises/{id}` — Get exercise details
  - `PUT /api/exercises/{id}` — Update exercise
  - `DELETE /api/exercises/{id}` — Delete exercise
  - Engine sub-routes: `POST .../engine/start`, `POST .../engine/begin`, `POST .../engine/pause`, `POST .../engine/resume`, `POST .../engine/reset`, `POST .../engine/complete`, `PUT .../engine/speed`, `GET .../engine/snapshot`, `GET .../engine/context` (context includes `roles` array with `id`, `label`, `player_type`)
  - Event actions: `POST .../engine/events/{id}/trigger|cancel|complete|pause|resume|delay|skip`
  - Issue actions: `POST .../engine/issues/{id}/activate|mitigate|resolve|release`
  - Decision actions: `GET .../engine/decisions`, `POST .../engine/decisions/{id}/close`, `POST .../engine/decisions/recommend`

### Feature: decision (tier 1, backend)

- **Purpose:** Decision CRUD — questions, responses, outcomes.
- **Rules:**
  - Decisions have a `question_type`: `single_choice` or `multi_choice`.
  - In collaborative mode, advisors submit non-binding recommendations; the decision-maker submits the binding ruling.
  - Scoring: `penalty_ms = (max_possible_score - selected_score) * penalty_factor * 1000`.
  - Effective decision time: `max(min_decision_time_ms, base_decision_time_ms - accumulated_penalty_ms)`.
  - Timeout auto-submits the worst option.
  - `forced_option_ids` on a decision template causes auto-inclusion with penalty when omitted.
  - `max_selections` on a decision template caps how many options can be selected in a `multi_choice` decision (`null` = unlimited).
- **API:**
  - `POST /api/decisions` — Create decision
  - `GET /api/decisions` — List decisions
  - `GET /api/decisions/{id}` — Get decision
  - `POST /api/decisions/{id}/respond` — Submit response
  - `POST /api/decisions/{id}/close` — Close decision

### Feature: waiting_room (tier 1, backend + frontend)

- **Purpose:** Pre-exercise lobby with role assignment.
- **Rules:**
  - Players join via session code.
  - Role assignment is first-come-first-served from scenario-defined roles.
  - In practice mode, max players is capped at 1 (overrides scenario role count).
  - WebSocket broadcasts presence changes (join, leave, ready-up).
- **API:**
  - `POST /api/exercises/{id}/waiting-room/join` — Join waiting room
  - `GET /api/exercises/{id}/waiting-room` — Get waiting room state
  - `DELETE /api/exercises/{id}/waiting-room/participants/{pid}` — Remove participant

### Feature: domain_config (tier 1, backend + frontend)

- **Purpose:** DB-backed domain terminology, theming, and role definitions.
- **Rules:**
  - Each config has a unique `slug` (e.g., `default`, `military`, `cybersecurity`).
  - Terminology maps generic code terms to domain-specific labels (e.g., "Event" → "Inject").
  - Theme includes colors, fonts, and density.
  - Seeded with 4 presets; extensible via API without redeploy.
- **API:**
  - `POST /api/domain-configs` — Create config
  - `GET /api/domain-configs` — List configs
  - `GET /api/domain-configs/{id}` — Get by ID
  - `GET /api/domain-configs/by-slug/{slug}` — Get by slug
  - `PUT /api/domain-configs/{id}` — Update config
  - `DELETE /api/domain-configs/{id}` — Delete config

### Feature: audit (tier 1, backend)

- **Purpose:** Immutable audit trail for all exercise events.
- **Rules:**
  - All engine state changes are logged with timestamp, exercise ID, and event type.
  - Audit entries are append-only.
  - Action is derived from change type: `decision_closed` → "decided", `decision_opened` → "opened", `score_change` → "scored"; falls back to `action` or `lifecycle` field.
  - `target_id` resolves from `decision_id`, `event_id`, or `issue_id` (in that priority order).
  - Audit logging is non-fatal — write failures are logged as warnings but do not interrupt the engine tick loop.
- **API:**
  - `GET /api/audit?exercise_id={id}` — Get audit log for exercise

### Feature: health (tier 1, backend)

- **Purpose:** Readiness/liveness probe.
- **Rules:**
  - Always returns `{ status: "ok" }`, no auth required, < 100ms response.
- **API:**
  - `GET /api/health`

### Game Modes

- **Classic:** GM-driven, no scoring. GM manually triggers events and closes decisions. Engine pauses on decisions. Requires a Game Master.
- **Simple Collaborative:** Turn-based with advisor/decision-maker roles. Sequential decisions with time-penalty scoring. Advisors recommend, decision-maker rules. Engine continues running during decisions. Does not require a GM. Supports practice mode (solo play with 1.5× decision timer).

#### Stress Model (Simple Collaborative)

Stress is an **independent dimension from score**. A decision can be both high-scoring and high-stress (e.g., engaging a hostile target is tactically correct but operationally stressful). Stress sources:

1. **Option `stress_delta`** — each decision option carries its own `stress_delta` (integer). Positive values increase stress, negative values reduce it, zero is neutral. Stress delta is independent of `score` — a high-score option can have high stress and vice versa.
2. **Turn-induced stress** — certain scenario turns inherently raise stress regardless of player choice (e.g., coming under attack). This is modelled via options where all choices carry positive `stress_delta`, or via forced cards that add stress.

Stress is clamped to `[0, 10]`. Accumulated stress reduces the decision timer via the stress-time lookup table:

| Stress | Decision Time |
|--------|--------------|
| 0 | 300s | 1 | 290s | 2 | 280s | 3 | 270s | 4 | 260s |
| 5 | 250s | 6 | 240s | 7 | 230s | 8 | 210s | 9 | 190s | 10 | 180s |

#### Decision Timer

Each decision has a `timeout_ms`. If the decision template specifies a timeout, that value is used. Otherwise, the game mode provides the timeout from the stress-time table above. The timer resets at the start of each new decision. Timeout auto-submits the worst option (lowest `score`).

### Feature: scoring (tier 1, backend + frontend) — **partial**

- **Purpose:** Score tracking with contextual per-option scores and tiered end-of-exercise summary.
- **Rules:**
  - Scores are decoupled from blue cards (decisions) — a decision option's score depends on context and can be +/−/0.
  - Score is **never shown to players** — not during play, not at the end of the exercise.
  - Total score expressed at end-of-exercise in 3 tiers: **Lo / Mid / Hi**. No numbers shown.
  - Tier thresholds defined in `ScenarioContent.score_tier_thresholds` (e.g., `{"lo": 0.33, "mid": 0.66}`).
  - No negative wording — all feedback is encouraging and praises effort, even if score is low.
- **Status:**
  - [x] Backend score calculation (sum of selected option scores per decision)
  - [x] Score persistence in database (`DecisionResponseRecord.score`)
  - [x] `score_tier_thresholds` field on scenario content
  - [ ] Hide score from player UI (currently shown in player header — **must be removed**)
  - [ ] End-of-exercise tier display (Lo/Mid/Hi with encouraging messaging)
  - [ ] Positive-only feedback wording for all tier levels

### Feature: systems (tier 1, backend + frontend) — **partial**

- **Purpose:** Ship/facility systems displayed for all roles and players with power (ON/OFF) and operational status (Red/Yellow/Green).
- **Rules:**
  - Each system has: `system_id`, `label`, `category` (system | weapon), `power: bool`, `operational: red|yellow|green`.
  - Systems are visible to all players and roles at all times.
  - **Decision system effects:** Blue cards can repair or affect systems via `system_effects` on decision options (`power_state`, `operational_state`).
  - **Multi-system repair cap:** A card that can repair multiple systems is limited to `max_selections` on the decision template (e.g., repair card with `max_selections: 2` can only fix 2 systems).
  - **Event-triggered degradation:** Injects (events) can degrade system states (power off, operational → red/yellow).
  - **General Quarters:** Certain forced cards (e.g., "General Quarters") turn all systems ON via `SystemManager.set_all_power(True)`.
- **Status:**
  - [x] `SystemManager` backend with power + operational state tracking
  - [x] `set_all_power()` method for General Quarters
  - [x] `SystemStatusBoardComponent` frontend (chip layout, traffic-light visual)
  - [x] Decision option `system_effects` applied on decision close
  - [x] Systems defined in seed data (silent_wake.json)
  - [ ] Event-triggered system degradation (events need `system_effects` field + engine logic)
  - [ ] General Quarters seed data needs `system_effects` wired to `set_all_power(True)`
  - [ ] `targets_system` / `max_plays` submission data plumbing (TODO in engine)

### Feature: player_view (tier 1, frontend) — **done**

- **Purpose:** Player-facing exercise UI with real-time state display.
- **Rules:**
  - **Turn countdown clock:** Displays decision countdown when a decision is open (timeout > 0), otherwise shows time remaining until the next scheduled event. Falls back to real-time clock when neither applies.
  - **Logs drawer:** Right-side drawer showing audit trail — previous turns for all players and roles (inject + decision log). Entries for `decision_closed` display the selected option IDs inline.

## Implementation Status

<!-- Quick-reference checklist for PM domain vocabulary features -->

| Feature | Status | Notes |
|---------|--------|-------|
| Score decoupled from blue cards (+/−/0) | done | Backend calculates per-option scores |
| Score tiers (Lo/Mid/Hi) at end | to do | Field exists, no UI or tier computation |
| Never show score during play | to do | Currently visible in player header — remove |
| No negative wording | to do | Tier display not yet built |
| Stress delta per blue card (+/−/0) | done | `stress_delta` on each decision option |
| Turn-related stress delta | done | `stress_delta` on decision template |
| System states (ON/OFF + R/Y/G) | done | `SystemManager` + `SystemStatusBoardComponent` |
| Blue cards repair systems | partial | `system_effects` works, `targets_system` plumbing TODO |
| Multi-system repair cap (max_selections) | done | `max_selections` on decision template |
| Systems degrade from injects | to do | Events lack `system_effects` field |
| General Quarters turns all systems ON | partial | `set_all_power()` exists, seed data not wired |
| Decision log drawer | done | Logs drawer with inject + decision history |

## Backlog

Features identified from domain reference docs (Silent Wake game mechanics, PM questions, known gaps) not yet specified or implemented. Ordered by domain grouping, not priority.

### Turn Structure & Phases

- **Turn phases (4-phase cycle)** — each turn follows: Resolve/Comment → Inject → Discuss → Decide+Justify. The engine currently models turns implicitly via decision sequencing; explicit phase tracking would enable phase-aware UI and timers.
- **Turn 0 as explicit concept** — Turn 0 = briefing phase with role-targeted injects and no decisions. Currently the briefing phase exists but is not linked to a "Turn 0" with its own inject delivery.
- **Post-game phases** — Hot wash-up (30min), Team Lightning Report (5min), Instructor's Debrief. No engine or UI support for structured post-exercise review flow.

### Blue Card Constraints

- **Blue card uniqueness constraint** — if 2 cards chosen per turn, they must be different. Exception: SWB07/SWB08 may repeat if each targets a different component. Needs card-play validation.
- **Blue card prerequisite chain** — SWB08 requires SWB07 on the same component in a prior turn. Needs cross-turn card history tracking.
- **Blue card turn availability** — cards are only available on certain turns (defined per scenario in the seed data). Engine needs to filter available cards per turn.
- **Blue card system targeting** — some cards require declaring which system to target (e.g., SWB10 "Isolate System", SWB14 "Reboot"). Needs a system picker UI interaction on top of "select up to 2 blue cards".
- **Investigation mechanic** — SWB07 → SWB08 prerequisite chain with component targeting. Combines prerequisite tracking + system targeting.
- **Turn-dependent scoring** — the same blue card can score differently per inject context/turn (e.g., SWB01 scores +0 in Turn 1 but -1 in Turn 8). Currently each option has a fixed score; needs per-turn score overrides.

### Systems & Warfare Domains

- **Warfare domains** — separate board section from systems, with own Green/Yellow/Red states meaning No threat / Possible threat / Actual threat (not operational status). Distinct from system operational states.
- **Cascading system effects** — system-to-system propagation paths (e.g., WECDIS → INS → speed feed; AAW → ASUW tracking). Currently only direct card → system effects, no system → system propagation.
- **Weapon 2-tier state** — weapons use OK/Damaged (binary), not Green/Yellow/Red (3-tier). `SystemManager` currently uses 3-tier for everything; weapons may need a separate state model.
- **Cyber propagation paths** — scenario-defined system-to-system attack chains. Would be authored in scenario content and evaluated by the engine during resolution.

### Stress & Scoring

- **Latent/conditional stress** — stress triggered by what was NOT played (e.g., "if radar diagnostic not started → Stress +1"). Requires checking prior-turn decision history against scenario-defined conditions.
- **Manual GM stress override** — in Classic (GM-driven) mode, the facilitator sets stress directly. Needs a `PUT .../engine/stress` endpoint.

### Advisor Protocol

- **CO decision protocol** — structured 15-second advisor answers: Recommendation, Expected effect, Tradeoff, Time (ETBOL). Currently advisors submit free-form recommendations; structured prompts would guide better input.

## Terminology Mapping (Domain ↔ Code)

The TFC codebase uses generic code names for domain concepts. The table below maps **domain language** (what users and exercise facilitators say) to **code names** (what appears in source files).

| Domain Term | Code Term | Description |
|-------------|-----------|-------------|
| **Inject** | `Event` / `ScheduledEvent` / `EventScheduler` | A scheduled occurrence in the exercise timeline. Supports `target_roles` (role visibility) and `role_descriptions` (per-role text). Code uses "event" throughout. |
| **Defect** | `Issue` / `TrackedIssue` / `IssueManager` | A problem surfaced during the exercise. Code uses "issue" throughout. |
| **Exercise** | `Exercise` / `ExerciseEngine` | A running instance of a scenario. |
| **Scenario** | `Scenario` / `ScenarioContent` | A reusable exercise template. |
| **Blue Card** | `DecisionTemplate` / `DecisionOption` | A decision card played during a turn. Options carry `score`, `stress_delta`, and optional `system_effects`. |
| **Decision** | `DecisionPoint` / `DecisionManager` | A question posed to players. |
| **System** | `SystemState` / `SystemManager` | A ship/facility system with power (ON/OFF) and operational status (red/yellow/green). |
| **Game Master (GM)** | GM | The facilitator running the exercise. |
| **Player** | Participant | Someone responding to injects and defects. |

## Glossary

| Term | Definition |
|------|-----------|
| Inject | Domain term for a scheduled event in the exercise timeline. Code: `Event`. |
| Defect | Domain term for a problem surfaced during an exercise. Code: `Issue`. |
| GM (Game Master) | The facilitator who runs the exercise, controls the engine, and observes decisions. |
| Player / Participant | Someone responding to injects and making decisions during an exercise. |
| Scenario | A reusable exercise template containing events, issues, and decision templates. |
| Exercise | A running instance of a scenario with participants. |
| Engine | The pure-Python tick-based runtime that drives exercise time, events, issues, and decisions. |
| Tick | A 250ms engine cycle that advances play time and evaluates triggers. |
| Decision Template | A question definition with options, scores, and optional forced cards. |
| Game Mode | A pluggable strategy that defines scoring and turn mechanics (Classic or SimpleCollaborative). |
| Turn | In collaborative mode, an implicit sequence position tracked by `current_index`. |
| Advisor | In collaborative mode, a player who submits non-binding recommendations. |
| Decision-Maker | In collaborative mode, the player who submits the binding ruling. |
| Domain Config | A terminology/theme/role configuration that customizes the UI for a specific domain (e.g., military, cybersecurity). |
| Briefing Phase | A gated pre-game phase where players read scenario context before gameplay begins. Time does not advance. |
| Practice Mode | A solo-play variant of simple collaborative mode for facilitator training. 1 player, 1.5× decision timer. |
| Session Code | A unique 6-character alphanumeric code used to join an exercise. |
| Role-Targeted Event | An event with non-empty `target_roles` — only matching player roles (+ GMs) receive it via WebSocket. |
| Role Description | Per-role text override on an event (`role_descriptions` dict). Player sees their role's text; others see the default `description`. |
| Tutorial Scenario | A simplified scenario (2-3 turns) designed to teach game mechanics before a full exercise. |
| Blue Card | Domain term for a decision option played during a turn. Code: `DecisionOption`. Carries score, stress_delta, and optional system_effects. |
| System | A ship/facility subsystem with power state (ON/OFF) and operational status (red/yellow/green). Code: `SystemState`. |
| System Effect | A state change applied to a system when a blue card is played or an inject fires. Defined as `system_effects` on decision options (and planned for events). |
| General Quarters | A forced blue card that turns all systems ON. Uses `SystemManager.set_all_power(True)`. |
| Score Tier | End-of-exercise score classification: Lo / Mid / Hi. Thresholds defined per scenario. No raw numbers shown. |
