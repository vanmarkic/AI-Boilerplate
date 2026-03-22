import { describe, it, expect } from "vitest";
import { exportScenarioToJson, parseScenarioImport } from "./scenario-export";
import type { ScenarioContent } from "../../core/scenario-api.service";

const sampleContent: ScenarioContent = {
  phases: [],
  events: [
    {
      id: "evt-1",
      title: "Test Event",
      description: "",
      event_type: "informational",
      scheduled_pt_ms: 60000,
      duration_ms: null,
      dependencies: [],
      triggered_issues: [],
      target_roles: [],
      role_descriptions: {},
    },
  ],
  issues: [],
  decision_templates: [],
  default_time_factor: 1.0,
  roles: [{ id: "co", label: "CO", player_type: "decision_maker" }],
};

describe("exportScenarioToJson", () => {
  it("produces a valid JSON blob", () => {
    const blob = exportScenarioToJson("Test", "Desc", sampleContent);
    expect(blob.type).toBe("application/json");
  });
});

describe("parseScenarioImport", () => {
  it("round-trips through export and import", () => {
    const json = JSON.stringify(
      { title: "Test", description: "Desc", content: sampleContent },
      null,
      2,
    );
    const result = parseScenarioImport(json);
    expect(result).not.toBeNull();
    expect(result!.title).toBe("Test");
    expect(result!.description).toBe("Desc");
    expect(result!.content.events).toHaveLength(1);
  });

  it("rejects invalid JSON", () => {
    expect(parseScenarioImport("not json")).toBeNull();
  });

  it("rejects JSON without title", () => {
    expect(parseScenarioImport(JSON.stringify({ content: {} }))).toBeNull();
  });

  it("rejects JSON without content", () => {
    expect(parseScenarioImport(JSON.stringify({ title: "T" }))).toBeNull();
  });

  it("defaults missing description to empty string", () => {
    const json = JSON.stringify({ title: "T", content: sampleContent });
    const result = parseScenarioImport(json);
    expect(result).not.toBeNull();
    expect(result!.description).toBe("");
  });
});
