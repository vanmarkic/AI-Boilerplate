import { describe, it, expect } from "vitest";
import type { ActiveDecision } from "../../core/decision-api.service";
import type { RoleDef } from "../../core/scenario-api.service";
import type { EventSnapshot } from "../../core/generated/state-changes.types";
import { buildRoleCards, extractRecRoleId } from "./role-card.types";

// ── Factories ────────────────────────────────────────────

function makeRole(overrides: Partial<RoleDef> = {}): RoleDef {
  return { id: "ops", label: "OPS", player_type: "advisor", ...overrides };
}

function makeEvent(overrides: Partial<EventSnapshot> = {}): EventSnapshot {
  return {
    id: "e1",
    title: "Event 1",
    description: "",
    event_type: "operational",
    scheduled_pt_ms: 0,
    duration_ms: 30_000,
    dependencies: [],
    triggered_issues: [],
    lifecycle: "running",
    started_at_pt_ms: 0,
    completed_at_pt_ms: null,
    target_roles: [],
    role_descriptions: {},
    ...overrides,
  };
}

function makeDecision(overrides: Partial<ActiveDecision> = {}): ActiveDecision {
  return {
    id: "d1",
    event_id: "e1",
    issue_id: null,
    title: "Decision 1",
    description: "Choose wisely",
    question_type: "single_choice",
    options: [
      { id: "o1", label: "Option A", score: 10, role: null },
      { id: "o2", label: "Option B", score: 5, role: null },
    ],
    completion_mode: "first_response",
    target_roles: ["ops"],
    timeout_ms: 60_000,
    max_selections: 1,
    status: "open",
    opened_at_pt_ms: 1000,
    closed_at_pt_ms: null,
    recommendations: {},
    selected_option_ids: [],
    ...overrides,
  };
}

// ── extractRecRoleId ─────────────────────────────────────

describe("extractRecRoleId", () => {
  it("extracts roleId from participantId:roleId format", () => {
    expect(extractRecRoleId("p1:ops")).toBe("ops");
  });

  it("returns bare key when no colon", () => {
    expect(extractRecRoleId("ops")).toBe("ops");
  });

  it("handles multiple colons (takes after first)", () => {
    expect(extractRecRoleId("p1:ops:extra")).toBe("ops:extra");
  });
});

// ── buildRoleCards ───────────────────────────────────────

