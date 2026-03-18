import { describe, it, expect } from "vitest";
import type { ScenarioContent } from "../../core/scenario-api.service";
import { validateScenarioContent } from "./validate-scenario-content";

function makeContent(
  overrides: Partial<ScenarioContent> = {},
): ScenarioContent {
  return {
    phases: [],
    events: [],
    issues: [],
    decision_templates: [],
    default_time_factor: 1.0,
    roles: [{ id: "co", label: "CO", player_type: "decision_maker" }],
    ...overrides,
  };
}

describe("validateScenarioContent", () => {
  it("returns no errors for valid content", () => {
    expect(validateScenarioContent(makeContent())).toEqual([]);
  });

  it("rejects missing roles", () => {
    const errors = validateScenarioContent(makeContent({ roles: [] }));
    expect(errors).toContain("Scenario must define at least one role.");
  });

  it("rejects undefined roles", () => {
    const errors = validateScenarioContent(makeContent({ roles: undefined }));
    expect(errors).toContain("Scenario must define at least one role.");
  });

  it("rejects roles without a decision_maker", () => {
    const errors = validateScenarioContent(
      makeContent({
        roles: [{ id: "nav", label: "Nav", player_type: "advisor" }],
      }),
    );
    expect(errors).toContain(
      "At least one role must have player_type 'decision_maker'.",
    );
  });

  it("accepts multiple roles with one decision_maker", () => {
    const errors = validateScenarioContent(
      makeContent({
        roles: [
          { id: "co", label: "CO", player_type: "decision_maker" },
          { id: "nav", label: "Nav", player_type: "advisor" },
        ],
      }),
    );
    expect(errors).toEqual([]);
  });

  it("rejects decision template targeting unknown role", () => {
    const errors = validateScenarioContent(
      makeContent({
        decision_templates: [
          {
            id: "d1",
            title: "T",
            description: "",
            issue_id: "i1",
            question_type: "single_choice",
            options: [],
            completion_mode: "first_response",
            target_roles: ["nonexistent"],
          },
        ],
      }),
    );
    expect(errors).toContain(
      "Decision template 'd1' targets unknown role 'nonexistent'.",
    );
  });

  it("accepts decision template targeting valid role", () => {
    const errors = validateScenarioContent(
      makeContent({
        decision_templates: [
          {
            id: "d1",
            title: "T",
            description: "",
            issue_id: "i1",
            question_type: "single_choice",
            options: [],
            completion_mode: "first_response",
            target_roles: ["co"],
          },
        ],
      }),
    );
    expect(errors).toEqual([]);
  });

  it("accepts decision template with no target_roles", () => {
    const errors = validateScenarioContent(
      makeContent({
        decision_templates: [
          {
            id: "d1",
            title: "T",
            description: "",
            issue_id: "i1",
            question_type: "single_choice",
            options: [],
            completion_mode: "first_response",
          },
        ],
      }),
    );
    expect(errors).toEqual([]);
  });

  it("returns multiple errors at once", () => {
    const errors = validateScenarioContent(
      makeContent({
        roles: [],
        decision_templates: [
          {
            id: "d1",
            title: "T",
            description: "",
            issue_id: "i1",
            question_type: "single_choice",
            options: [],
            completion_mode: "first_response",
            target_roles: ["ghost"],
          },
        ],
      }),
    );
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});
