# TFC — Functional Specification v2

> Training Flow Control: a real-time, multi-role naval cyber wargame for command decision-making under uncertainty and time pressure.

---

## 1. Purpose & Scope

TFC is a **facilitator-controlled, turn-based tabletop cyber wargame** conducted digitally in real time. It is **not** a competitive multiplayer game — there is no physics simulation, no spatial model, and no inter-team scoring. The focus is on **decision rationale, communication under pressure, and trade-offs**.

**Setting:** Multi-domain naval exercise (fictional, unclassified). A frigate crew faces escalating cyber-kinetic threats during independent transit.

**Teams:**
- **WHITE/RED TEAM (Facilitator)** — runs the exercise, delivers injects, adjudicates outcomes.
- **BLUE TEAM (Ship crew / Players)** — fill officer seats, receive situational briefings, submit recommendations or decisions under time pressure.

---

## 2. Roles & Authority

### 2.1 Ship's Company (7 Seats)

| Role | Abbr | Type | Responsibility |
|------|------|------|----------------|
| **Commanding Officer** | **CO** | Decision-maker | Final call each turn: choose 1–2 blue cards after hearing recommendations. Balance mission progress, survivability, escalation risk. |
| **Operations Officer** | **OPS** | Advisor | Mission planning, intelligence, MTC liaison, ROE awareness |
| **Principal Warfare Officer** | **PWO** | Advisor | Surface picture, ESM, engagement coordination, threat assessment |
| **Anti-Air Warfare Officer** | **AAWO** | Advisor | Air surveillance radar, air threat timelines, sensor posture |
| **Cyber Operator** | **CyOp** | Advisor | Network monitoring, cyber threat detection, IBMS/INS analysis, mitigation proposals |
| **Navigator** | **NAV** | Advisor | Navigation systems, AIS, WECDIS, route management, chart references |
| **Engineering Officer** | **EO** | Advisor | System health, repairs, ETBOL estimates, component status |

### 2.2 Player Types

| Player Type | Authority | Behaviour |
|-------------|-----------|-----------|
| **Decision-Maker (CO)** | Submits the binding ruling on each decision. | Sees all advisor recommendations before choosing. Can select from all available blue cards. |
| **Advisor (OPS, PWO, AAWO, CyOp, NAV, EO)** | Submits a non-binding recommendation. | Sees only their own role-targeted briefing. Recommendation auto-submits on selection. |

### 2.3 Game Master (Facilitator)

In classic mode, a Game Master is required. The GM:
- Manually triggers and completes injects.
- Activates defects.
- Pauses and resumes the exercise.
- Controls the speed factor.
- Sees all role-targeted information and all participant activity.

In collaborative mode, no GM is required — the engine auto-sequences decisions.

### 2.4 CO Decision Protocol

For each blue card option under consideration, the CO asks each advisor for a 15-second answer covering:
1. **Recommendation** — what to do
2. **Expected effect** — what improves
3. **Trade-off** — what you lose
4. **Time** — ETBOL / how many turns

**Authority:** Advisors recommend; CO decides. CO has final authority on manoeuvre, posture, and action selection.
**Exception:** Turn 6 — the Facilitator forces SWB20 (General Quarters) if the CO doesn't select it.

---

## 3. Ship Systems

### 3.1 System Catalog (6 Systems)

| System | Description | Initial State |
|--------|-------------|---------------|
| **NAV RADAR** | Navigation radar | Green, ON |
| **IBMS / INS** (incl. WECDIS) | Integrated Bridge Management System / Inertial Navigation System | Green, ON |
| **NAV SENSORS** | GPS, speed log, compasses | Green, ON |
| **ASUW TRACKING RADAR** | Anti-Surface Warfare tracking radar | Green, OFF |
| **COMMS** | SATCOM, HF, UHF | Green, ON |
| **AAW RADAR** | Anti-Air Warfare surveillance radar | Green, OFF |

### 3.2 Weapon Catalog (5 Weapons)

| Weapon | Description | Initial State |
|--------|-------------|---------------|
| **CIWS FWD** | Close-In Weapon System (forward) | OK, OFF |
| **CIWS AFT** | Close-In Weapon System (aft) | OK, OFF |
| **Missile Launcher** | Primary anti-ship/anti-air missile system | OK, OFF |
| **Gun** | Naval gun for surface engagement | OK, OFF |
| **Decoys** | Deceptive countermeasures against incoming missiles | OK, OFF |

### 3.3 System Properties

Each system tracks:
- **Power:** ON / OFF (boolean)
- **Operational state:** Green (fully operational) / Yellow (degraded) / Red (critical/disabled)
- **Category:** System or Weapon

### 3.4 Category-Specific Rules

| Category | Operational States | Transition Rule |
|----------|--------------------|-----------------|
| **System** | Green, Yellow, Red | Can move through all three states in any direction. |
| **Weapon** |  Green, Yellow, Red | Can move through all three states in any direction. |

