# Silent Wake — Scoring Logic Clarifications

The scenario document categorizes card combinations each turn as **Best** or **Acceptable**, with a stress delta for each. The following questions need to be resolved before implementing the scoring engine.

## Open Questions

### 1. How do Best and Acceptable influence game mechanics and scoring?

Are these categories meant to drive scoring, timer pressure, narrative branching, or some combination? What should the player experience differently when they land on Best vs Acceptable vs neither?

### 2. What happens when players pick a combination that is neither Best nor Acceptable?

Several turns have cards available that aren't mentioned in either category (e.g., Decoy Deployment in Turn 4, Engage with Guns in Turn 10). Are those all treated equally as poor decisions, or should some be penalized more than others?

### 3. What about partial combos — is it all-or-nothing?

The Best and Acceptable paths are always defined as pairs of two cards. If the team only picks one of the two (e.g., Best is SWB09 + SWB08 but they only play SWB09), do they get partial credit, or must the exact combination be matched for the score to apply?

### 4. Should there be a graduated scale or just categories?

Is the difference between Best and Acceptable binary (you either nailed it or you didn't), or is there a gradient — e.g., Best is worth significantly more than Acceptable, which is worth significantly more than anything else?

### 5. Cards noted as "also valid" in the facilitator notes

SWB28 in Turn 10, SWB24 in Turn 11 — do these sit at the same level as Acceptable, or somewhere between Acceptable and unmentioned?

### 6. Facilitator-forced actions

SWB20 in Turn 6 is mandatory. Does a forced card count toward the team's performance, or is it neutral since they had no real choice?
