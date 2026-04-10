# TFC Classic Game Mode

Trainer-driven exercise mode where a human facilitator (Game Master) controls the pace, triggers events, and oversees player decisions. No automated scoring, no stress mechanics, no turn sequencing — the trainer is in full control.

## Overview

Classic mode reproduces a physical tabletop crisis-management exercise in digital form. The trainer loads a scenario, walks players through a briefing, then manually triggers injects (events) and decision points as the exercise unfolds. The engine pauses whenever a decision opens, giving players unlimited time to discuss and respond. The trainer closes the decision (or a player submits), the engine auto-resumes, and the exercise continues until the trainer completes it.

## Roles

### Trainer (Game Master)

The facilitator who drives the exercise. Navigates to `/gm` after deployment.

Capabilities:
- Start / Begin / Pause / Resume / Complete / Reset the exercise
- Trigger, pause, resume, cancel, and complete individual events
- Activate, mitigate, and resolve issues (defects)
- Close open decisions
- Adjust simulation speed (0.5× – 10×)
- View all player states, decisions, event timeline, systems, warfare domains
- View the decision log

The trainer is **not** counted toward the crew capacity in the waiting room. They occupy a dedicated `trainer` slot.

### Players

Each player occupies one scenario-defined role. Roles have a `player_type`:

| Type | Behaviour |
|------|-----------|
| `decision_maker` | Submits the binding ruling when a decision is open. Sees all advisor recommendations before deciding. |
| `advisor` | Submits a non-binding recommendation. Selection auto-submits immediately on click. |

In the Silent Wake scenario, the 7-seat crew is:

| Role ID | Label | Type |
|---------|-------|------|
| CO | Commanding Officer | `decision_maker` |
| OPS | Operations Officer | `advisor` |
| PWO | Principal Warfare Officer | `advisor` |
| AAWO | Anti-Air Warfare Officer | `advisor` |
| CyOp | Cyber Operator | `advisor` |
| NAV | Navigator | `advisor` |
| EO | Engineering Officer | `advisor` |

## Lifecycle

```
GM creates exercise (setup)
        │
        ▼
  Waiting Room ──── Players join, claim roles
        │
        ▼
   GM: "Start" ──── phase: setup → briefing
        │              (players see briefing overlay)
        ▼
   GM: "Begin" ──── phase: briefing → running
        │              (tick loop starts, time advances)
        ▼
   ┌─── Running ◄─────────────────────────────────┐
   │       │                                       │
   │  Events fire by play-time schedule            │
   │  GM can force-trigger any event               │
   │       │                                       │
   │  DECISION event fires                         │
   │       │                                       │
   │       ▼                                       │
   │    PAUSED ──── decision opens                 │
   │       │        engine stops, time frozen       │
   │       │        players discuss & respond       │
   │       │                                       │
   │  Decision closed (player submit or GM close)  │
   │       │                                       │
   │  No more open decisions?                      │
   │       └── yes ── auto-resume ─────────────────┘
   │
   │  GM: "Complete"
   │       │
   │       ▼
   │   COMPLETED ──── exercise ends
   └──────────────────────────────────────────────
```

### Phase Transitions

| From | To | Trigger | What happens |
|------|----|---------|--------------|
| setup | briefing | GM clicks "Start" | Players see briefing overlay (scenario context, objectives, rules). Time does **not** advance. |
| briefing | running | GM clicks "Begin" | Tick loop starts (250ms interval). Play-time clock begins. Scheduled events start firing. |
| running | paused | Decision-type event fires | Engine auto-pauses. Time frozen. Tick loop stopped. |
| paused | running | Last open decision closed | Engine auto-resumes. Time and tick loop restart. |
| running | paused | GM clicks "Pause" | Manual pause. Same effect as decision-pause. |
| paused | running | GM clicks "Resume" | Manual resume. |
| any (except setup) | completed | GM clicks "Complete" | Exercise ends. Time stops. Tick loop stops. |
| briefing | setup | GM clicks "Reset" | Returns to setup. All engine state reloaded from scenario. |