### 3.5 General Quarters

A special system effect that sets **all** systems and weapons to power ON simultaneously. Modeled as a flag rather than listing every system individually.

### 3.6 Effect Sources

System states change via:
- **Inject effects** — applied when an inject transitions to RUNNING.
- **Blue card effects** — applied when a decision closes with that card selected.
- **Cascading cyber propagation** — scenario-defined attack chains (documented but not yet engine-automated):

```
WECDIS → INS → speed feed to all systems
AAW RADAR processing module → ASUW TRACKING RADAR
```

---

## 4. Warfare Domains

### 4.1 Domain Catalog (4 Domains)

| Domain | Abbr | Threat Levels |
|--------|------|---------------|
| **Anti-Surface Warfare** | ASUW | No threat / Possible / Actual |
| **Anti-Submarine Warfare** | ASW | No threat / Possible / Actual |
| **Anti-Air Warfare** | AAW | No threat / Possible / Actual |
| **Cyber** | CYBER | No threat / Possible / Actual |

### 4.2 Threat Level States

| Level | Label | Meaning |
|-------|-------|---------|
| Green | No threat | No detected threat in this domain |
| Yellow | Possible threat | Suspicious activity, unconfirmed |
| Red | Actual threat | Confirmed hostile activity |

### 4.3 Effect Sources

Domain threat levels change via:
- **Inject effects** — applied when an inject transitions to RUNNING.
- **Blue card effects** — applied on decision close.

Warfare domain threat levels are conceptually separate from system operational states — a system can be Green while its warfare domain is Red.

---

## 5. Blue Card Catalog

### 5.1 Card List (23 Cards)

| Card | Title | Available Turns | Notes |
|------|-------|----------------|-------|
| SWB01 | Continue Mission | 1,2,3,5,6,7,8,9,12,14,15 | Maintain tempo |
| SWB02 | Reduce Speed / Safer Nav | Tutorial only | |
| SWB03 | Internal Sync (60 seconds) | 1, 15 | Team synchronisation |
| SWB04 | Increase Speed | 10 | |
| SWB05 | Increase Lookouts / Visual Confirm | 3 | |
| SWB07 | Start Investigation | 2, 5 | Can target different components; repeatable if different targets |
| SWB08 | Start In-Depth Investigation | 4,6,7,12,14 | Requires SWB07 on same component in prior turn |
| SWB09 | AIS Tracks Re-evaluation | 4 | |
| SWB10 | Isolate System | 11, 13 | Targets a specific system; player chooses which |
| SWB14 | Reboot Affected System | 7, 8 | Targets a specific system |
| SWB15 | Repair Component | 3 | |
| SWB16 | Reconnect System | 14 | |
| SWB18 | Damage Control Focus | 10 | |
| SWB19 | Correct Course | Tutorial only | |
| SWB20 | General Quarters | 6 | **Forced by Facilitator if not chosen** |
| SWB21 | Prepare Target | 8 | |
| SWB23 | Close Range to Compensate | 11, 12, 13 | |
| SWB24 | Approach Target | 11 | |
| SWB26 | Shift to Gun Focus | 10 | |
| SWB27 | Fire Missile Counterattack | 9 | |
| SWB28 | Engage Target with Guns | 10, 13 | |
| SWB29 | Decoy Deployment | 4, 9 | |
| SWB30 | Approach Land (Emergency Concealment) | 11 | |

### 5.2 Card Rules

- CO selects **up to 2 blue cards per turn**.
- If 2 cards are chosen, they must be **different** — except:
  - **SWB07** (Start Investigation) and **SWB08** (Start In-Depth Investigation) may be repeated in the same turn only if each targets a **different declared component**.
  - **SWB08** requires SWB07 to have been played on the same component in a previous turn (prerequisite chain).
- Cards that target a specific system (e.g., SWB10 "Isolate System", SWB14 "Reboot Affected System") can only be played on **one** system per selection.

### 5.3 Card Properties

Each blue card carries:
- **Score** (float, can be +/−/0) — context-dependent; the same card can score differently in different turns.
- **Stress delta** (integer, can be +/−/0) — applied to the team stress counter on selection.
- **System effects** — power or operational state changes to specific systems.
- **System targeting** — if true, the player must choose which system the card applies to from a picker.
- **Max plays** — limits how many times this card can be selected across the exercise (0 = unlimited). Once exhausted, excluded from timeout auto-selection.

### 5.4 Forced Cards

A decision can declare forced cards. If the CO does not select a forced card, the engine **automatically adds it** to the selection and emits a notification. This models facilitator overrides (e.g., "General Quarters is mandatory at Turn 6 regardless of player choice").

---

## 6. Core Domain Model

### 6.1 Entities

