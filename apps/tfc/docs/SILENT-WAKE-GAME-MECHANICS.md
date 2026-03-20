# Silent Wake — Game Domain & Mechanics Reference

Compiled from: Exercise Briefing v101, Scenario Baseline, Scenario Tutorial, Role Sheets, Turn-by-Turn v001.

---

## 1. What Silent Wake Is

A **facilitator-controlled, turn-based tabletop cyber wargame** optimized for command decision-making under uncertainty and time pressure. Not a technical "cyber play" — focus is on decision rationale, communication under pressure, and trade-offs.

- **Setting**: Multi-domain naval exercise (fictional, unclassified)
- **Teams**: WHITE/RED TEAM (Facilitator) vs. BLUE TEAM (ship crew / players)
- **Exercise flow**: Pre-mission briefing → scenario execution (turns) → hot wash-up → after-action debrief

---

## 2. Roles

| Role | Abbr | Type | Responsibility |
|------|------|------|----------------|
| Commanding Officer | **CO** | Decision-maker | Final call each turn: choose 1–2 blue cards after hearing recommendations. Balance mission progress, survivability, escalation risk. |
| Operations Officer | **OPS** | Advisor | Mission planning, intelligence, MTC liaison, ROE awareness |
| Principal Warfare Officer | **PWO** | Advisor | Surface picture, ESM, engagement coordination, threat assessment |
| Anti-Air Warfare Officer | **AAWO** | Advisor | Air surveillance radar, air threat timelines, sensor posture |
| Cyber Operator | **CyOp** | Advisor | Network monitoring, cyber threat detection, IBMS/INS analysis, mitigation proposals |
| Navigator | **NAV** | Advisor | Navigation systems, AIS, WECDIS, route management, chart references |
| Engineering Officer | **EO** | Advisor | System health, repairs, ETBOL estimates, component status |

### CO Decision Protocol (each turn)
For each option, CO requires a 15-second answer from advisors:
1. **Recommendation** — what to do
2. **Expected effect** — what improves
3. **Tradeoff** — what you lose
4. **Time** — ETBOL / how many turns

### Authority
- Advisors recommend; CO decides.
- CO has final authority on maneuver, posture, and action selection.
- Exception: Turn 6 — Facilitator forces SWB20 (General Quarters) if CO doesn't select it.

---

## 3. Game Components

### Game Board
Central display showing:
- **Ship Systems**: ON/OFF + operational state (Green/Yellow/Red)
- **Weapons**: OK/Damaged + ON/OFF
- **Warfare Domains**: operational state (Green/Yellow/Red)
- **Stress counter**: 0–10
- **Notes**: free-text area
- **Quick Reference**: turn phases

### Card Types

| Card Type | Color/Prefix | Purpose |
|-----------|-------------|---------|
| **Briefing Card** | — | Context/background for pre-mission briefing (Turn 0) |
| **Inject Card** | — | Role-targeted event card delivered each turn. Contains situation updates per role. |
| **Blue Card** | SWBxx | Decision option — a response action the CO can play. Up to 2 per turn. |

### Blue Card Rules
- CO selects **up to 2 blue cards per turn**.
- If 2 cards are chosen, they must be **different** — except:
  - **SWB07** (Start Investigation) and **SWB08** (Start In-Depth Investigation) may be repeated in the same turn only if each targets a **different declared component**.
  - **SWB08** requires SWB07 to have been played on the same component in a previous turn.
- Some blue cards target a specific system (e.g., SWB10 "Isolate System", SWB14 "Reboot Affected System"). If a card can target multiple systems, it can only be played on **one** of them.

---

## 4. Ship Systems

### System Catalog (Silent Wake)

| System | Description | Initial State (Main Scenario) |
|--------|-------------|-------------------------------|
| **NAV RADAR** | Navigation radar | Green, ON |
| **IBMS / INS** (incl. WECDIS) | Integrated Bridge Management System / Inertial Navigation System | Green, ON |
| **NAV SENSORS** | GPS, speed log, compasses | Green, ON |
| **ASUW TRACKING RADAR** | Anti-Surface Warfare tracking radar | Green, OFF |
| **COMMS** | SATCOM, HF, UHF | Green, ON |
| **AAW RADAR** | Anti-Air Warfare surveillance radar | Green, OFF |