## Waiting Room

### Creation

The GM creates an exercise from the Game Master view by selecting a scenario and choosing the "classic" game mode. The backend generates a 6-character session code and sets the initial phase to `setup`.

### Joining

1. **First joiner** → automatically assigned the `trainer` role (if no trainer present).
2. **Subsequent joiners** → assigned as `player`, then auto-claimed to the first available scenario role.
3. Role assignment is first-come-first-served. Duplicate roles are rejected (HTTP 409).
4. The trainer slot does not count toward the crew capacity.

### Readiness & Deployment

The "Deploy" button enables when all role slots are filled: `participants.length >= scenarioRoles.length + 1` (the +1 is the trainer).

On deploy:
- The GM navigates to `/gm?exerciseId=<id>`
- Players navigate to `/player?exerciseId=<id>&participantId=<pid>&role=<roleId>`

Unlike collaborative mode, classic mode does **not** call the engine start endpoint on deploy. The GM manually starts the exercise from the GM control panel.

## Events (Injects)

Events are scheduled occurrences on the exercise timeline. Each event has:

- `event_id`, `title`, `description`
- `event_type`: `informational`, `operational`, or `decision`
- `scheduled_pt_ms`: the play-time at which it fires
- `execution_mode`: `automatic` (fires when play-time reaches the schedule) or `manual` (only fires when GM force-triggers)
- `target_roles`: which roles see the event (empty = all)
- `role_descriptions`: per-role inject text overrides
- `system_effects`: system state changes applied when the event starts
- `domain_effects`: warfare domain threat-level changes applied when the event starts
- `depends_on`: event IDs that must complete before this one can fire

### Event Lifecycle

`scheduled → pending → running → completed/cancelled/paused`

- **Automatic events** fire when `play_time >= scheduled_pt_ms` and all dependencies are met.
- **Manual events** only fire when the GM explicitly triggers them via the control panel.
- The GM can also force-trigger any event regardless of schedule or execution mode.

### GM Event Controls

| Action | Effect |
|--------|--------|
| Trigger | Force-fire the event immediately |
| Pause | Suspend a running event |
| Resume | Continue a paused event |
| Cancel | Abort the event |
| Complete | Mark the event as finished |

## Decisions

When a `decision`-type event fires, the engine opens a decision and **pauses**.

### Decision Flow

1. Event fires (by schedule or GM trigger)
2. Engine looks up the matching `DecisionTemplate`
3. `DecisionManager.open_decision()` creates an `ActiveDecision`
4. Engine transitions to `PAUSED` — time frozen, tick loop stopped
5. `DecisionOpened` state change broadcast to all connected clients
6. **Advisors** see their role-specific decision cards (blue cards). Clicking an option auto-submits a recommendation.
7. **Decision-maker (CO)** sees all options plus advisor recommendations (marked with indicators). Must explicitly confirm their selection.
8. Decision is closed via:
   - Player submission (decision-maker clicks "Submit")
   - GM closes it from the control panel
9. System effects from selected cards are applied
10. If no more open decisions remain, engine **auto-resumes**

### Decision Properties

| Property | Classic Behaviour |
|----------|-------------------|
| Timeout | No timeout. `on_decision_timeout()` returns `None`. Players have unlimited time. |
| Scoring | No scoring. `on_decision_closed_v2()` returns `[]`. |
| Turn sequencing | None. `get_next_decision_id()` returns `None`. GM triggers events manually. |
| Pause on open | Yes. `should_pause_on_decision()` returns `True`. |
| Stress | Not tracked. No stress accumulation or timer reduction. |

### Blue Cards (Decision Options)

Each option on a decision has:

- `label`, `description`
- `score`: unused in classic mode (relevant only to collaborative scoring)
- `stress_delta`: unused in classic mode
- `system_effects`: applied when the card is selected and decision closed
- `targets_system`: if true, player must choose which system the card targets
- `max_plays`: per-session play limit (0 = unlimited). Exhausted options excluded from selection.