| Entity | Domain Term | Description |
|--------|-------------|-------------|
| **Scenario** | — | A reusable exercise template containing injects, defects, decisions, roles, systems, and warfare domains. Immutable during play. |
| **Exercise** | — | A running instance of a scenario. Holds phase, speed factor, game mode, participant list. |
| **Event** | Inject | A scheduled situational development delivered to players. May be informational, operational, or trigger a decision point. |
| **Issue** | Defect | A problem requiring mitigation or resolution. Activated by time, events, or manual trigger. |
| **Decision** | — | A question posed to participants with selectable blue cards, a timeout, and scoring metadata. The core interactive unit. |
| **Decision Option** | Blue Card | A selectable response action within a decision. |
| **System** | — | A ship subsystem with power state (ON/OFF) and operational state (Green/Yellow/Red). |
| **Warfare Domain** | — | A threat-level indicator (Green/Yellow/Red) representing an operational domain. |

### 6.2 Entity Relationships

```
Scenario ─────instantiated-as──────▶ Exercise (1:N)
Exercise ─────has─────────────────▶ Participants (1:N, via Waiting Room)
Exercise ─────runs────────────────▶ Engine (1:1, in-memory during play)
Engine ────────contains───────────▶ TimeManager, EventScheduler, IssueManager,
                                     DecisionManager, SystemManager,
                                     WarfareDomainManager, GameMode
```

### 6.3 Terminology Mapping

| Domain Term | Code Term |
|-------------|-----------|
| Inject | Event |
| Defect | Issue |
| Blue Card | Decision Option |
| Crew / Officer | Player / Participant |
| Facilitator | Game Master (GM) |

---

## 7. Exercise Lifecycle

### 7.1 Phases

An exercise progresses through five ordered phases:

```
SETUP → BRIEFING → RUNNING ↔ PAUSED → COMPLETED
```

| Phase | Description | Time advances? |
|-------|-------------|----------------|
| **Setup** | Exercise created, waiting for crew. | No |
| **Briefing** | Scenario context displayed (briefing text, objectives, rules, roles). Crew reads and prepares. | No |
| **Running** | Active play. Engine tick loop advances time, triggers injects, opens decisions. | Yes |
| **Paused** | Frozen. All timers halt. Can resume to Running. | No |
| **Completed** | Terminal. Exercise is over. Crew sees outcome overlay. | No |

Invalid transitions (e.g. Setup → Running directly) are rejected.

**Complete vs Stop:**
- **Complete** transitions the engine to COMPLETED and broadcasts a phase change, but keeps connections alive so participants see the completion overlay (tier message, return button).
- **Stop** completes the engine, then tears down everything — closes all connections, clears the waiting room, removes the engine from memory. Used for hard termination (e.g., practice mode "Stop Exercise" button).

### 7.2 Dual-Clock Time System

The engine maintains two clocks:
- **Real Time (RT):** Wall-clock milliseconds elapsed since exercise start.
- **Play Time (PT):** Simulated scenario time = RT × speed factor.

The speed factor (default 1.0) can be adjusted mid-exercise by the GM. A speed change broadcasts to all participants so clocks update in sync. All scheduled injects and timeouts operate on Play Time.

### 7.3 Tick Loop

The engine advances at 4 ticks per second. Each tick:
1. Advance Play Time.
2. Check inject triggers and auto-completions.
3. Apply inject effects (system degradation, domain threats, defect activation).
4. Check defect activations and auto-resolves.
5. Check decision timeouts.
6. If a decision opens and the game mode requires it, pause the engine.
7. Broadcast all state changes to connected participants.

---

## 8. Inject (Event) System

### 8.1 Lifecycle

```
SCHEDULED → PENDING → RUNNING → COMPLETED
                                  ↗ (or CANCELLED from any state)
```

- At the scheduled Play Time, injects transition from SCHEDULED → PENDING → RUNNING automatically.
- If a duration is set, the inject auto-completes after that duration.
- Injects can have **dependencies** — they only activate after all dependencies complete.
- A GM can force-trigger, cancel, pause, resume, delay, or skip injects.

### 8.2 Inject Types

| Type | Behaviour |
|------|-----------|
| **Informational** | Delivers briefing text to targeted roles. No further mechanical effect. |
| **Operational** | Delivers situation updates. May carry system effects and domain effects. |
| **Decision** | Opens a decision point when it starts. In classic mode, also pauses the engine. |

### 8.3 Role Targeting

Injects can target specific roles via a target list. Only officers in matching roles (plus the GM) receive the inject. Each inject can also carry **role-specific descriptions** — per-role inject text that replaces the generic description for that officer.

### 8.4 Effects

When an inject transitions to RUNNING, it can:
- **Degrade systems:** Change power state or operational state of one or more ship systems.
- **Change warfare domain threat levels.**
- **Activate defects:** Via triggered issues (evaluated on inject completion).

---