### Weapon Catalog (Silent Wake)

| Weapon | Description | Initial State |
|--------|-------------|---------------|
| **CIWS FWD** | Close-In Weapon System (forward) | OK, OFF |
| **CIWS AFT** | Close-In Weapon System (aft) | OK, OFF |
| **Missile Launcher** | Primary anti-ship/anti-air missile system | OK, OFF |
| **Gun** | Naval gun for surface engagement | OK, OFF |
| **Decoys** | Deceptive countermeasures against incoming missiles | OK, OFF |

### Operational State (3-tier traffic-light)

**For Systems:**

| Color | Label | Meaning |
|-------|-------|---------|
| Green | OK | Fully operational |
| Yellow | Degraded | Reduced capability |
| Red | Critical/Disabled | Non-functional or critically impaired |

**For Warfare Domains:**

| Color | Label | Meaning |
|-------|-------|---------|
| Green | No threat | No detected threat in this domain |
| Yellow | Possible threat | Suspicious activity, unconfirmed |
| Red | Actual threat | Confirmed hostile activity |

### System State Changes
System states change through:
- **Inject consequences** — e.g., COMMS degrades to Yellow due to external VHF congestion
- **Blue card effects** — e.g., SWB14 "Reboot" triggers silent privilege escalation → AAW RADAR Yellow
- **Facilitator overrides** — e.g., General Quarters forces all systems and weapons ON
- **Cascading cyber effects** — e.g., WECDIS attack propagates to INS, then to surface tracking

All state transitions are authored in the scenario pack and adjudicated by the Facilitator.

### Cyber Propagation Paths (Silent Wake)
```
WECDIS → INS → speed feed to all systems
AAW RADAR processing module → ASUW TRACKING RADAR
```

---

## 5. Stress Mechanic

### Stress Counter
- **Range**: 0–10 (integer)
- **Updated by**: Facilitator only (in tabletop version)
- **Scope**: Per-team (single counter on the game board)

### Stress → Decision Time Mapping

| Stress | Decision Time |
|--------|--------------|
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

Note: decay is non-linear — gap widens at stress 8+ (from 10s steps to 20s steps).

### Stress Sources
Stress deltas are defined **per blue card choice per turn** in the scenario pack. Examples:
- Turn 1: Best path (SWB01 + SWB03) → Stress +0
- Turn 4: Best path (SWB09 + SWB08) → Stress +1
- Turn 6: Best path (SWB08 + SWB20) → Stress +2
- Turn 8: Best path (SWB01 + SWB21) → Stress -1
- Turn 10: Best path (SWB18 + SWB04) → Stress +2

Stress can also be modified by:
- **Investigation outcomes** — e.g., investigating WECDIS in Turn 4 could yield Stress -1
- **Failure to act** — e.g., not investigating radar in Turn 2 → latent Stress +1

### Stress Progression (Main Scenario, Best Path)
Turn 0: 0 → Turn 1: 0 → Turn 2: 0 → Turn 3: 0 → Turn 4: 1 → Turn 5: 2 → Turn 6: 4 → Turn 7: 5 → Turn 8: 4 → Turn 9: 5 → Turn 10: 7 → Turn 11: 8 → Turn 12: 9 → Turn 13: 10 → Turn 14: 10 → Turn 15: 10

---

## 6. Turn Structure

### Turn Flow
```
Facilitator reads situation → Role-targeted injects delivered → Team discussion (timed) → CO selects 1–2 blue cards → Facilitator resolves effects → Board state updated → Next turn
```

### Turn Phases (per the game board quick reference)
1. **Inject phase** — Facilitator delivers role-targeted inject cards
2. **Discussion phase** — Team discusses under time pressure (stress-adjusted timer)
3. **Decision phase** — CO commits 1–2 blue cards
4. **Resolution phase** — Facilitator adjudicates effects, updates board

