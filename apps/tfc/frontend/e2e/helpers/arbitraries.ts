/**
 * fast-check arbitraries for player view state dimensions.
 *
 * Generates valid { snapshot, context, role, participantId, practiceMode }
 * tuples covering the full player view state space:
 *   phase × score × events × issues × decisions × role × systems × practiceMode
 */
import fc from "fast-check";

// ── Primitive arbitraries ────────────────────────────────────────────

export const phaseArb = fc.constantFrom(
  "setup",
  "briefing",
  "running",
  "paused",
  "completed",
);

export const roleArb = fc.constantFrom("co", "nav", "ops");

// ── Score ────────────────────────────────────────────────────────────

const scoreRecordArb = fc.record({
  total_score: fc.double({ min: -50, max: 200, noNaN: true, noDefaultInfinity: true }),
  stress: fc.integer({ min: 0, max: 10 }),
  turn_number: fc.integer({ min: 1, max: 15 }),
  next_decision_time_ms: fc.integer({ min: 0, max: 600_000 }),
});

export type Score = {
  total_score: number;
  stress: number;
  turn_number: number;
  next_decision_time_ms: number;
};

// ── Events ───────────────────────────────────────────────────────────

const eventLifecycleArb = fc.constantFrom("scheduled", "running", "completed");

function makeEvent(index: number, lifecycle: string, pt: number) {
  return {
    id: `ev-${index}`,
    title: `Event-${index}`,
    description: `Description for event ${index}`,
    event_type: "narrative" as const,
    scheduled_pt_ms: pt,
    duration_ms: lifecycle === "completed" ? 5_000 : null,
    dependencies: [] as string[],
    lifecycle,
    started_at_pt_ms: lifecycle === "scheduled" ? null : pt,
    completed_at_pt_ms: lifecycle === "completed" ? pt + 5_000 : null,
  };
}

const singleEventArb = fc
  .record({
    lifecycle: eventLifecycleArb,
    pt: fc.integer({ min: 1_000, max: 500_000 }),
  })
  .map(({ lifecycle, pt }) => ({ lifecycle, pt }));

// Generate 0-3 event specs, then assign stable indices
export const eventsArb = fc
  .array(singleEventArb, { maxLength: 3 })
  .map((specs) => specs.map((s, i) => makeEvent(i, s.lifecycle, s.pt)));

// ── Issues ───────────────────────────────────────────────────────────

const issueLifecycleArb = fc.constantFrom("active", "mitigated", "resolved");

function makeIssue(index: number, lifecycle: string, released: boolean) {
  return {
    id: `iss-${index}`,
    title: `Issue-${index}`,
    description: `Description for issue ${index}`,
    trigger_mode: "event-based" as const,
    auto_resolve_ms: 0,
    lifecycle,
    activated_at_pt_ms: 20_000,
    resolved_at_pt_ms: lifecycle === "resolved" ? 50_000 : null,
    released,
  };
}

export const issuesArb = fc
  .array(
    fc.record({ lifecycle: issueLifecycleArb, released: fc.boolean() }),
    { maxLength: 2 },
  )
  .map((specs) =>
    specs.map((s, i) => makeIssue(i, s.lifecycle, s.released)),
  );

// ── Decisions ────────────────────────────────────────────────────────

const OPTIONS = [
  { id: "opt-a", label: "Option Alpha", score: 10 },
  { id: "opt-b", label: "Option Beta", score: 5 },
  { id: "opt-c", label: "Option Gamma", score: -2 },
];

function makeDecision(
  index: number,
  target_roles: string[],
  hasRecs: boolean,
) {
  const recommendations: Record<string, string> = {};
  if (hasRecs) {
    recommendations["nav-advisor"] = "opt-a";
    recommendations["ops-advisor"] = "opt-b";
  }
  return {
    id: `dec-${index}`,
    event_id: "ev-0",
    issue_id: "iss-0",
    title: `Decision-${index}`,
    description: "Choose wisely.",
    question_type: "single_choice" as const,
    options: OPTIONS,
    completion_mode: "first_response" as const,
    target_roles,
    timeout_ms: 300_000,
    status: "open" as const,
    opened_at_pt_ms: 60_000,
    closed_at_pt_ms: null,
    recommendations,
  };
}