## 9. Defect (Issue) System

### 9.1 Lifecycle

```
INACTIVE → ACTIVE → MITIGATED → RESOLVED
```

### 9.2 Trigger Modes

| Mode | Behaviour |
|------|-----------|
| **Time-based** | Activates at a specified Play Time. |
| **Event-based** | Activates when a specified inject completes. |
| **Manual** | GM activates explicitly. |

### 9.3 Auto-Resolve

If auto-resolve is set (> 0), the defect automatically resolves after that duration in the ACTIVE state.

### 9.4 Visibility

Defects can be explicitly **released to players**, making them visible in the player UI.

---

## 10. Decision System

### 10.1 Opening & Closing

- A decision **opens** when its linked decision-type inject starts.
- A decision **closes** when:
  - The CO submits their selection, or
  - The timeout expires (auto-submits the worst option — lowest score), or
  - The GM manually closes it (classic mode).

### 10.2 Question Types

| Type | Behaviour |
|------|-----------|
| **Single choice** | One card. Auto-submits on selection (unless system targeting required). |
| **Multi choice** | Multiple cards selectable. Must manually confirm. Capped by max_selections if set. |
| **Free text** | Open text input. Must have content to submit. |
| **Scale** | Numeric scale selection. |

### 10.3 Completion Modes

| Mode | Behaviour |
|------|-----------|
| **First response** | First answer closes the decision. |
| **Unanimous** | All targeted participants must agree. |
| **Majority** | 50%+ agreement closes it. |

### 10.4 Recommendations

In collaborative mode, **advisors** submit non-binding recommendations before the CO rules. Recommendations are displayed as badges on the blue cards the CO sees, showing which advisor recommended what.

### 10.5 Decision Sequencing (Collaborative Mode)

The engine maintains a **decision sequence** — an ordered list of decision template IDs. After each decision closes:
1. The engine retrieves the next decision in the sequence.
2. Force-triggers the corresponding inject.
3. Opens the next decision.
4. When the sequence is exhausted, the exercise auto-completes.

There is no frontend-driven turn advancement — the engine owns the sequence.

---

## 11. Turn Structure

### 11.1 Turn Flow

```
Facilitator reads situation → Role-targeted injects delivered → Team discussion (timed) → CO selects 1–2 blue cards → Facilitator resolves effects → Board state updated → Next turn
```

### 11.2 Turn Phases (per turn)

1. **Inject phase** — Facilitator delivers role-targeted inject cards.
2. **Discussion phase** — Team discusses under time pressure (stress-adjusted timer).
3. **Decision phase** — CO commits 1–2 blue cards.
4. **Resolution phase** — Facilitator adjudicates effects, updates board.

### 11.3 Turn 0 — Pre-Sail Briefing

- **Purpose:** Mission context setting. Players extract information for a mission brief to the CO.
- **Duration:** 15 minutes.
- **Injects:** Role-targeted briefing cards (OPS, NAV, EO, CyOp).
- **Blue cards:** None.
- **Facilitator prompt:** "You are a crew of a Frigate. Prepare a mission briefing based on the information provided. Do not just read the text — extract only the information needed for a mission brief to your CO."
- **Initial board state:** Stress 0. All systems Green. NAV RADAR, IBMS/INS, NAV SENSORS, and COMMS are ON. All others OFF.

### 11.4 Turns 1–15 — Execution

Each turn has:
- Role-targeted injects (not all roles receive injects every turn).
- Available blue cards (varies per turn, defined in scenario).
- Expected/acceptable play paths with stress consequences.
- Board state after resolution.

### 11.5 Board State Progression (Best Path)

| Turn | Stress | System Changes | Key Events |
|------|--------|---------------|------------|
| 0 | 0 | All Green. NAV RADAR, IBMS/INS, COMMS ON. Others OFF. | Pre-sail briefing |
| 1 | 0 | No change | Steady transit |
| 2 | 0 | No change | Speed discrepancy, ghost AIS contact |
| 3 | 0 | Component repaired | Faulty component, increased traffic |
| 4 | 1 | One deceptive AIS track exposed | AIS spoofing confirmed |
| 5 | 2 | COMMS → Yellow | First cyber signal, SATCOM/HF degraded |
| 6 | 4 | All systems/weapons ON (General Quarters) | Hostile warship spotted, WECDIS→INS anomaly |
| 7 | 5 | AAW RADAR → Yellow | AAW radar flickering, reboot triggers silent escalation |
| 8 | 4 | — | Air threat ETA 15', AAW rebooting |
| 9 | 5 | — | Hostile salvo (3 missiles), missile counterattack fails (WECDIS) |
| 10 | 7 | CIWS FWD Disabled, Missile Launcher Disabled, 1 HF antenna disabled | First hit. Gun only remaining weapon. |
| 11 | 8 | IBMS/INS → Yellow (WECDIS disconnected) | Cyber root cause found, surface tracking unstable |
| 12 | 9 | — | AAW→ASUW tracking attack confirmed, dual threat convergence |
| 13 | 10 | AAW RADAR → Red (isolated), ASUW tracking restored | Hard trade-off: isolate AAW for surface tracking |
| 14 | 10 | AAW RADAR → Yellow (reconnected) | Surface threat neutralised, AAW reconnected |
| 15 | 10 | — | Friendly aircraft intercept air threat. End. |