describe("buildRoleCards", () => {
  it("returns empty array when no event and no decision", () => {
    const roles = [makeRole()];
    expect(buildRoleCards(roles, null, null, new Set(), true)).toEqual([]);
  });

  it("builds intel-only card from event role_descriptions", () => {
    const roles = [makeRole({ id: "ops", label: "OPS" })];
    const event = makeEvent({ role_descriptions: { ops: "Coordinate logistics" } });
    const cards = buildRoleCards(roles, event, null, new Set(), true);

    expect(cards).toHaveLength(1);
    expect(cards[0].roleId).toBe("ops");
    expect(cards[0].intel).toBe("Coordinate logistics");
    expect(cards[0].status).toBe("intel");
    expect(cards[0].decision).toBeNull();
  });

  it("builds active card when role is in decision target_roles", () => {
    const roles = [makeRole({ id: "ops" })];
    const decision = makeDecision({ target_roles: ["ops"] });
    const cards = buildRoleCards(roles, null, decision, new Set(), true);

    expect(cards).toHaveLength(1);
    expect(cards[0].status).toBe("active");
    expect(cards[0].decision).toBe(decision);
  });

  it("marks card as done when role is in submittedRoles", () => {
    const roles = [makeRole({ id: "ops" })];
    const decision = makeDecision({ target_roles: ["ops"] });
    const submitted = new Set(["ops"]);
    const cards = buildRoleCards(roles, null, decision, submitted, true);

    expect(cards).toHaveLength(1);
    expect(cards[0].status).toBe("done");
  });

  it("filters out decision_maker when showDecisionMaker is false", () => {
    const roles = [
      makeRole({ id: "co", label: "CO", player_type: "decision_maker" }),
      makeRole({ id: "ops", label: "OPS", player_type: "advisor" }),
    ];
    const decision = makeDecision({ target_roles: ["co", "ops"] });
    const cards = buildRoleCards(roles, null, decision, new Set(), false);

    expect(cards).toHaveLength(1);
    expect(cards[0].roleId).toBe("ops");
  });

  it("includes decision_maker when showDecisionMaker is true", () => {
    const roles = [
      makeRole({ id: "co", label: "CO", player_type: "decision_maker" }),
      makeRole({ id: "ops", label: "OPS", player_type: "advisor" }),
    ];
    const decision = makeDecision({ target_roles: ["co", "ops"] });
    const cards = buildRoleCards(roles, null, decision, new Set(), true);

    expect(cards).toHaveLength(2);
    expect(cards.map((c) => c.roleId)).toEqual(["co", "ops"]);
  });

  it("excludes roles with no intel and no decision", () => {
    const roles = [
      makeRole({ id: "ops" }),
      makeRole({ id: "intel", label: "INTEL" }),
    ];
    const event = makeEvent({ role_descriptions: { ops: "Brief" } });
    const cards = buildRoleCards(roles, event, null, new Set(), true);

    expect(cards).toHaveLength(1);
    expect(cards[0].roleId).toBe("ops");
  });

  // ── Advisor recs on decision_maker card ──

  it("populates advisorRecs on decision_maker card", () => {
    const roles = [
      makeRole({ id: "co", label: "CO", player_type: "decision_maker" }),
      makeRole({ id: "ops", label: "OPS", player_type: "advisor" }),
    ];
    const decision = makeDecision({
      target_roles: ["co", "ops"],
      recommendations: { "p1:ops": "o1" },
    });
    const cards = buildRoleCards(roles, null, decision, new Set(), true);
    const coCard = cards.find((c) => c.roleId === "co")!;

    expect(coCard.advisorRecs).toHaveLength(1);
    expect(coCard.advisorRecs[0].roleId).toBe("ops");
    expect(coCard.advisorRecs[0].selection).toBe("Option A");
  });

  it("shows pending advisor rec when no recommendation yet", () => {
    const roles = [
      makeRole({ id: "co", label: "CO", player_type: "decision_maker" }),
      makeRole({ id: "ops", label: "OPS", player_type: "advisor" }),
    ];
    const decision = makeDecision({
      target_roles: ["co", "ops"],
      recommendations: {},
    });
    const cards = buildRoleCards(roles, null, decision, new Set(), true);
    const coCard = cards.find((c) => c.roleId === "co")!;

    expect(coCard.advisorRecs[0].selection).toBeNull();
  });

  it("handles bare roleId keys in recommendations (legacy format)", () => {
    const roles = [
      makeRole({ id: "co", label: "CO", player_type: "decision_maker" }),
      makeRole({ id: "ops", label: "OPS", player_type: "advisor" }),
    ];
    const decision = makeDecision({
      target_roles: ["co", "ops"],
      recommendations: { ops: "o2" },
    });
    const cards = buildRoleCards(roles, null, decision, new Set(), true);
    const coCard = cards.find((c) => c.roleId === "co")!;

    expect(coCard.advisorRecs[0].selection).toBe("Option B");
  });

  it("does not populate advisorRecs on advisor cards", () => {
    const roles = [
      makeRole({ id: "co", label: "CO", player_type: "decision_maker" }),
      makeRole({ id: "ops", label: "OPS", player_type: "advisor" }),
    ];
    const decision = makeDecision({ target_roles: ["co", "ops"] });
    const cards = buildRoleCards(roles, null, decision, new Set(), true);
    const opsCard = cards.find((c) => c.roleId === "ops")!;

    expect(opsCard.advisorRecs).toEqual([]);
  });

  it("falls back option ID as label when option not found", () => {
    const roles = [
      makeRole({ id: "co", label: "CO", player_type: "decision_maker" }),
      makeRole({ id: "ops", label: "OPS", player_type: "advisor" }),
    ];
    const decision = makeDecision({
      target_roles: ["co", "ops"],
      recommendations: { "p1:ops": "unknown-opt" },
    });
    const cards = buildRoleCards(roles, null, decision, new Set(), true);
    const coCard = cards.find((c) => c.roleId === "co")!;

    expect(coCard.advisorRecs[0].selection).toBe("unknown-opt");
  });
});
