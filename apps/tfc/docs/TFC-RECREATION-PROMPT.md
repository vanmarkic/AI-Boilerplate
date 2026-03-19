# TFC (Training Flow Control) — Full Recreation Prompt

You are building **TFC**, a domain-agnostic digital platform for running facilitator-controlled, turn-based tabletop exercises. The first (and reference) scenario is **Silent Wake**, a multi-domain naval cyber wargame. This prompt contains everything needed to rebuild the entire system from scratch.

---

## Part 1: The Game Design (Primary Source of Truth)

### 1.1 What Silent Wake Is

Silent Wake is a **multi-domain table-top naval exercise** created by Naval Group Belgium for Hellenic Naval Academy cadets. It is **NOT** a cyber exercise only — not all events are cyber-related. Players who jump to "this is a cyber attack" too early are penalized. The core objective is:

> **Learn to fight effectively while under cyber influence.**

Exercise focus areas:
- Decision rationale (why did you choose this?)
- Communication under pressure (structured, short, decision-oriented)
- Trade-offs (every action has a cost; articulate what you gain and what you lose)

Key framing principle: "Cyber incident = Mission degradation (not just IT downtime)."

Why this format (facilitator-controlled, turn-based, with injects):
- Optimized for **command decision-making**, not technical "cyber play"
- Enables disciplined decisions under uncertainty and time pressure
- Controlled escalation aligned to learning objectives
- Consistent, comparable learning across teams (**no competitive scoring** between teams)
- Supports active participation, not passive listening

### 1.2 Participants

**Facilitator** = WHITE TEAM / RED TEAM (plays the adversary + environment)
**Players** = BLUE TEAM (ship crew)

Security/sensitivity: Fictional scenario, unclassified, no real vulnerabilities/system details, no real-world adversary modelling.

### 1.3 Player Roles (6 roles + facilitator)

Hierarchy:
```
                    CO
                  / | \
               OPS NAV  EO
                |
               PWO
              /   \
           AAWO   CyOp
```

| Role | Full Title | Mission | Player Type |
|------|-----------|---------|-------------|
| **CO** | Commanding Officer | Deliver mission effectiveness under degraded conditions. Make timely, proportionate decisions. | **Decision-maker** |
| **OPS** | Operations Officer | Maintain operational tempo and coordination | Advisor |
| **PWO** | Principal Warfare Officer | Manage warfare domains and weapon systems | Advisor |
| **AAWO** | Anti-Air Warfare Officer | Preserve air defense viability, manage air picture under sensor degradation | Advisor |
| **CyOp** | Cyber Operator | Interpret cyber signals as operational risk, propose proportionate mitigation | Advisor |
| **NAV** | Navigator | Navigation systems, route, speed, maneuvering | Advisor |
| **EO** | Engineering Officer | Systems health, repair timelines (ETBOL), technical status | Advisor |

**CO responsibilities:**
- Makes the final call: chooses **1 or 2 Blue action cards** per turn after hearing recommendations
- Normal rule: if choosing 2 actions, they must be different. Exception: SWB07 and SWB08 may be repeated in the same turn only if each targets a different declared component. SWB08 requires SWB07 to have been played on the same component in a previous turn.
- Must ask structured questions for each recommendation: "Recommendation?" (what to do), "Expected effect?" (what improves), "Tradeoff?" (what you lose), "Time?" (ETBOL / how many turns)
- The best CO is not the one who avoids mistakes, but the one who makes timely, proportionate decisions under uncertainty and keeps the team aligned.

**CyOp responsibilities:**
- Differentiate likely cyber compromise vs noise/failure; communicate confidence level
- Identify propagation paths between systems (IBMS / INS incl. WECDIS -> ASUW TRACKING RADAR, NAV SENSORS -> picture -> engagement)
- Propose mitigations with clear tradeoffs: isolate, disconnect, switch to degraded mode, restore/rollback
- No SOC. No external patch or CTI fix. Must work with onboard options only.
- "Your goal is not to win cyber. Your goal is to keep the ship effective while uncertainty remains."

**AAWO responsibilities:**
- Track air threat timelines and required sensor posture (AAW RADAR state is critical)
- Coordinate with EO on what is physically plausible and with OPS on threat prioritization
- Cannot demand perfect air picture; must operate under uncertainty and time pressure

### 1.4 Game Board

The game board tracks the state of all ship systems across three sections:

#### Systems (left column)
Each system has: **ON/OFF toggle** + **Operational State** (Green/Yellow/Red traffic light)

| System | Description |
|--------|------------|
| NAV RADAR | Navigation radar |
| IBMS / INS (incl. WECDIS) | Integrated Bridge Management System / Inertial Navigation System including Warship ECDIS |
| NAV SENSORS | Navigation sensors |
| ASUW TRACKING RADAR | Anti-Surface Warfare tracking radar |
| COMMS | Communications (SATCOM, HF, UHF, VHF) |
| AAW RADAR | Anti-Air Warfare radar (air surveillance) |

#### Warfare Domains (top right)
Each domain has a **traffic light** (Green/Yellow/Red) representing threat level:
- Green = No threat
- Yellow = Possible threat
- Red = Actual threat