### 11.6 Post-Game

- **Hot wash-up** (30 min): What happened? Key decisions? What worked / didn't? What could be done differently?
- **Team Lightning Report** (5 min): Situation assessment, key decision points, primary lesson learned. Focus on decision rationale, not retelling events.
- **Instructor's Debrief**: Key messages and closing remarks.

### 11.7 Tutorial Scenario (3 Turns)

Setting: Frigate approaching home port after routine patrol. Tide window closing.

- Purpose: Teach game mechanics in a low-stakes setting.
- Stress range: 0–2 (generous timers).
- No combat, no cyber attribution ambiguity.

| Turn | Title | Best Path | Stress |
|------|-------|-----------|--------|
| 1 | Steady Approach | SWB01 + SWB03 | +0 |
| 2 | Unexpected Current | SWB07 (NAV offset) | +1, COMMS → Yellow |
| 3 | Narrowing Window | SWB02 + SWB19 | −1 |

---

## 12. Stress Mechanic

### 12.1 Counter

- **Range:** 0–10 (integer, clamped)
- **Scope:** Per-exercise (shared across all crew)
- **Starting value:** 0

### 12.2 Stress Sources

Each blue card carries an independent stress_delta (can be +/−/0). The turn template can also carry a base stress_delta applied regardless of card choice.

**Total delta per turn** = turn-level stress delta + sum of selected card stress deltas.

After applying: `stress = max(0, min(10, stress + total_delta))`

**Example stress deltas (best path):**
- Turn 1: Best path (SWB01 + SWB03) → Stress +0
- Turn 4: Best path (SWB09 + SWB08) → Stress +1
- Turn 6: Best path (SWB08 + SWB20) → Stress +2
- Turn 8: Best path (SWB01 + SWB21) → Stress −1
- Turn 10: Best path (SWB18 + SWB04) → Stress +2

Stress can also be modified by:
- **Investigation outcomes** — e.g., investigating WECDIS in Turn 4 could yield Stress −1.
- **Failure to act** — e.g., not investigating radar in Turn 2 → latent Stress +1.

### 12.3 Stress → Decision Timer

Higher stress compresses the time available for the next decision:

| Stress | Decision Time |
|--------|---------------|
| 0 | 5:00 |
| 1 | 4:50 |
| 2 | 4:40 |
| 3 | 4:30 |
| 4 | 4:20 |
| 5 | 4:10 |
| 6 | 4:00 |
| 7 | 3:50 |
| 8 | 3:30 |
| 9 | 3:10 |
| 10 | 3:00 |

Note: The decay is non-linear — the gap widens at stress 8+ (from 10-second steps to 20-second steps).

### 12.4 Stress Progression (Main Scenario, Best Path)

Turn 0: 0 → Turn 1: 0 → Turn 2: 0 → Turn 3: 0 → Turn 4: 1 → Turn 5: 2 → Turn 6: 4 → Turn 7: 5 → Turn 8: 4 → Turn 9: 5 → Turn 10: 7 → Turn 11: 8 → Turn 12: 9 → Turn 13: 10 → Turn 14: 10 → Turn 15: 10

### 12.5 Stress Visual Effects

Stress produces environmental screen effects with escalating intensity:
- **Vignette darkening** — edges of the screen darken as stress increases.
- **Screen shake** — amplitude scales with stress level.
- **Heartbeat pulse** — BPM accelerates with stress.

Intensity is configurable per scenario via a preset: off / mild / standard / intense. Severity activates above stress 7 and interpolates linearly to maximum at stress 10.

---

## 13. Scoring & Outcomes

### 13.1 Score Model

- Each blue card has a **score** (float, +/−/0).
- Score is context-dependent — the same card can score differently in different turns.
- **Total score** = sum of all selected card scores across all decisions.
- **Max possible score** = scenario-defined ceiling.
- **Score ratio** = total score / max possible score.

### 13.2 Score Tiers

End-of-exercise outcome is expressed as a tier, not a number:

| Tier | Condition (defaults) | Example Message |
|------|---------------------|-----------------|
| **Lo** | Ratio < 0.33 | "Solid Effort" |
| **Mid** | 0.33 ≤ ratio < 0.66 | "Great Performance" |
| **Hi** | Ratio ≥ 0.66 | "Outstanding" |

Thresholds are configurable per scenario.

### 13.3 Score Visibility Rules