export const decisionsArb = fc
  .array(
    fc.record({
      target_roles: fc.subarray(["co", "nav", "ops"]),
      hasRecs: fc.boolean(),
    }),
    { maxLength: 1 },
  )
  .map((specs) =>
    specs.map((s, i) => makeDecision(i, s.target_roles, s.hasRecs)),
  );

// ── Systems ──────────────────────────────────────────────────────────

const SYSTEM_DEFS = [
  { system_id: "nav_radar", label: "NAV RADAR", category: "sensor" },
  { system_id: "comms", label: "COMMS", category: "system" },
  { system_id: "aaw_radar", label: "AAW RADAR", category: "sensor" },
  { system_id: "ew_suite", label: "EW SUITE", category: "system" },
];

const systemArb = fc
  .record({
    idx: fc.integer({ min: 0, max: SYSTEM_DEFS.length - 1 }),
    power: fc.boolean(),
    operational: fc.constantFrom("green", "yellow", "red"),
  })
  .map(({ idx, power, operational }) => ({
    ...SYSTEM_DEFS[idx],
    power,
    operational,
  }));

export const systemsArb = fc.array(systemArb, { maxLength: 4 });

// ── Context ──────────────────────────────────────────────────────────

const ROLES = [
  { id: "co", label: "Commanding Officer", player_type: "decision_maker" },
  { id: "nav", label: "Navigator", player_type: "advisor" },
  { id: "ops", label: "Operations", player_type: "advisor" },
];

export const CONTEXT = {
  title: "Silent Wake",
  description: "Naval cyber exercise",
  briefing: "You are aboard the USS Sentinel.",
  objectives: ["Defend the ship", "Maintain comms"],
  rules: ["No external comms", "Time is critical"],
  roles: ROLES,
};

// ── Composed state arbitrary ─────────────────────────────────────────

export interface PlayerState {
  phase: string;
  score: Score | null;
  events: ReturnType<typeof makeEvent>[];
  issues: ReturnType<typeof makeIssue>[];
  decisions: ReturnType<typeof makeDecision>[];
  systems: ReturnType<typeof systemArb extends fc.Arbitrary<infer T> ? () => T : never>[];
  role: string;
  practiceMode: boolean;
}

export const playerStateArb: fc.Arbitrary<PlayerState> = fc
  .record({
    phase: phaseArb,
    scorePresent: fc.boolean(),
    scoreRecord: scoreRecordArb,
    events: eventsArb,
    issues: issuesArb,
    decisions: decisionsArb,
    systems: systemsArb,
    role: roleArb,
    practiceMode: fc.boolean(),
  })
  .filter(({ phase, scorePresent, decisions }) => {
    // setup/briefing: no score, no open decisions
    if (phase === "setup" || phase === "briefing") {
      if (scorePresent) return false;
      if (decisions.length > 0) return false;
    }
    return true;
  })
  .map(({ phase, scorePresent, scoreRecord, events, issues, decisions, systems, role, practiceMode }) => ({
    phase,
    score: scorePresent ? scoreRecord : null,
    events,
    issues,
    decisions,
    systems,
    role,
    practiceMode,
  }));

// ── Snapshot builder ─────────────────────────────────────────────────

const EX_ID = 800;

const TIME = {
  play_time_ms: 120_000,
  real_time_ms: 120_000,
  factor: 1,
  paused: false,
};

export function buildSnapshot(state: PlayerState) {
  return {
    exercise_id: EX_ID,
    title: "Property Test Exercise",
    phase: state.phase,
    time: state.phase === "paused" ? { ...TIME, paused: true } : TIME,
    events: state.events,
    issues: state.issues,
    decisions: state.decisions,
    systems: state.systems,
    score: state.score,
  };
}

export function buildPlayerUrl(state: PlayerState): string {
  const participantId = `${state.role}-prop`;
  const base = `/player?exerciseId=${EX_ID}&participantId=${participantId}&role=${state.role}`;
  return state.practiceMode ? `${base}&practiceMode=true` : base;
}

export { EX_ID };
