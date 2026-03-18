"""Sample Emergency Response scenario for TFC.

Simulates a hospital mass casualty incident (MCI) triggered by a nearby
industrial explosion.  The exercise walks responders through triage,
resource allocation, and inter-agency coordination across four phases.

Usage:
    from features.scenario.sample_er_scenario import ER_SCENARIO_CONTENT
    content = ScenarioContent.model_validate(ER_SCENARIO_CONTENT)
"""

from __future__ import annotations

# Play-time helpers (milliseconds)
_SEC = 1_000
_MIN = 60 * _SEC

ER_SCENARIO_CONTENT: dict = {
    "briefing": (
        "A large industrial explosion has occurred 2 km from City General "
        "Hospital. Initial reports indicate 40+ casualties en route. The "
        "hospital must activate its Mass Casualty Incident plan, triage "
        "incoming patients, allocate scarce resources, and coordinate with "
        "EMS, fire, and neighbouring facilities."
    ),
    "objectives": [
        "Activate the hospital MCI plan within 5 minutes of notification",
        "Establish a functional triage area before the first wave arrives",
        "Maintain situational awareness through inter-agency communication",
        "Make resource-allocation decisions under time pressure",
        "Coordinate patient transfers when capacity is exceeded",
    ],
    "rules": [
        "All decisions must be made within the time limit or they auto-close",
        "The Game Master may inject additional events at any time",
        "Players should communicate role changes to the GM immediately",
    ],
    "default_time_factor": 1.5,
    # ── Phases ───────────────────────────────────────────────────────────
    "phases": [
        {
            "id": "phase-alert",
            "title": "Alert & Activation",
            "description": ("Hospital receives MCI notification and activates the emergency plan."),
            "duration_ms": 10 * _MIN,
            "events": ["evt-dispatch", "evt-mci-activation"],
        },
        {
            "id": "phase-triage",
            "title": "Triage & First Wave",
            "description": (
                "First ambulances arrive. Triage area is set up and patients are categorised."
            ),
            "duration_ms": 15 * _MIN,
            "events": [
                "evt-first-ambulances",
                "evt-triage-setup",
                "evt-red-patients",
            ],
        },
        {
            "id": "phase-surge",
            "title": "Surge & Resource Strain",
            "description": (
                "Patient volume exceeds capacity. Critical decisions on "
                "resource allocation and transfers are required."
            ),
            "duration_ms": 20 * _MIN,
            "events": [
                "evt-second-wave",
                "evt-blood-shortage",
                "evt-icu-full",
                "evt-media-arrival",
            ],
        },
        {
            "id": "phase-stabilise",
            "title": "Stabilisation & Handoff",
            "description": (
                "Patient flow slows.  Teams transition to sustained "
                "operations and begin handoff to recovery phase."
            ),
            "duration_ms": 15 * _MIN,
            "events": ["evt-mutual-aid", "evt-debrief"],
        },
    ],
    # ── Events ───────────────────────────────────────────────────────────
    "events": [
        {
            "id": "evt-dispatch",
            "title": "Dispatch Notification",
            "description": (
                "County dispatch calls: industrial explosion confirmed, "
                "40+ casualties, first ambulances ETA 8 minutes."
            ),
            "event_type": "informational",
            "scheduled_pt_ms": 0,
            "duration_ms": 2 * _MIN,
            "dependencies": [],
            "triggered_issues": [],
        },
        {
            "id": "evt-mci-activation",
            "title": "MCI Plan Activation",
            "description": (
                "Decision point: activate the hospital Mass Casualty "
                "Incident plan at Level II or Level III?"
            ),
            "event_type": "decision",
            "scheduled_pt_ms": 2 * _MIN,
            "duration_ms": 5 * _MIN,
            "dependencies": ["evt-dispatch"],
            "triggered_issues": ["iss-staff-recall"],
        },
        {
            "id": "evt-first-ambulances",
            "title": "First Ambulances Arrive",
            "description": (
                "Three ambulances arrive simultaneously with 9 patients: "
                "2 critical (red), 4 delayed (yellow), 3 minor (green)."
            ),
            "event_type": "operational",
            "scheduled_pt_ms": 8 * _MIN,
            "duration_ms": 5 * _MIN,
            "dependencies": [],
            "triggered_issues": ["iss-triage-bottleneck"],
        },
        {
            "id": "evt-triage-setup",
            "title": "Triage Area Established",
            "description": (
                "Triage tent is operational outside the ED entrance. "
                "START triage protocol is in effect."
            ),
            "event_type": "informational",
            "scheduled_pt_ms": 10 * _MIN,
            "duration_ms": None,
            "dependencies": ["evt-first-ambulances"],
            "triggered_issues": [],
        },
        {
            "id": "evt-red-patients",
            "title": "Critical Patients Deteriorating",
            "description": (
                "Two red-tagged patients are deteriorating rapidly. "
                "One requires emergency surgery, the other needs "
                "ventilator support."
            ),
            "event_type": "decision",
            "scheduled_pt_ms": 14 * _MIN,
            "duration_ms": 4 * _MIN,
            "dependencies": ["evt-first-ambulances"],
            "triggered_issues": ["iss-or-contention"],
        },
        {
            "id": "evt-second-wave",
            "title": "Second Wave of Casualties",
            "description": (
                "Additional 15 patients arrive — including 4 paediatric "
                "burn victims requiring specialised care."
            ),
            "event_type": "operational",
            "scheduled_pt_ms": 22 * _MIN,
            "duration_ms": 8 * _MIN,
            "dependencies": [],
            "triggered_issues": ["iss-paediatric-capacity"],
        },
        {
            "id": "evt-blood-shortage",
            "title": "Blood Bank Alert",
            "description": (
                "Blood bank reports O-negative supply is critically low. "
                "Request to regional blood centre has 45-minute ETA."
            ),
            "event_type": "decision",
            "scheduled_pt_ms": 26 * _MIN,
            "duration_ms": 5 * _MIN,
            "dependencies": [],
            "triggered_issues": ["iss-blood-supply"],
        },
        {
            "id": "evt-media-arrival",
            "title": "Media Arrives On Scene",
            "description": (
                "News crews are at the hospital entrance. Families are "
                "gathering in the lobby demanding information."
            ),
            "event_type": "informational",
            "scheduled_pt_ms": 28 * _MIN,
            "duration_ms": None,
            "dependencies": [],
            "triggered_issues": ["iss-public-info"],
        },
        {
            "id": "evt-icu-full",
            "title": "ICU at Capacity",
            "description": (
                "ICU reports all beds occupied. Three additional patients "
                "need intensive care. Transfer or convert step-down unit?"
            ),
            "event_type": "decision",
            "scheduled_pt_ms": 30 * _MIN,
            "duration_ms": 5 * _MIN,
            "dependencies": [],
            "triggered_issues": ["iss-bed-shortage"],
        },
        {
            "id": "evt-mutual-aid",
            "title": "Mutual Aid Response",
            "description": (
                "Neighbouring St. Mary's Hospital confirms capacity for "
                "8 non-critical transfers. Transport coordination needed."
            ),
            "event_type": "operational",
            "scheduled_pt_ms": 40 * _MIN,
            "duration_ms": 10 * _MIN,
            "dependencies": [],
            "triggered_issues": [],
        },
        {
            "id": "evt-debrief",
            "title": "Incident Commander Debrief",
            "description": (
                "Patient flow has stabilised. IC calls for a status "
                "report from all section chiefs before transitioning "
                "to sustained operations."
            ),
            "event_type": "informational",
            "scheduled_pt_ms": 55 * _MIN,
            "duration_ms": 5 * _MIN,
            "dependencies": [],
            "triggered_issues": [],
        },
    ],
    # ── Issues ───────────────────────────────────────────────────────────
    "issues": [
        {
            "id": "iss-staff-recall",
            "title": "Staff Recall Delays",
            "description": (
                "Off-duty staff recall is underway but responses are "
                "slow. ED is running at 60 % staffing."
            ),
            "trigger_mode": "event-based",
            "trigger_event_id": "evt-mci-activation",
            "auto_resolve_ms": 20 * _MIN,
        },
        {
            "id": "iss-triage-bottleneck",
            "title": "Triage Bottleneck",
            "description": (
                "Only one triage nurse is available at the entrance. "
                "Patients are queuing in ambulances."
            ),
            "trigger_mode": "event-based",
            "trigger_event_id": "evt-first-ambulances",
            "auto_resolve_ms": 10 * _MIN,
        },
        {
            "id": "iss-or-contention",
            "title": "Operating Room Contention",
            "description": (
                "Both available ORs are occupied with scheduled "
                "surgeries. Emergency cases need immediate access."
            ),
            "trigger_mode": "event-based",
            "trigger_event_id": "evt-red-patients",
            "auto_resolve_ms": 0,
        },
        {
            "id": "iss-paediatric-capacity",
            "title": "Paediatric Burn Capacity",
            "description": (
                "Hospital has limited paediatric burn capability. "
                "Regional burn centre is 90 minutes by ground transport."
            ),
            "trigger_mode": "event-based",
            "trigger_event_id": "evt-second-wave",
            "auto_resolve_ms": 0,
        },
        {
            "id": "iss-blood-supply",
            "title": "Blood Supply Critically Low",
            "description": (
                "O-negative units exhausted. MTP protocol activated. "
                "Regional resupply ETA 45 minutes."
            ),
            "trigger_mode": "event-based",
            "trigger_event_id": "evt-blood-shortage",
            "auto_resolve_ms": 45 * _MIN,
        },
        {
            "id": "iss-bed-shortage",
            "title": "ICU Bed Shortage",
            "description": (
                "No ICU beds available. Patients boarding in ED and "
                "PACU. Step-down conversion under consideration."
            ),
            "trigger_mode": "event-based",
            "trigger_event_id": "evt-icu-full",
            "auto_resolve_ms": 0,
        },
        {
            "id": "iss-public-info",
            "title": "Public Information Demand",
            "description": ("Media and families require updates. No PIO has been designated yet."),
            "trigger_mode": "time-based",
            "trigger_time_pt_ms": 28 * _MIN,
            "auto_resolve_ms": 0,
        },
    ],
    # ── Game Mode ──────────────────────────────────────────────────────────
    "game_mode": "simple_collaborative",
    "decision_sequence": [
        "dec-mci-level",
        "dec-or-priority",
        "dec-blood-protocol",
        "dec-icu-overflow",
        "dec-paeds-transfer",
    ],
    # ── Roles ─────────────────────────────────────────────────────────────
    "roles": [
        {"id": "co", "label": "Commanding Officer (CO)", "player_type": "decision_maker"},
        {"id": "ops", "label": "Operations Officer (OPS)", "player_type": "advisor"},
        {"id": "nav", "label": "Navigator (NAV)", "player_type": "advisor"},
        {"id": "pwo", "label": "Principal Warfare Officer (PWO)", "player_type": "advisor"},
        {"id": "aawo", "label": "Anti-Air Warfare Officer (AAWO)", "player_type": "advisor"},
        {"id": "cyop", "label": "Cyber Operator (CyOp)", "player_type": "advisor"},
        {"id": "eo", "label": "Engineering Officer (EO)", "player_type": "advisor"},
    ],
    # ── Decision Templates ───────────────────────────────────────────────
    "decision_templates": [
        {
            "id": "dec-mci-level",
            "title": "MCI Activation Level",
            "description": (
                "Choose the hospital MCI activation level based on "
                "reported casualty numbers and severity."
            ),
            "issue_id": "iss-staff-recall",
            "question_type": "single_choice",
            "options": [
                {
                    "id": "opt-level2",
                    "label": "Level II — Partial activation (20-50 patients)",
                    "score": 5.0,
                },
                {
                    "id": "opt-level3",
                    "label": "Level III — Full activation (50+ patients)",
                    "score": 10.0,
                },
            ],
            "completion_mode": "first_response",
        },
        {
            "id": "dec-or-priority",
            "title": "Operating Room Priority",
            "description": (
                "Two critical patients need surgery but only one OR can "
                "be freed immediately. Who gets priority?"
            ),
            "issue_id": "iss-or-contention",
            "question_type": "single_choice",
            "options": [
                {
                    "id": "opt-blast-injury",
                    "label": "Patient A — Blast abdominal injury, unstable",
                    "score": 10.0,
                },
                {
                    "id": "opt-crush-injury",
                    "label": "Patient B — Crush injury, open femur fracture",
                    "score": 7.0,
                },
                {
                    "id": "opt-cancel-elective",
                    "label": "Cancel elective case to free both ORs",
                    "score": 8.0,
                },
            ],
            "completion_mode": "first_response",
        },
        {
            "id": "dec-blood-protocol",
            "title": "Blood Shortage Protocol",
            "description": (
                "O-negative supply is critically low. How should blood "
                "resources be managed until resupply arrives?"
            ),
            "issue_id": "iss-blood-supply",
            "question_type": "single_choice",
            "options": [
                {
                    "id": "opt-mtp-continue",
                    "label": "Continue MTP for critical patients only",
                    "score": 8.0,
                },
                {
                    "id": "opt-switch-typespec",
                    "label": "Switch to type-specific blood for stable patients",
                    "score": 10.0,
                },
                {
                    "id": "opt-request-donors",
                    "label": "Issue emergency donor appeal",
                    "score": 4.0,
                },
            ],
            "completion_mode": "first_response",
        },
        {
            "id": "dec-icu-overflow",
            "title": "ICU Overflow Management",
            "description": (
                "ICU is full with three more patients needing intensive "
                "care. What is the best course of action?"
            ),
            "issue_id": "iss-bed-shortage",
            "question_type": "single_choice",
            "options": [
                {
                    "id": "opt-convert-stepdown",
                    "label": "Convert step-down unit to temporary ICU",
                    "score": 9.0,
                },
                {
                    "id": "opt-transfer-out",
                    "label": "Transfer 2 stable ICU patients to St. Mary's",
                    "score": 10.0,
                },
                {
                    "id": "opt-ed-boarding",
                    "label": "Continue boarding in ED with 1:1 nursing",
                    "score": 5.0,
                },
            ],
            "completion_mode": "first_response",
        },
        {
            "id": "dec-paeds-transfer",
            "title": "Paediatric Burn Transfer",
            "description": (
                "Four paediatric burn victims need specialised care "
                "beyond this hospital's capability. Choose a strategy."
            ),
            "issue_id": "iss-paediatric-capacity",
            "question_type": "single_choice",
            "options": [
                {
                    "id": "opt-ground-all",
                    "label": "Ground transport all 4 to regional burn centre",
                    "score": 6.0,
                },
                {
                    "id": "opt-heli-critical",
                    "label": "Helicopter the 2 most critical, ground the rest",
                    "score": 10.0,
                },
                {
                    "id": "opt-stabilise-local",
                    "label": "Stabilise locally, defer transfer until stable",
                    "score": 4.0,
                },
            ],
            "completion_mode": "first_response",
        },
    ],
}