### Turn 0 — Pre-Sail Briefing
- **Purpose**: Mission context setting. Players extract information for a mission brief to the CO.
- **Duration**: 15 minutes
- **Injects**: Role-targeted briefing cards (OPS, NAV, EO, CyOp)
- **Blue cards**: None
- **Facilitator prompt**: "You are a crew of a Frigate. Prepare a mission briefing based on the information provided. Do not just read the text — extract only the information needed for a mission brief to your CO."
- **Initial board state**: Stress 0. All systems Green. NAV RADAR, IBMS/INS, and COMMS are ON. All others OFF.

### Turns 1–15 — Execution
Each turn has:
- Role-targeted injects (not all roles receive injects every turn)
- Available blue cards (varies per turn, defined in scenario pack)
- Expected/acceptable play paths with stress consequences
- Board state after resolution

### Post-Game
- **Hot wash-up** (30 min): What happened? Key decisions? What worked / didn't? What could be done differently?
- **Team Lightning Report** (5 min): Situation assessment, key decision points, primary lesson learned. Focus on decision rationale, not retelling events.
- **Instructor's Debrief**: Key messages and closing remarks.

---

## 7. Scoring

### Per-Turn Scoring
Each turn defines **best** and **acceptable** play paths in the scenario pack. Each path specifies:
- Which blue cards to play
- Stress consequence (+N / -N / +0)
- System state changes
- Board state after resolution

### Score Model
- Each blue card option carries a score: **+/−/0**
- The same blue card can score differently depending on the inject context (turn)
- Total score is accumulated across all turns
- **Penalty**: if wrong event is treated as cyber → explicit penalty (from briefing p.7)

### Score Communication
- **During play**: No score shown
- **End of exercise**: Total score communicated as **3 tiers: Lo / Mid / Hi** — no numbers
- **Wording**: Never negative. Encouraging, praise effort, even if score is low.
- From the briefing: "no competitive scoring"

---

## 8. Blue Card Catalog (Silent Wake — Main Scenario)

| Card | Title | Available Turns | Notes |
|------|-------|----------------|-------|
| SWB01 | Continue Mission | 1,2,3,5,6,7,8,9,12,14,15 | Maintain tempo |
| SWB02 | Reduce Speed / Safer Nav | Tutorial only | |
| SWB03 | Internal Sync (60 seconds) | 1, 15 | Team synchronization |
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
| SWB20 | General Quarters | 6 | Forced by Facilitator if not chosen |
| SWB21 | Prepare Target | 8 | |
| SWB23 | Close Range to Compensate | 11, 12, 13 | |
| SWB24 | Approach Target | 11 | |
| SWB26 | Shift to Gun Focus | 10 | |
| SWB27 | Fire Missile Counterattack | 9 | |
| SWB28 | Engage Target with Guns | 10, 13 | |
| SWB29 | Decoy Deployment | 4, 9 | |
| SWB30 | Approach Land (Emergency Concealment) | 11 | |

---

## 9. Board State Progression (Main Scenario, Best Path)

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
| 14 | 10 | AAW RADAR → Yellow (reconnected) | Surface threat neutralized, AAW reconnected |
| 15 | 10 | — | Friendly aircraft intercept air threat. End. |

---

## 10. Tutorial Scenario (3 Turns)

**Setting**: Frigate approaching home port after routine patrol. Tide window closing.

- **Purpose**: Teach game mechanics (inject → discussion → CO decision → resolution) in low-stakes setting
- **Stress range**: 0–2 (generous timers)
- **Systems**: At most COMMS reaches Yellow
- **No combat, no cyber attribution ambiguity**
- **Cards used**: SWB01, SWB02, SWB03, SWB05, SWB07, SWB19

| Turn | Title | Best Path | Stress |
|------|-------|-----------|--------|
| 1 | Steady Approach | SWB01 + SWB03 | +0 |
| 2 | Unexpected Current | SWB07 (NAV offset) | +1, COMMS → Yellow |
| 3 | Narrowing Window | SWB02 + SWB19 | -1 |

---

## 11. Key Abbreviations

| Abbr | Full Name |
|------|-----------|
| AIS | Automatic Identification System |
| AAW | Anti-Air Warfare |
| ASUW | Anti-Surface Warfare |
| CIWS | Close-In Weapon System |
| C2 | Command & Control |
| ECDIS/WECDIS | (Warship) Electronic Chart Display and Information System |
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