| Domain |
|--------|
| ASUW (Anti-Surface Warfare) |
| ASW (Anti-Submarine Warfare) |
| AAW (Anti-Air Warfare) |
| CYBER |

#### Weapons (left column, below systems)
Each weapon has: **ON/OFF toggle** + **Status** (OK / Degraded / Disabled)

| Weapon |
|--------|
| CIWS FWD (Close-In Weapon System Forward) |
| CIWS AFT |
| MISSILE LAUNCHER (S-TO-S) |
| GUN |
| DECOYS |

#### Other Board Elements
- **Stress gauge**: 0-10 scale, updated by facilitator only
- **Notes area**: free-form text
- **Quick Reference**: "Actions: up to 2/turn; normally different. SWB08 requires prior SWB07. SWB14/SWB15: declare target component when played."
- **Turn counter**

### 1.5 Turn Phases (4-phase cycle)

Each turn follows this exact sequence:

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  01 Resolve / Comment   │ ──▶ │  02 Inject              │
│  Facilitator (≤ 30s)    │     │  Facilitator (30s)      │
└─────────────────────────┘     └─────────────────────────┘
           ▲                               │
           │                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│  04 Decide + Justify    │ ◀── │  03 Discuss             │
│  CO (1 min)             │     │  Blue Team (by Stress)  │
└─────────────────────────┘     └─────────────────────────┘
```

**Phase 01 — Resolve / Comment** (Facilitator, ≤30 seconds):
- Facilitator announces results of previous turn's actions
- Updates board state (systems, warfare domains, weapons, stress)
- Provides any facilitator narration

**Phase 02 — Inject** (Facilitator, 30 seconds):
- Facilitator distributes inject cards to specific roles
- Each inject is role-targeted: only the specified role(s) receive the information
- Players read their injects silently

**Phase 03 — Discuss** (Blue Team, timer set by Stress level):
- All advisors share their inject information with the team
- Team discusses situation, proposes options
- Each advisor should give structured recommendation: what to do, expected effect, tradeoff, time

**Phase 04 — Decide + Justify** (CO, 1 minute):
- CO selects 1 or 2 Blue action cards
- CO must verbally justify the choice
- CO announces the decision to the facilitator

### 1.6 Stress Mechanic

Stress is a 0-10 integer scale that controls the **discussion timer** (Phase 03). It is updated by the **facilitator only** — players cannot change their own stress.

| Stress | Discussion Time |
|--------|----------------|
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

Higher stress = less discussion time = more pressure = forces faster, less deliberate decisions. This is the core pedagogical mechanic.

### 1.7 Card Types

#### Briefing Cards
- Distributed during Turn 0 (pre-mission briefing)
- Contain mission context, intelligence, technical status
- Role-targeted (each role gets different briefing information)
- Structure: Title, Details (role-specific content), Role indicator, Turn indicator

#### Inject Cards
- Distributed by facilitator during Phase 02 of each turn
- Role-targeted: only the named role receives the card
- Contain new information, events, or status changes
- Structure: Title, Details, Role indicator, Turn indicator

#### Blue Action Cards (SWB01-SWB32)
- The CO's response options — 1 or 2 selected per turn
- Each card has: Title, Description (what it does), Card Reference Number (SWBxx), Role ownership, System/Domain tags
- Cards have **turn availability constraints** — not all cards are available every turn
- Some cards have **prerequisites** (SWB08 requires prior SWB07 on the same component)
- Some cards require **declaring a target** when played (SWB14, SWB15)

### 1.8 Complete Blue Card Catalog (from Baseline Scenario)

| Card | Title | Available Turns | Notes |
|------|-------|----------------|-------|
| SWB01 | Continue Mission | 1,2,3,5,6,7,8,9,12,14,15 | COMMON / NAV. Maintain tempo. |
| SWB02 | Reduce Speed / Safer Nav | 3 (tutorial) | COMMON. Safety over speed. |
| SWB03 | Internal Sync (60 seconds) | 1, 15 | COMMON / STRESS. Stress -2, align team. |
| SWB04 | Increase Speed | 10 | Maneuver initiative. |
| SWB05 | Increase Lookouts / Visual Confirm | 3 | Visual verification. |
| SWB07 | Start Investigation | 2, 5 | First-level investigation. Can target different components. |
| SWB08 | Start In-Depth Investigation | 4, 6, 7, 12, 14 | Requires prior SWB07 on same component. |
| SWB09 | AIS Tracks Re-evaluation | 4 | Expose deceptive AIS tracks. |
| SWB10 | Isolate System | 11, 13 | Disconnect compromised system. |
| SWB14 | Reboot Affected System | 7, 8 | Must declare target component. |
| SWB15 | Repair Component | 3 | Must declare target component. |
| SWB16 | Reconnect System | 14 | Bring isolated system back online. |
| SWB18 | Damage Control Focus | 10 | Prioritize damage control (CIWS). |
| SWB19 | Correct Course | 3 (tutorial) | Navigation correction. |
| SWB20 | General Quarters | 6 | All systems ON, all weapons ON. **Forced by facilitator on Turn 6 if team doesn't include it.** |
| SWB21 | Prepare Target | 8 | Engagement preparation. |
| SWB23 | Close Range to Compensate | 11, 12, 13 | Compensate for degraded tracking. |
| SWB24 | Approach Target | 11 | Close with target. |
| SWB26 | Shift to Gun Focus | 10 | Switch from missiles to gun. |
| SWB27 | Fire Missile Counterattack | 9 | Missile engagement. |
| SWB28 | Engage Target with Guns | 10, 13 | Gun engagement. |
| SWB29 | Decoy Deployment | 4, 9 | AAWO / WPN+AAW. Survivability. |
| SWB30 | Approach Land (Emergency Concealment) | 11 | Emergency coastal concealment. |

### 1.9 Facilitator Overrides

On Turn 6, **SWB20 (General Quarters) is mandatory**. If the team does not include it in their chosen actions, the facilitator cancels their selection, forces SWB20, and explains why — "no warship commander would leave the crew at peacetime posture after credible hostile identification." This is the **only turn** where the facilitator overrides CO authority.

---

## Part 2: The Baseline Scenario (15 Turns)

### 2.1 Scenario Outline

Silent Wake structures a progressive escalation from ambiguous transit anomalies to constrained combat recovery:

- **Turns 1-3**: Calm transit, subtle anomalies (speed discrepancy, AIS ghost, faulty component)
- **Turns 4-5**: AIS spoofing confirmed, first cyber signals, comms degradation
- **Turn 6**: Hostile ship spotted, General Quarters forced, first credible threat
- **Turns 7-8**: AAW radar malfunction, air threat warning, escalation
- **Turn 9**: Hostile salvo (3 incoming missiles), combat begins
- **Turn 10**: First blood — missile intercept, weapon damage, capability loss
- **Turns 11-12**: Cyber root cause confirmed, system isolation decisions, dual threats
- **Turn 13**: Hard choices — radar isolation vs restore under 8-minute air pressure
- **Turn 14**: Surface threat neutralized, AAW recovery
- **Turn 15**: Happy ending — friendly aircraft intercept air threat

### 2.2 Initial Conditions (Start of Turn 1)

- Stress: 0
- Systems ON: NAV RADAR, IBMS / INS (incl. WECDIS), COMMS
- Systems OFF: NAV SENSORS, ASUW TRACKING RADAR, AAW RADAR
- All systems: Green (no degradation)
- All weapons: OK status, OFF
- Warfare domains: all Green

### 2.3 Turn-by-Turn Detail

**Turn 0 — Pre-Sail Briefing** (15 minutes)
- Facilitator: "You are crew of a Frigate. Prepare a mission briefing from the information provided."
- Injects by role:
  - OPS: Mission (independent transit to patrol sector Alpha-3), NLT 112000B arrival, 6hr transit, heightened readiness, weapons tight (engagement only on confirmed hostile intent/act), no escort, no air support, organic helicopter joins on arrival
  - NAV: Navigation nominal, WECDIS updated, 15 kts planned speed, sea state 2-3, visibility ~12 nm, weather clear
  - EO: All systems nominal. Air surveillance radar: minor corrective maintenance last week, intermittent flickering under clutter, module serviced + recalibrated, if flicker reappears restart affected component (reboot ETBOL <1 min). Surface tracking radar + fire control tested. Comms: SATCOM 512 kbps, HF/UHF functional, UHF 5 occasional noise (known issue, replacement part pending helicopter delivery, repair ETBOL ~1hr)
  - CyOp: Cyber threat elevated. Adversary capable of disruption, data manipulation, temporary system degradation. No specific threat indicators. MTC cyber incident last week (admin networks affected, operational unaffected, investigation ongoing). Shipboard networks stable, no anomalies.
- Board after: Stress 0, all Green, only NAV RADAR, IBMS/INS, COMMS are ON.

**Turn 1 — In Transit**
- Facilitator: "You are underway. Transit phase has begun."
- Injects: OPS (transit proceeding, no updates), NAV (course/speed steady 15kts, no deviation), EO (radar nominal, no anomalies), CyOp (baseline unchanged, routine monitoring), AAWO (air picture normal), PWO (surface picture normal)
- Best play: SWB01 + SWB03 (Continue Mission + Internal Sync) — Stress +0
- Board after: Stress 0, all Green

**Turn 2 — Subtle Anomalies**
- Injects: NAV (minor speed discrepancy GPS SOG vs STW; 1 AIS contact bearing 035, range 18nm, no radar echo), PWO (no ESM emissions from bearing 035)
- Best: SWB01 + SWB07 (Continue Mission + Start Investigation on radar/AIS) — Stress +0
- Acceptable: SWB07 + SWB07 (double investigation on AIS + doppler speed log) — Stress +0
- Note: If radar diagnostic NOT initiated at least once → Stress +1 (latent sensor doubt)
- Board after: Stress 0, all Green

**Turn 3 — Faulty Component + Increased Traffic**
- Injects: EO (possible faulty component, restart 5' ETBOL), NAV (AIS contacts increasing, traffic density above baseline)
- Best: SWB05 + SWB15 (Increase Lookouts + Repair Component) — Stress +0
- Acceptable: SWB01 + SWB15 — Stress +1
- Board after: Stress 0, all Green, component repaired

**Turn 4 — AIS Spoofing Possible**
- Facilitator: "Component is repaired"
- Injects: NAV (new AIS contact bearing 041 at 11nm, no vessel visible), EO (component back online)
- Best: SWB09 + SWB08 (AIS tracks re-evaluation + Start In-Depth Investigation) — Stress +1, one deceptive track exposed
- Note: First confirmed deceptive AIS track. Trust in AIS picture begins to degrade.
- Board after: Stress 1, all Green, one deceptive AIS track exposed

**Turn 5 — Cyber Alert & Comms Degradation**
- Injects: CyOp (anomaly detected in IBMS), EO (SATCOM reduced bandwidth, HF degraded, communication with MTC not possible with UHF)
- Best: SWB07 + SWB07 (Start Investigation COMMS + Start Investigation IBMS) — Stress +1
- Note: First explicit cyber signal. Still ambiguous. COMMS should move to Yellow, CYBER should move to Yellow.
- Board after: Stress 2, COMMS Yellow, all others Green

**Turn 6 — Initial Cyber Analysis & Hostile Ship Spotted**
- Injects: CyOp (anomalous data flow from WECDIS toward INS, effects undetermined), NAV (new AIS contact bearing 052, 12nm, visual silhouette = warship), PWO (non-commercial radar emissions bearing 052)
- Best: SWB08 + SWB20 (In-Depth Investigation IBMS + General Quarters) — Stress +2
- **CRITICAL: SWB20 is mandatory. If omitted, facilitator forces it.**
- Board after: Stress 4, COMMS Yellow, all others Green. All systems and weapons ON (General Quarters).

**Turn 7 — AAW Radar Malfunction**
- Injects: AAWO (air surveillance radar online, multiple tracks flickering like last time)
- Best: SWB01 + SWB14 (Continue Mission + Reboot Affected System) — Stress +1
- Note: Reboot triggers silent privilege escalation in AAW radar component. No visible immediate consequence. AAW status → Yellow.
- Board after: Stress 5, COMMS Yellow, AAW RADAR Yellow

**Turn 8 — Air Threat Warning**
- Injects: AAWO (hostile aircrafts approaching, ETA 15'), EO (reboot could fix AAW if not done last turn)
- Best: SWB01 + SWB21 (Continue Mission + Prepare Target) — Stress -1
- Note: AAW radar is not operational yet (rebooting). White injects must be distributed in correct order.
- Board after: Stress 4, COMMS Yellow, AAW RADAR Yellow

**Turn 9 — Hostile Salvo**
- Injects: NAV (3 incoming missiles visually detected), EO (AAW radar back online), PWO (target out of gun range)
- Best: SWB29 + SWB27 (Decoy Deployment + Fire Missile Counterattack) — Stress +1
- Note: WECDIS attack is not resolved — drives missile counterattack failure. Out of gun range → forced to use missiles.
- Board after: Stress 5, COMMS Yellow, AAW RADAR Yellow

**Turn 10 — First Blood**
- Facilitator: "Defensive engagement complete. 1 missile intercepted by CIWS. Other 2 detonated in close proximity."
- Injects: EO (FWD CIWS non-operational ETBOL 2hrs, missiles launcher non-operational ETBOL 5hrs, 1 HF antenna disabled permanently), PWO (target now in gun range), NAV (counterattack missiles missed, no evidence of hostile evasion)
- Best: SWB18 + SWB04 (Damage Control Focus + Increase Speed) — Stress +2
- Board after: Stress 7, COMMS Yellow, AAW RADAR Yellow, CIWS FWD Disabled, Missile Launcher Disabled

**Turn 11 — Cyber Analysis & Surface Tracking Malfunction**
- Injects: CyOp (cyber-attack vector confirmed: feeding wrong speed to all systems via INS. Option 1: disconnect WECDIS + restart INS ETBOL 1' – WECDIS unavailable. Option 2: restore WECDIS + restart INS ETBOL 30' – WECDIS available), PWO (target in gun range but tracking radar can't lock, manual targeting reduces range)
- Best: SWB10 + SWB23 (Isolate System + Close Range to Compensate) — Stress +1
- Board after: Stress 8, COMMS Yellow, AAW RADAR Yellow, IBMS/INS Yellow (WECDIS disconnected), ASUW TRACKING restored, CIWS FWD Disabled, Missile Launcher Disabled

**Turn 12 — New Cyber Alert**
- Injects: CyOp (malicious activity confirmed from AAW radar processing module toward surface tracking radar), AAWO (hostile aircrafts ETA 10'), PWO (target still out of effective gun range with manual tracking, 10' to be in range), EO (INS functioning correctly, speed verified)
- Best: SWB08 + SWB01 (Start In-Depth Investigation on AAW radar + Continue Mission) — Stress +1
- Board after: Stress 9, COMMS Yellow, AAW RADAR Yellow, IBMS/INS Yellow, CIWS FWD Disabled, Missile Launcher Disabled

**Turn 13 — Hard Choices**
- Injects: CyOp (AAW attack resolution: Option 1 = Restore from backup ETBOL 30' full recovery. Option 2 = Isolate AAW radar ETBOL <1' – AAW unavailable but surface tracking restored immediately), AAWO (hostile aircrafts ETA 8')
- Best: SWB10 + SWB28 (Isolate System Radar + Engage Target with Guns) — Stress +1
- Note: Isolation immediately restores surface tracking. Surface threat must be neutralized before incoming air threat. Pedagogical focus: accept temporary loss of air picture, restore core combat capability, fight through cyber degradation.
- Board after: Stress 10, COMMS Yellow, AAW RADAR Red (isolated), IBMS/INS Yellow, ASUW TRACKING restored, CIWS FWD Disabled, Missile Launcher Disabled

**Turn 14 — Ship Neutralized, AAW Threat Focus**
- Injects: NAV (gun engagement effective impact on hostile vessel, target losing maneuverability), PWO (no further ESM from hostile unit, surface threat neutralized)
- Best: SWB16 + SWB01 (Reconnect AAW + Continue Mission) — Stress +1
- Board after: Stress 10, COMMS Yellow, AAW RADAR Yellow (reconnected), IBMS/INS Yellow, CIWS FWD Disabled, Missile Launcher Disabled

**Turn 15 — Happy Ending**
- Facilitator: "Hostile aircrafts were intercepted by friendly forces. The immediate threat has been neutralized."
- Best: SWB03 + SWB01 (Internal Sync + Continue Mission) — close with synchronization
- Facilitator closing: "You have navigated 15 turns of escalating pressure — from ambiguous sensor anomalies through confirmed cyber attack and live combat — under degraded conditions and real time constraints. What matters is the decisions you made, how you communicated under pressure, and the trade-offs you accepted as a team."

### 2.4 Tutorial Scenario (3 turns)

A simplified scenario for teaching game mechanics before the full 15-turn exercise.

**Setting**: Frigate approaching home port after routine patrol. Must complete port entry before tide window closes.

**Design constraints**:
- 3 turns only
- 6 cards only: SWB01, SWB02, SWB03, SWB05, SWB07, SWB19
- Stress stays 0-2 (discussion time stays generous)
- No combat, no cyber attribution ambiguity
- Self-contained, no references to main scenario

**Turn 1 — Steady Approach** (teach: basic turn flow)
- Facilitator: "You are 20 nautical miles from port. Approach phase has begun. Port authority expects you within the hour."
- All roles get nominal injects. Purely mechanical — walk team through each phase explicitly.
- Best: SWB01 + SWB03 — Stress +0
- Board after: Stress 0, all Green

**Turn 2 — Unexpected Current** (teach: system state change + investigation)
- Injects: NAV (0.3nm lateral offset from tidal current), EO (COMMS intermittent latency on port authority channel, 10-15 second delays), OPS (port authority hasn't acknowledged last position report)
- Best: SWB07 (Start Investigation – NAV offset) — Stress +1, COMMS → Yellow
- Note: NAV offset is real (current, not cyber). COMMS to Yellow regardless of Blue action (external cause: VHF congestion).
- Board after: Stress 0 or 1, COMMS Yellow

**Turn 3 — Narrowing Window** (teach: trade-off under time pressure)
- Facilitator: "Investigation confirms lateral offset from unexpected tidal current. Approach track needs correction. Tide window closes in 30 minutes."
- Injects: NAV (two options: maintain speed + correct course with tighter margins, or reduce speed for wider/safer approach risking tide window), EO (COMMS latency persists), OPS (pilot boat visible bearing 265, 3nm)
- Best: SWB02 + SWB19 (Reduce Speed + Correct Course) — Stress -1, safe approach
- Acceptable: SWB19 + SWB01 — Stress +1, faster but tighter margins
- Note: Both paths succeed. This turn teaches: not every decision has a wrong answer, but the team should articulate WHY they chose what they chose.

---

## Part 3: Domain-Agnostic Platform Architecture

TFC is a **platform**, not a single game. Silent Wake is one scenario running on TFC. The platform must support:

1. **Multiple domain configurations** — swap terminology, theming, roles, severity levels without code changes
2. **Multiple scenarios** — each scenario defines its own events, issues, decisions, roles, and card availability
3. **Multiple game modes** — different scoring/turn mechanics as pluggable strategies
4. **Multiple concurrent exercises** — each running independently with separate participants

### 3.1 Terminology Mapping (Domain ↔ Code)

The codebase uses **generic code names**. The domain configuration maps them to domain-specific labels.

| Domain Term (Silent Wake) | Code Term | Description |
|---------------------------|-----------|-------------|
| Inject | `Event` / `ScheduledEvent` / `EventScheduler` | A scheduled occurrence in the exercise timeline |
| Defect | `Issue` / `TrackedIssue` / `IssueManager` | A problem surfaced during the exercise |
| Blue Action Card | `DecisionOption` / `DecisionTemplate` | Selectable response option |
| Turn | Decision sequence position (`current_index`) | Implicit sequence tracked by engine |
| Stress | Maps to decision timer duration | Controls discussion phase timing |
| Game Board | Engine snapshot state | System/domain/weapon states |
| Exercise | `Exercise` / `ExerciseEngine` | A running instance of a scenario |
| Scenario | `Scenario` / `ScenarioContent` | A reusable exercise template |
| Game Master (GM) | GM / Facilitator | The facilitator running the exercise |
| Player | Participant | Someone responding to injects and making decisions |

### 3.2 Domain Model

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

**Entity Relationships:**
- Scenario 1:N Exercise — a scenario is a reusable template; exercises are instances
- Exercise 1:N Participant — each exercise has a GM and multiple players
- Exercise 1:1 Engine — each running exercise has one engine instance
- Engine contains: TimeManager, EventScheduler, IssueManager, DecisionManager, GameMode
- Scenario N:1 DomainConfig — a scenario references a domain config for terminology/theming
- DecisionTemplate 1:N DecisionOptionDef — each decision template has multiple selectable options

### 3.3 Game Modes

#### Classic Mode
- GM-driven, no scoring
- GM manually triggers events and closes decisions
- Engine **pauses on decisions** until resolved
- Requires a Game Master
- No scoring, no penalty accumulation

#### Simple Collaborative Mode
- Turn-based with advisor/decision-maker roles
- Sequential decisions with time-penalty scoring
- Advisors submit non-binding recommendations; decision-maker submits binding ruling
- Engine **continues running** during decisions (no auto-pause)
- Does not require a GM
- **Per-card scoring**: Each option has a `score: float` (+/0/-). Selected score = sum of chosen cards.
- **Penalty formula**: `penalty_ms = (max_possible_score - selected_score) * penalty_factor * 1000`
- **Effective decision time**: `max(min_decision_time_ms, base_decision_time_ms - accumulated_penalty_ms)`
- Penalty accumulates across turns and reduces available decision time
- Timeout auto-submits the worst option
- **Forced cards**: `forced_option_ids` on a DecisionTemplate. If a player omits a forced card, it is auto-included with a penalty and a `ForcedCardApplied` state change is emitted.
- **Max selections**: `max_selections` on a decision template caps how many options can be selected in `multi_choice` (`null` = unlimited)
- **2-player variant**: Both players act as combined advisor/decision-maker
- **Practice mode**: Solo-play variant. Available only with simple_collaborative. Max 1 player. Decision base time multiplied by 1.5x for solo cognitive load. Practice exercises excluded from joinable list.

### 3.4 Exercise Lifecycle

```
SETUP → BRIEFING → RUNNING → PAUSED → COMPLETED
                      ↑          │
                      └──────────┘