- **During play:** Score is **never shown** to players. No numbers, no progress bars.
- **End of exercise:** Only the tier label and an encouraging message are displayed. All messaging is positive — no negative wording regardless of tier. "No competitive scoring."
- **Stress is visible** during play (numeric counter + visual bar), but stress is independent from score.

### 13.4 Classic Mode

Classic mode has **no scoring and no stress tracking**. The facilitator evaluates performance qualitatively.

---

## 14. Game Modes

### 14.1 Classic Mode

| Property | Value |
|----------|-------|
| GM required | Yes |
| Pauses on decision | Yes |
| Scoring | None |
| Decision sequencing | Manual (GM triggers injects) |
| Stress tracking | None |
| Timeout behaviour | No auto-submit |

The facilitator drives the entire exercise flow — triggering injects, pausing for discussion, closing decisions, and advancing the timeline.

### 14.2 Simple Collaborative Mode

| Property | Value |
|----------|-------|
| GM required | No |
| Pauses on decision | No (engine continues) |
| Scoring | Per-card scoring with tier outcome |
| Decision sequencing | Automatic (engine-driven sequence) |
| Stress tracking | Yes (0–10, affects timer) |
| Timeout behaviour | Auto-submits worst option (lowest score) |
| Forced cards | Yes (auto-included with notification if omitted) |
| Practice variant | Single-player, 1.5× decision timer |

---

## 15. Exercise Discovery & Lobby

### 15.1 Joinable Exercises

An exercise is **joinable** when all of the following are true:
- Phase is **Setup** (not yet started).
- It has a linked scenario with valid content (including at least one decision-maker role).
- The waiting room has **available slots** (participant count < max players).
- It is **not** in practice mode.

The home screen displays a live count of joinable exercises. A dedicated **lobby channel** pushes notifications whenever the set of joinable exercises changes (exercise created, participant joins/leaves, exercise starts). This lets the home page update the badge in real time without polling.

Exercises with invalid scenario content are silently skipped from the joinable list.

### 15.2 Joining

- Players discover exercises by **browsing** the joinable list or by entering a **session code** (unique 6-character alphanumeric string, auto-generated on exercise creation). The by-code lookup returns the exercise regardless of joinable status, allowing direct navigation.
- Players enter a **callsign** (display name) and are presented with available role slots.
- Role assignment is **first-come-first-served** — each role can be claimed by one participant.
- Participants can swap roles before the exercise starts.

### 15.3 Readiness & Deployment

The exercise can be deployed (started) when readiness conditions are met:

| Mode | Condition |
|------|-----------|
| **Full team** | All 7 role slots filled (+ GM if classic mode) |
| **Two-player** | Exactly 2 participants with different roles (one CO, one Crew) |
| **Practice** | Exactly 1 participant |

Readiness updates in real time — all connected participants see joins, leaves, and role changes immediately.

### 15.4 Max Players

| Configuration | Max |
|---------------|-----|
| Classic (requires GM) | 8 (7 roles + 1 GM) |
| Collaborative (no GM) | 7 |
| Two-player | 2 |
| Practice | 1 |

---

## 16. Player Count Modes

### 16.1 Full Team

Standard mode — one participant per role. CO + 6 advisors.

### 16.2 Two-Player

Simplified two-seat variant:
- One player takes the **CO** (decision-maker) role.
- One player takes the **Crew** (all advisors combined) role.
- Auto-assignment: first player gets one role, second player gets the other.
- Players can swap roles in the waiting room.

### 16.3 Practice (Solo)

Single-player variant for scenario walkthrough:
- One player fills **all** roles simultaneously.
- Can see all advisor cards and the CO decision bar.
- Can submit as any advisor and as the CO.
- Decision timer is multiplied by 1.5× for reduced pressure.
- Exercise is not listed in the joinable exercises list.
- A "Stop Exercise" button is available in the footer.
- Only available in collaborative mode.

---

## 17. Real-Time Communication

### 17.1 Connection Model

Each participant establishes a persistent bidirectional connection to the exercise. Connections are grouped by exercise and by role (GM or player).

### 17.2 Two Connection Types

**Lobby connection** — used by the home page. Receives lobby_update notifications whenever the set of joinable exercises changes. No exercise-specific state. Enables the live "active operations" badge.

**Exercise connection** — used by player and GM views. Carries exercise ID, role, and participant ID. Receives full state sync and ongoing deltas.

### 17.3 Message Flow

**Server → Client (Exercise connection):**

| Message | When | Content |
|---------|------|---------|
| **Snapshot** | On connect / reconnect | Full exercise state (phase, time, all injects, decisions, systems, domains, score) |
| **State changes** | On each engine tick or action | Array of individual deltas (phase, inject, defect, decision, score, system, domain, presence changes) |
| **Waiting room update** | On join/leave/role change in lobby | Updated participant list |
| **Exercise stopped** | On hard stop | Signals clients to disconnect and navigate home |

