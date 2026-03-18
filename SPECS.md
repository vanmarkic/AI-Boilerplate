# Product Specification

<!--
  This file tells LLM agents WHAT the software does.
  AGENTS.md tells them HOW to write code — this tells them WHY and WHAT.

  Fill every section before starting implementation.
  Update whenever you add a feature or change business rules.
  Stale specs are worse than no specs.
-->

## What This Is

This is a monorepo containing two applications:

1. **Main App** (`apps/main/`) — A full-stack web application template (Angular + FastAPI + PostgreSQL + Keycloak). Serves as a boilerplate for new projects.
2. **TFC — Training Flow Control** (`apps/tfc/`) — A domain-agnostic exercise simulation platform. A Game Master (GM) loads a scenario, starts the exercise, and players respond to events, issues, and decision points in real time. Think crisis-management tabletop exercise, but digital and real-time.

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
  - Scenarios are loaded by `scenario_loader.py` and converted to `EngineConfig`.
  - Seed script (`seed.py`) upserts scenarios by title — existing scenarios are updated with current seed content on restart.
- **API:**
  - `POST /api/scenarios` — Create scenario
  - `GET /api/scenarios` — List scenarios
  - `GET /api/scenarios/{id}` — Get scenario
  - `PUT /api/scenarios/{id}` — Update scenario
  - `DELETE /api/scenarios/{id}` — Delete scenario

### Feature: exercise (tier 1, backend + frontend)

- **Purpose:** Exercise lifecycle management + engine HTTP/WS API.
- **Rules:**
  - Exercise phases: `setup → running → paused → completed`.
  - An exercise is created from a scenario and a game mode (`classic` or `simple_collaborative`).
  - Session codes are unique 6-character alphanumeric strings, generated on creation.
  - Engine tick loop runs at 250ms interval.
  - Speed factor adjusts play time vs real time (e.g., 2× = 2 play-minutes per 1 real minute).
  - DECISION events auto-pause the engine until resolved.
  - WebSocket broadcasts state changes to all connected participants.
- **API:**
  - `POST /api/exercises` — Create exercise
  - `GET /api/exercises` — List exercises (optional `?phase=` filter)
  - `GET /api/exercises/joinable` — List joinable exercises with available slots
  - `GET /api/exercises/by-code/{code}` — Lookup exercise by session code
  - `GET /api/exercises/{id}` — Get exercise details
  - `PUT /api/exercises/{id}` — Update exercise
  - `DELETE /api/exercises/{id}` — Delete exercise
  - Engine sub-routes: `POST .../engine/start`, `POST .../engine/pause`, `POST .../engine/resume`, `POST .../engine/reset`, `POST .../engine/complete`, `PUT .../engine/speed`, `GET .../engine/snapshot`, `GET .../engine/context`
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
- **API:**
  - `GET /api/audit?exercise_id={id}` — Get audit log for exercise

### Feature: health (tier 1, backend)

- **Purpose:** Readiness/liveness probe.
- **Rules:**
  - Always returns `{ status: "ok" }`, no auth required, < 100ms response.
- **API:**
  - `GET /api/health`

### Game Modes

- **Classic:** GM-driven, no scoring. GM manually triggers events and closes decisions.
- **Simple Collaborative:** Turn-based with advisor/decision-maker roles. Sequential decisions with time-penalty scoring. Advisors recommend, decision-maker rules. Penalty accumulates across turns and reduces available decision time.

## TFC Terminology Mapping (Domain ↔ Code)

The TFC codebase uses generic code names for domain concepts. The table below maps **domain language** (what users and exercise facilitators say) to **code names** (what appears in source files).

| Domain Term | Code Term | Description |
|-------------|-----------|-------------|
| **Inject** | `Event` / `ScheduledEvent` / `EventScheduler` | A scheduled occurrence in the exercise timeline. Code uses "event" throughout. |
| **Defect** | `Issue` / `TrackedIssue` / `IssueManager` | A problem surfaced during the exercise. Code uses "issue" throughout. |
| **Exercise** | `Exercise` / `ExerciseEngine` | A running instance of a scenario. |
| **Scenario** | `Scenario` / `ScenarioContent` | A reusable exercise template. |
| **Decision** | `DecisionPoint` / `DecisionManager` | A question posed to players. |
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
| Session Code | A unique 6-character alphanumeric code used to join an exercise. |
