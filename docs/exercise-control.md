Training Flow Control – Trainer & Trainee
Unified Requirements & Design Description
Purpose and Scope
This document defines the initial functional and non-functional requirements for the Training Flow Control (TFC) demonstrator of the Training Service. It consolidates trainer and trainee perspectives, execution logic, data models, UI concepts, decision handling, and optional scoring. The initial validated use case is a tabletop cyber wargame, with extensibility toward technical cyber exercises and hybrid scenarios.
What You Are Building (In One Sentence)
You are building a runtime exercise orchestration system that controls time, events, failures, and decisions for cyber training exercises, providing separate but synchronized interfaces for Trainers and Trainees, with full traceability and optional post-exercise evaluation.
Why This Exists
Naval cyber training exercises are:
•	Narrative-driven
•	Time-compressed
•	Decision-heavy
•	Conducted by non-expert cyber operators
This component ensures:
•	Exercises run in a controlled, repeatable, and observable way
•	Trainers can adapt in real time
•	Trainees experience realistic operational pressure
•	Everything is traceable for debriefing

Roles and Access Model
Trainer (EXCON): Full control of exercise timeline, injects, defects, decision points, and overrides.
Trainee (Player): Participates in the exercise, receives injects, observes defects, responds to decision points, and reviews context and personal decision history.

A trainee may hold one or more player roles. Visibility of injects, defects, and decisions may be role-based.
Functional Model
Three layers system:
Exercise Engine (Core)
•	Owns time
•	Owns state
•	Owns inject/defect lifecycle
•	Is UI-agnostic
Control View (Trainer / EXCON)
•	Full authority over the engine
•	Can override automation
•	Can see everything
Player View (Trainee)
•	Passive with respect to control
•	Active only for decisions
•	Sees only what is revealed

3. Core Concepts
Exercise: A time-driven scenario composed of injects, defects, and decision points.
Inject: A narrative or operational event introduced during the exercise.
Defect: A simulated system or capability degradation.
Decision Point: A special inject that pauses the exercise and requires trainee input.
Dual Time Model: Real Time (RT) and Simulated / Play Time (PT).
4. Time Management
The system manages two concurrent clocks:
- Real Time (RT): Wall-clock elapsed time.
- Play Time (PT): Simulated scenario time.

Inject scheduling and narrative logic are always based on PT. A configurable mapping factor defines PT progression relative to RT.
Building blocks
Injects (Events)
Injects represent things that happen in the exercise.
Examples:
•	Report from HQ
•	Sensor anomaly
•	SOC alert
•	Request for action
•	Decision prompt
Inject characteristics:
•	Scheduled relative to PT
•	Can be automatic or manually triggered
•	Can overlap with other injects
•	Can depend on other injects
•	Can trigger defects
Inject lifecycle:
Scheduled → Pending → Running → (Paused) → Completed / Cancelled
Injects may be instantaneous or duration based.
Data model
Each inject includes:
- Unique ID
- Title and description
- Planned start time (PT, relative to exercise start)
- Type: informational, operational, decision point
- Duration (optional: fixed, variable, or undefined)
- Execution mode: automatic, manual, conditional
- Dependencies on other injects
- Optional linkage to defects
Decision Points (Special Injects)
Decision points are injects that:
•	Pause the exercise timeline
•	Require trainee input
•	Influence what happens next
Decision points:
•	Target one or more trainee roles
•	Present a question or choice
•	Block time until completion conditions are met
Completion conditions:
•	All required responses received
•	First response received
•	Trainer validation
•	Timeout
Decision points are not scored live (from the trainee point of view).
Data Model
Decision points are special injects that pause the exercise and require trainee input.

They include:
- Question text
- Question type (single choice, multiple choice, free text)
- Target roles or players
- Completion condition (all responses, first response, trainer validation)

Decisions are logged with both RT and PT timestamps.
Defects (System Degradations)
Defects represent operational consequences.
Examples:
•	Radar degraded
•	SATCOM unavailable
•	OT network unstable
Defect characteristics:
•	Can start by time, inject, or trainer
•	Have ETBOL (time to repair)
•	Can be real-time or simulated-time based
•	May be manually overridden
Defect lifecycle:
Inactive → Active → Mitigated → Resolved
Defects must be visible to trainees once active.
Data Model
Each defect includes:
- Unique ID
- Title and description
- Start condition (time-based, inject-based, or manual)
- ETBOL expressed in real and/or play time
- Control mode: automatic, manual, hybrid

Defect lifecycle states: Inactive, Active, Mitigated, Resolved.
Trainer (EXCON) View 
The Trainer view is a control plane, not just  a dashboard.
Key properties:
•	Owns global time control
•	Can override everything
•	Can act independently of automation
•	Sees hidden future events
Layout logic (conceptual):
•	Header: exercise + clocks
•	Main area: inject timeline + defect list
•	Details panel: selected item
•	Footer: timeline controls
Trainer actions:
•	Start / pause / reset exercise
•	Pause an inject without stopping time
•	Delay, skip, or force injects
•	Start or end defects manually
•	Observe trainee decisions in real time
Trainer actions are always logged.
Trainer Interface – Functional Description
The Trainer interface is a control cockpit organized into four horizontal zones:

Row 1 – Header:
- NCTS logo
- Exercise title
- Real and simulated time display

Row 2 – Overview:
- Left: Inject timeline with parallel lanes
- Right: Defect list with state indicators

Row 3 – Details (collapsible):
- Full details and manual controls for selected inject or defect

Row 4 – Controls:
- Start, Pause, Reset exercise timeline
Trainer capabilities include:
- Global timeline control
- Independent inject and defect control
- Manual override of automation
- Observation of trainee decisions in real time

 
Trainee View
The Trainee view is a controlled operational picture.
Trainee can:
•	See injects as they are released
•	See active and past defects
•	Respond to decision points
•	Review mission context
•	Review own past decisions
Trainee cannot:
•	Control time
•	Trigger injects
•	See future events
•	See scoring during execution
Decision points appear as:
•	Modal dialogs or dedicated panels
•	Blocking interaction until response

Trainee Interface – Functional Description
The Trainee interface shares visual consistency with the Trainer interface but provides no control over time.

The trainee can:
- View current and past injects
- Observe active and resolved defects
- Respond to decision points
- Access contextual information (mission, ROE, orders)
- Review personal decision history

Decision points appear as modal or dedicated panels and pause the exercise until completion conditions are met.

 
Context and Reference Information
Contextual information such as mission description, operational background, and ROE is available to trainees at all times in read-only form. Accessing context does not pause or affect exercise execution.
Logging, Audit, and Debrief Readiness
All state transitions and actions are logged:
- Timeline state changes
- Inject and defect lifecycle events
- Trainer overrides
- Trainee decisions

Logs include both RT and PT timestamps and are exportable for after-action review and replay.
Scoring and Evaluation (Optional - Post-Exercise Only)
Scoring is optional and invisible during exercise execution. It is computed continuously but revealed only after exercise completion.

Scoring dimensions may include:
- Decision quality
- Timeliness of responses
- Defect handling effectiveness
- Situational awareness

Scoring is based on simulated time and contextual state at decision moments. Trainer interventions may be excluded from scoring if flagged.
Final scoring outputs are available only in debrief mode and are intended to support discussion and learning, not competition or judgment.
Non-Functional Requirements
- Time synchronization accuracy within ±250 ms (to be discussed)
- Initially support at least 1 trainer and 10 concurrent trainees (then we consider parallel trainee groups)
- Session state persistence across UI refresh or reconnect
- Strict server-side role enforcement
- Scoring and evaluation fully decoupled from execution logic