## Systems

Systems represent ship/facility subsystems. Visible to all players and roles at all times.

Each system has:
- `system_id`, `label`, `category` (system or weapon)
- `power`: ON or OFF
- `operational`: green (nominal), yellow (degraded), or red (failed)
- Weapons use 2-tier state: green (OK) or red (non-operational) — no yellow.

System state changes via:
- **Event system effects** — applied when an inject transitions to RUNNING
- **Decision option system effects** — applied when a decision closes with that option selected
- **General Quarters** — `set_all_power: true` turns all systems ON

## Warfare Domains

Four threat-level domains displayed on a board: ASUW, ASW, AAW, CYBER.

Each domain has a `threat_level`: green (no threat), yellow (possible), or red (actual). Updated by event `domain_effects` when injects fire.

## What Classic Mode Does NOT Have

These features exist only in Simple Collaborative mode:

| Feature | Classic | Collaborative |
|---------|---------|---------------|
| Automated scoring | No | Yes — per-option scores, forced-card penalties |
| Stress tracking | No | Yes — 0–10 scale, reduces decision timer |
| Decision timeouts | No | Yes — stress-table timer, auto-submits worst option |
| Turn sequencing | No | Yes — backend auto-advances to next decision |
| Auto-completion | No | Yes — engine auto-completes when sequence exhausted |
| Score tiers | No | Yes — Lo / Mid / Hi shown at end of exercise |
| Practice mode | No | Yes — solo play with 1.5× timer |

## GM Control Panel

The Game Master view (`/gm`) provides:

- **Header**: exercise title, domain selector, presence indicator, real-time clock, speed display, phase badge
- **Event Timeline**: visual timeline of all events with play-time positions and lifecycle states
- **Defect List**: active issues with lifecycle controls
- **Trainee Monitor**: connected participants and their decision states
- **Event/Issue Actions**: buttons to trigger/cancel/complete events and manage issues
- **Decision Panel**: list of open decisions with "View" and "Close" buttons
- **Detail Panel**: expanded view of selected event or issue
- **Context Panel**: briefing, objectives, rules from the scenario
- **Warfare Domain Board**: 4-domain threat-level display
- **System Status Board**: all systems with power and operational indicators
- **Footer Controls**: Start / Begin / Pause / Resume / Complete / Reset / Stop buttons, speed slider (0.5× – 10×), logs toggle
- **Decision Log Drawer**: per-turn history of all decisions, recommendations, and outcomes

## Key Implementation Files

| File | Purpose |
|------|---------|
| `backend/engine/game_modes/classic.py` | Classic mode strategy — all method stubs, `should_pause_on_decision()` = True, `requires_trainer()` = True |
| `backend/engine/game_modes/protocol.py` | `GameMode` protocol interface |
| `backend/engine/exercise_engine.py` | Core engine — tick loop, decision close with auto-resume (lines 264–266), event trigger |
| `backend/engine/decision_manager.py` | In-flight decision tracking |
| `backend/engine/event_scheduler.py` | Event lifecycle management |
| `backend/engine/system_manager.py` | System state tracking |
| `backend/engine/warfare_domain_manager.py` | Warfare domain threat levels |
| `backend/features/exercise/engine_router.py` | Engine HTTP API (start/begin/pause/resume/complete) |
| `backend/features/exercise/engine_actions_router.py` | Event/issue action endpoints |
| `backend/features/waiting_room/waiting_room_router.py` | Waiting room join/leave/role-update |
| `backend/features/waiting_room/waiting_room_store.py` | In-memory waiting room state |
| `frontend/src/app/features/game-master/game-master-view.ts` | GM control panel UI |
| `frontend/src/app/features/player/player-view.ts` | Player exercise view |
| `frontend/src/app/features/player/role-card.component.ts` | Per-role decision card UI |
| `frontend/src/app/features/waiting-room/waiting-room-view.ts` | Waiting room lobby |