**Server → Client (Lobby connection):**

| Message | When | Content |
|---------|------|---------|
| **Lobby update** | On exercise create, waiting room join/leave, exercise start | Signal to re-fetch joinable list |

**Client → Server:**

| Message | When | Purpose |
|---------|------|---------|
| **Ping** | Every 15 seconds | Keep-alive heartbeat |

All commands (start, pause, submit decision, etc.) go through separate request-response channels. The persistent connection is read-heavy — it broadcasts state, it does not accept commands.

### 17.4 Role-Targeted Broadcasting

Some state changes (decision opened, inject change) carry a target_roles list. These are broadcast only to:
- Participants in matching roles.
- The GM (always receives everything).
- Generic "player" connections (for observers).

All other state changes broadcast to every connected client.

### 17.5 Reconnection

On disconnection, the client reconnects with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5+ | 16s (cap) |

On reconnection, the server sends a fresh snapshot so the client re-syncs any missed state. The attempt counter resets on successful reconnection.

---

## 18. Views & User Flows

### 18.1 Home

Landing page with navigation to:
- **Run Exercise** — select a scenario, choose game mode, create exercise, enter waiting room.
- **Join Exercise** — browse active exercises or enter a session code.
- **Build Scenario** — author/edit scenario content.
- **Review Results** — post-exercise timeline replay.
- **Game Master** — facilitator control panel (hidden link).

A badge indicates how many exercises are currently waiting for players.

### 18.2 Waiting Room

Three sub-states:
1. **Browse** — sidebar lists all joinable exercises. Click to select.
2. **Join** — enter callsign, see role slot grid, claim a role.
3. **Ready** — readiness gauge fills as slots are claimed. Deploy button enables when conditions are met.

Role slots display the role abbreviation (CO, OPS, NAV, etc.), label, player type badge (CMD/ADV/ALL), and status (Open / Claimed / "You").

### 18.3 Player View

The main gameplay screen, divided into:

**Header:**
- Exercise title
- Stress bar (numeric 0–10 + filled bar with severity colouring)
- Clock: countdown timer if a decision is open, otherwise real-time clock
- Phase badge (SETUP / RUNNING / BRIEFING / COMPLETED)

**Main Board:**
- **Turn banner** — current turn number and inject title, or "Waiting for next turn…"
- **Warfare domain board** — chips for ASUW, ASW, AAW, CYBER with threat-level traffic lights
- **System status board** — chips per system with power indicator and operational traffic lights (3 for systems, 2 for weapons)
- **Role cards** — one per relevant role, showing:
  - Role abbreviation + status badge (INTEL / DECISION / DONE)
  - Role label (e.g., "Operations Officer")
  - Intel section (role-specific inject text, hidden if none for this turn)
  - Decision form (if active): radio buttons (single choice), checkboxes (multi choice), text area (free text), system picker (if needed)
  - Done state: locked-in selection displayed

**CO Decision Bar (CO only):**
- All blue card options as clickable tiles
- Advisor recommendation badges on each card (showing which officers recommend it)
- System picker dropdown (if card targets a system)
- Confirm button (enabled when at least one card selected)

**Overlays:**
- **Briefing overlay** — shown during briefing phase with scenario title, briefing text, objectives, and roles.
- **Completion overlay** — shown when exercise completes with tier message and a return-to-home button.
- **Stress overlay** — full-screen environmental effect that intensifies with stress.

**Footer:**
- Game mode indicator
- Logs button (opens decision history drawer)
- Stop Exercise button (practice mode only)

### 18.4 Decision Log Drawer

Slides in from the right. Shows per-turn decision history:
- Turn number
- Decision title
- Per-role recommendations (officer → selected card)
- Final CO decision
- Open decisions show "Awaiting decision…"

### 18.5 Game Master View

Facilitator control panel for classic mode:
- Scenario picker and exercise list browser
- Inject timeline with manual trigger controls
- System and warfare domain boards (read-only)
- Presence indicator (who is connected, who is not)
- Speed control, pause/resume, phase controls
- Context panel with scenario briefing and rules

### 18.6 Review View

Post-exercise timeline replay:
- Play/pause/step controls
- Speed adjustment (0.5×, 1×, 2×, 5×)
- Three-column layout: Timeline, Inject Summary, Decision Analysis
- Shows all decisions with advisor recommendations and final selections

### 18.7 Scenario Builder

Scenario authoring environment with tabs:
- Setup (title, briefing, objectives, rules)
- Roles
- Injects (with scheduling, targeting, effects)
- Decisions (with blue cards, scoring, constraints)
- Initial States (systems, warfare domains)
- Defects
- Turns (turn-based authoring mode)

---

## 19. Presence Tracking