```

- **SETUP**: Exercise created, waiting room open, players joining
- **BRIEFING**: `start()` transitions SETUP → BRIEFING. Players read scenario context (briefing text, objectives, rules, roles). Time does NOT advance. `begin()` transitions BRIEFING → RUNNING. `reset()` can return BRIEFING → SETUP.
- **RUNNING**: Engine tick loop active, events fire, decisions open
- **PAUSED**: Engine paused (manually or by DECISION event in classic mode). Can resume.
- **COMPLETED**: Exercise finished, read-only review

Session codes are unique 6-character alphanumeric strings generated on creation.

### 3.5 Engine Architecture

The engine is a **pure runtime** — no database, no HTTP, no external dependencies. It must be testable in complete isolation.

**Tick loop**: 250ms interval. Each tick:
1. Advances play time (based on speed factor)
2. Checks event triggers (time-based)
3. Transitions issue lifecycles
4. Evaluates decision timeouts
5. Broadcasts state changes via WebSocket

**Play time vs real time**: Speed factor adjustable (e.g., 2x = 2 play-minutes per 1 real minute).

**Events** (code term for Injects): Scheduled occurrences with lifecycle `pending → active → completed`. Types: `NARRATIVE`, `DECISION`, `INJECT`. Events support:
- `target_roles` (list of role IDs): controls visibility — empty means all players see the event
- `role_descriptions` (dict mapping role ID → text): per-role inject text; players see their role's description or fall back to the main description
- Role-targeted events are broadcast only to matching roles + GMs

**Issues** (code term for Defects): Problems surfaced by events, with lifecycle `dormant → active → mitigated → resolved`. Can auto-resolve after countdown. Support `trigger_mode` and `trigger_event_id`.

**Decisions**: Questions posed to players when a DECISION event fires. Support `single_choice` or `multi_choice` question types.

### 3.6 Event/Inject Visibility Rules

Events with non-empty `target_roles` are **split-broadcast**: sent only to matching roles + GMs. This implements the physical game's mechanic where inject cards are handed face-down to specific roles.

### 3.7 Waiting Room / Lobby

- Players join via session code
- Role assignment is first-come-first-served from scenario-defined roles
- WebSocket broadcasts presence changes (join, leave, ready-up)
- In practice mode, max players capped at 1

---

## Part 4: Technical Stack

### 4.1 Backend
- **Framework**: FastAPI (Python)
- **Port**: 8001
- **Database**: PostgreSQL
- **Migrations**: Alembic (every migration must have working `downgrade()`)
- **Real-time**: WebSocket (single endpoint in `features/exercise/ws_router.py`)
- **Engine**: Pure Python, no external dependencies, no DB/HTTP imports inside `engine/` directory
- **Testing**: pytest + Hypothesis (property-based testing with strategies)

### 4.2 Frontend
- **Framework**: Angular (latest)
- **Port**: 4201
- **State management**: NgRx Signal Store (single source of truth for exercise state)
- **Design system**: Shared component library with CSS custom properties
- **Codegen**: Python TypedDicts → TypeScript interfaces via code generation

### 4.3 Type Safety Across the Stack

- Backend Python types are the **single source of truth**
- Engine state changes and snapshots (`state_changes.py`) are codegen'd to TypeScript
- Run codegen after changing backend TypedDicts; commit regenerated `.ts` file in same commit
- Never hand-write frontend types that duplicate backend TypedDicts
- Domain config types (`TerminologyMap`, `ThemeConfig`, `DomainRole`, `SeverityLevel`) are the only hand-maintained cross-stack types

### 4.4 Key Architecture Rules

1. `engine/` directory must remain pure Python — no SQLAlchemy, no FastAPI, no HTTP imports
2. All real-time communication through single WebSocket endpoint
3. Exercise store is the single source of truth for frontend state
4. Game modes live in `engine/game_modes/` — each mode is a dataclass implementing the `GameMode` protocol. No mode-specific logic in `exercise_engine.py`
5. Domain terminology stored in DB via `domain_config` feature — no hardcoded terms anywhere
6. Scenario content loaded by `scenario_loader.py` → `EngineConfig` — no hardcoded scenario data in engine

### 4.5 API Surface

**Scenarios**: CRUD (`POST/GET/PUT/DELETE /api/scenarios`)
**Exercises**: CRUD + lifecycle (`POST/GET/PUT/DELETE /api/exercises`, `GET .../joinable`, `GET .../by-code/{code}`)
**Engine**: `start`, `begin`, `pause`, `resume`, `reset`, `complete`, `speed`, `snapshot`, `context`
**Events**: `trigger`, `cancel`, `complete`, `pause`, `resume`, `delay`, `skip`
**Issues**: `activate`, `mitigate`, `resolve`, `release`
**Decisions**: list, `close`, `recommend`
**Waiting Room**: `join`, get state, remove participant
**Domain Config**: CRUD + by-slug lookup
**Audit**: Immutable append-only log (`GET /api/audit?exercise_id={id}`)
**Health**: `GET /api/health` → `{ status: "ok" }`

### 4.6 Domain Config System

DB-backed, not hardcoded. Each config has a unique `slug` (e.g., `default`, `military`, `cybersecurity`). Contains:
- **Terminology map**: generic code terms → domain-specific labels (e.g., "Event" → "Inject")
- **Theme**: colors, fonts, density
- **Roles**: domain-specific role definitions
- **Severity levels**: domain-specific severity labels and colors
- Seeded with presets; extensible via API without redeploy

### 4.7 Error Handling

Domain exceptions hierarchy — services raise `AppError` subclasses, NOT `fastapi.HTTPException`:

| Exception | HTTP Status | When |
|-----------|-------------|------|
| `NotFoundError` | 404 | Resource lookup returns None |
| `ConflictError` | 409 | Duplicate or state conflict |
| `ForbiddenError` | 403 | Insufficient permissions |
| `BadRequestError` | 400 | Invalid input or business rule violation |
| `EngineError` | 422 | Engine operation failed |

---

## Part 5: Scenario Data Structure

A scenario JSON seed must define:

```
{
  "title": "Silent Wake",
  "domain_config_slug": "military",
  "briefing": "...",
  "objectives": ["..."],
  "rules": ["..."],
  "roles": [
    {
      "id": "co",
      "name": "Commanding Officer",
      "abbreviation": "CO",
      "player_type": "decision_maker",
      "description": "..."
    },
    {
      "id": "ops",
      "name": "Operations Officer",
      "abbreviation": "OPS",
      "player_type": "advisor",
      "description": "..."
    }
    // ... all 6 roles + optional EO
  ],
  "events": [
    {
      "id": "turn_1_inject",
      "title": "In Transit",
      "description": "Default description for all players",
      "event_type": "INJECT",
      "trigger_time_ms": 0,
      "target_roles": ["ops", "nav", "eo", "cyop", "aawo", "pwo"],
      "role_descriptions": {
        "ops": "Transit proceeding as planned...",
        "nav": "Course and speed steady at 15 kts...",
        "eo": "Radar performance nominal...",
        "cyop": "Network traffic baseline unchanged...",
        "aawo": "Air picture normal...",
        "pwo": "Surface picture normal..."
      }
    }
    // ... events for each turn
  ],
  "issues": [
    {
      "id": "comms_degradation",
      "title": "Communications Degradation",
      "trigger_mode": "event",
      "trigger_event_id": "turn_5_inject"
    }
  ],
  "decision_templates": [
    {
      "id": "turn_1_decision",
      "title": "Turn 1 Action Selection",
      "question_type": "multi_choice",
      "max_selections": 2,
      "base_decision_time_ms": 300000,
      "min_decision_time_ms": 180000,
      "target_roles": ["co"],
      "options": [
        {
          "id": "swb01",
          "title": "Continue Mission (SWB01)",
          "description": "Continue pursuing the mission objective",
          "score": 1.0
        },
        {
          "id": "swb03",
          "title": "Internal Sync (SWB03)",
          "description": "Stress -2; align team coordination and tempo",
          "score": 1.0
        }
      ],
      "forced_option_ids": []
    }
    // ... decision templates for each turn
  ]
}
```

**Validation rules for scenarios:**
- Must have a title and at least one event
- Must define at least one role with `player_type='decision_maker'`
- Simple collaborative scenarios must define at least 2 roles (poka-yoke)
- Decision template `target_roles` must reference valid role IDs defined in the scenario
- Event `target_roles` and `role_descriptions` keys validated against scenario-defined roles

---

## Part 6: Frontend Structure

### 6.1 Views

- **Game Master view**: Engine controls, event timeline, issue management, decision monitoring, board state overview
- **Player view**: Role-filtered events/injects, decision panel (advisor recommends, CO decides), read-only timeline
- **Join/Lobby view**: Session code entry, exercise discovery
- **Waiting Room**: Presence indicators, role assignment, ready-up
- **Scenario Builder**: Scenario creation/editing UI
- **Review**: Post-exercise review (audit trail, decisions made, timeline)

### 6.2 Key Components

- **Clock display**: Shows play time with speed indicator
- **Phase badge**: Current exercise phase
- **Speed display**: Current speed factor
- **Decision panel**: Card selection interface (advisor bubbles for recommendations, CO selection)
- **Score bar**: Penalty/score visualization (collaborative mode)
- **Turn banner**: Current turn indicator
- **Context panel**: Briefing, objectives, rules
- **Presence indicator**: Connected participants
- **Domain selector**: Switch domain config terminology
- **Ambient background**: Visual atmosphere

### 6.3 WebSocket State Management

- Exercise store is single source of truth
- WS state handler transforms incoming state changes into store updates
- Features read from store, never from raw WebSocket messages
- State changes generated by engine, codegen'd to TypeScript types

---

## Part 7: Testing Strategy

### 7.1 Backend

- **Engine unit tests**: Test each engine component in isolation (TimeManager, EventScheduler, IssueManager, DecisionManager)
- **Engine property tests**: Hypothesis-based tests with strategies for random but valid inputs (option lists, penalty factors, decision sequences)
- **Game mode tests**: Unit tests per mode + property tests for scoring invariants
- **Integration tests**: Full exercise lifecycle, game mode flows, decision chains
- **Scenario validation tests**: Seed files validate at build time
- **Migration rollback tests**: Every Alembic migration upgrades and downgrades successfully

### 7.2 Frontend

- Component spec files colocated with components
- API changes require router tests

---

## Part 8: Critical Implementation Notes

1. **The engine is the heart.** Get the tick loop, event scheduling, and decision mechanics right first. Everything else wraps it.

2. **Stress → Timer mapping is central pedagogy.** The entire game's pressure mechanic depends on this. The digital version must faithfully reproduce the decreasing discussion time as stress increases.

3. **Role-targeted information is critical.** The game's information asymmetry (different roles seeing different injects) creates the need for communication and structured decision-making. The digital version must enforce that players only see their own role's information.

4. **Facilitator override capability is essential.** The GM must be able to force actions (like SWB20 on Turn 6), adjust stress, modify board state, and control the pace of the exercise.

5. **The CO decision structure is not just "pick cards."** The structured questioning protocol (Recommendation/Expected Effect/Tradeoff/Time) is a pedagogical tool. The digital version should support/encourage this communication pattern.

6. **Not every event is cyber.** The game deliberately mixes cyber incidents with normal operational events (weather, equipment wear, traffic congestion). The digital platform must not bias toward any single event type.

7. **Board state tells a story.** At the end of the exercise, the board state is a visual record of every decision. The debrief asks players to "look at your board — that is the story of your command decisions." The digital version must preserve and display this cumulative state history.

8. **The penalty/timer system (collaborative mode) digitizes the stress mechanic.** In the physical game, the facilitator manually sets stress and discussion time. In the digital collaborative mode, scoring performance automatically adjusts the next decision's available time — poor decisions create time pressure, which creates worse decisions, which creates more pressure. This feedback loop is the core game mechanic.

9. **Practice mode enables self-study.** A solo player should be able to run through the scenario to learn the mechanics, with 1.5x decision timer to compensate for not having a team to discuss with.

10. **Domain agnosticism is a first-class requirement.** The same platform should run a naval cyber wargame, a hospital crisis exercise, or a corporate incident response drill — only the scenario content and domain config change. No domain-specific logic in the engine or platform code.
