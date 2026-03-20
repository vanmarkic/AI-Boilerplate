# TFC — Known Gaps (Post-Core Implementation)

Gaps identified by auditing the implementation plan against the Silent Wake PDFs.
To be filed as GitHub issues once GH CLI is available.

## 1. Warfare Domains (separate from systems)

The briefing defines warfare domains as a separate board section with their own Green/Yellow/Red states (No threat / Possible threat / Actual threat). These are distinct from system operational states. The current plan only models systems, not warfare domains.

**Source:** Exercise Briefing p.12

## 2. Blue Card Uniqueness Constraint

"If you choose 2 actions, they must be different." Exception: SWB07 and SWB08 may be repeated in the same turn only if each targets a different declared component. Needs a card-play validation layer.

**Source:** CO Role Sheet §2

## 3. Blue Card Prerequisite Chain

SWB08 (Start In-Depth Investigation) requires SWB07 (Start Investigation) to have been played on the same component in a previous turn. Needs cross-turn card history tracking.

**Source:** CO Role Sheet §2

## 4. Cascading System Effects

The scenario shows propagation chains: WECDIS → INS → speed feed to all systems; AAW RADAR processing module → ASUW TRACKING RADAR. The current plan only models direct card → system effects, not system → system propagation.

**Source:** Scenario Baseline Turn 11, CyOp Role Sheet §2

## 5. Latent / Conditional Stress

"If radar diagnostic is NOT initiated at least once → Stress +1 (latent sensor doubt)." Stress that triggers based on what was NOT played in a previous turn. Requires checking prior-turn decision history.

**Source:** Scenario Baseline Turn 2 Notes

## 6. Weapon 2-Tier State

Weapons in the briefing use OK / non-operational (binary), not Green/Yellow/Red (3-tier). SystemManager currently uses 3-tier for everything. Weapons may need a different state model or the 3-tier model needs to accommodate binary states.

**Source:** Scenario Baseline Initial Conditions, Turn 10

## 7. Manual GM Stress Override

In the tabletop version, stress is "Updated by the Facilitator ONLY." In Classic (GM-driven) mode, the Facilitator needs a manual stress control endpoint to set stress directly.

**Source:** Exercise Briefing p.16