The system tracks which participants are currently connected to an exercise. Presence updates are broadcast whenever a participant connects or disconnects.

- **GM view:** Shows a list of all participants with connected/disconnected indicator (green/red dot), role badge, and officer name.
- **Cleanup:** Connections that fail (network drop, browser close) are automatically removed and trigger a presence update.

---

## 20. Audit Trail

All engine state changes are logged to an immutable audit trail:
- Exercise ID
- Entry type (engine / decision / inject / defect)
- Action (started / paused / decision_opened / inject_triggered / etc.)
- Actor ID and name
- Target type and ID
- Play Time and Real Time timestamps
- Additional details

Audit logging is **non-fatal** — write failures produce warnings but never interrupt the engine tick loop.

---

## 21. Scenario Validation Rules

When a scenario is saved or loaded, the following constraints are enforced:

1. At least one role must be defined.
2. At least one role must be a decision-maker (CO).
3. Collaborative scenarios must define at least 2 roles.
4. All target_roles references in injects and decisions must reference valid role IDs.
5. All role-specific description keys must reference valid role IDs.
6. Decision sequence entries must reference valid decision template IDs.
7. A scenario must have a title and at least one inject.
8. Decision templates must have valid defect ID references.

---

## 22. Scenario Seeding

Pre-built scenarios are seeded on application startup. Scenarios are **upserted by title** — existing scenarios with matching titles are updated with the current seed content, preserving the ID. This ensures seed data stays current across deployments while retaining exercise references.

Seed scenarios are validated against the full content schema at build time. Invalid seeds fail the build.

**Shipped scenarios:**
- **Silent Wake** (15 turns) — full cyber-kinetic exercise: transit → cyber detection → escalation → combat → recovery.
- **Silent Wake Tutorial** (3 turns) — low-stakes port approach teaching the turn cycle.

---

## 23. Severity Levels

Injects carry severity levels that communicate urgency:

| Level | Colour | Order |
|-------|--------|-------|
| **Routine** | Green | 1 |
| **Priority** | Orange | 2 |
| **Immediate** | Red | 3 |
| **Flash** | Dark Red | 4 |

---

## 24. Design Invariants

These define what "correct" means for TFC. Every change must preserve them:

1. **Path-independence.** Same business event, same outcome regardless of entry path. Player submit, timeout, scheduled tick, force-trigger, and GM trigger must all converge on the same truth.
2. **Atomic consequences.** If a card affects score, forced-card state, systems, and completion flow, those effects must all happen together — never partially applied.
3. **Engine is canonical.** The engine is the single source of runtime truth. Transport and presentation layers must not create alternate simulation semantics.
4. **Scenario stability.** Schema or default changes are only quality improvements if they preserve authored intent. Seed scenarios must produce identical exercise behaviour before and after any change.

---

## 25. Backlog (Identified, Not Yet Implemented)

### 25.1 Shaped (Ready to Build)

**Blue card prerequisite chains:**
SWB08 requires SWB07 on the same component in a prior turn. Cross-turn card history with validation on decision close.

**Blue card uniqueness constraint:**
If 2 cards chosen per turn, they must be different (with the investigation exception).

**Manual GM stress override:**
In classic mode, the facilitator can set stress directly.

### 25.2 Raw (Ideas)

- **Turn phases as explicit concept** — 4-phase cycle (Resolve/Comment → Inject → Discuss → Decide+Justify).
- **Turn 0 as explicit briefing phase** — linked to Turn 0 inject delivery.
- **Post-game phases** — Hot wash-up, Team Lightning Report, Instructor's Debrief.
- **Turn-dependent card availability** — cards only available on certain turns (per scenario).
- **Cascading system effects** — automated system-to-system propagation.
- **Cyber propagation paths** — engine-evaluated attack chains.
- **Latent/conditional stress** — triggered by what was NOT played.
- **Structured advisor protocol** — 15-second structured prompts per option.

---

## Appendix A: Abbreviations

| Abbr | Full Name |
|------|-----------|
| AIS | Automatic Identification System |
| AAW | Anti-Air Warfare |
| ASUW | Anti-Surface Warfare |
| ASW | Anti-Submarine Warfare |
| CIWS | Close-In Weapon System |
| C2 | Command & Control |
| ECDIS / WECDIS | (Warship) Electronic Chart Display and Information System |
| EMCON | Emissions Control |
| ESM | Electronic Support Measures |
| ETBOL | Estimated Time Back On-Line |
| ETA | Estimated Time of Arrival |
| HF | High Frequency (radio) |
| IBMS | Integrated Bridge Management System |
| INS | Inertial Navigation System |
| MTC | Maritime Tactical Center |
| ROE | Rules of Engagement |
| SATCOM | Satellite Communications |
| SITREP | Situational Report |
| SOG | Speed Over Ground |
| STW | Speed Through Water |
| UHF | Ultra High Frequency (radio) |
