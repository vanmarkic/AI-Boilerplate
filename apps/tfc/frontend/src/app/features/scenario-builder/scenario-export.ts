import type { ScenarioContent } from "../../core/scenario-api.service";
import type { DomainConfigResponse } from "../../core/domain-config-api.service";

export interface ScenarioExport {
  _llm_schema?: LlmSchema;
  title: string;
  description: string;
  content: ScenarioContent;
}

interface LlmSchema {
  _instructions: string;
  foundation: {
    roles: { id: string; label: string }[];
    systems: { id: string; label: string; category: string }[];
    warfare_domains: { id: string; label: string }[];
    blue_card_catalog: {
      id: string;
      title: string;
      targets_system: boolean;
    }[];
  };
  turn_structure: Record<string, string>;
  enums: Record<string, string[]>;
}

function buildLlmSchema(domain: DomainConfigResponse): LlmSchema {
  return {
    _instructions: [
      "This JSON defines a TFC (Training Flow Control) scenario.",
      "To generate a new scenario, keep the _llm_schema and modify title, description, and content.",
      "The 'content.turns' array is the primary authoring structure — one entry per game turn.",
      "Each turn contains: injects (per-role situation text), available_cards (blue cards the CO can pick), and consequences (stress/system/domain effects).",
      "Card IDs in available_cards must reference cards from foundation.blue_card_catalog.",
      "Role IDs in injects.target_roles must reference roles from foundation.roles.",
      "System IDs in system_effects must reference systems from foundation.systems.",
      "Domain IDs in domain_effects must reference domains from foundation.warfare_domains.",
      "Turn 0 should have has_decisions=false (pre-mission briefing, no blue cards).",
      "Turns 1+ should have has_decisions=true with available_cards defining the blue card options.",
      "Each card in available_cards has a per-turn score (points for picking it) and stress_delta.",
      "best_path and acceptable_path are facilitator notes documenting optimal/acceptable play.",
    ].join(" "),
    foundation: {
      roles: domain.roles.map((r) => ({ id: r.id, label: r.label })),
      systems: domain.systems.map((s) => ({
        id: s.id,
        label: s.label,
        category: s.category,
      })),
      warfare_domains: domain.warfare_domains.map((w) => ({
        id: w.id,
        label: w.label,
      })),
      blue_card_catalog: domain.blue_card_catalog.map((c) => ({
        id: c.id,
        title: c.title,
        targets_system: c.targets_system,
      })),
    },
    turn_structure: {
      turn_index: "number — auto-incremented, 0-based",
      title: "string — short turn title (e.g., 'Steady Approach')",
      facilitator_prompt:
        "string|null — what the facilitator reads aloud to players",
      has_decisions:
        "boolean — false for briefing turns (Turn 0), true for decision turns",
      duration_ms:
        "number|null — only for non-decision turns (e.g., 900000 = 15 min)",
      "injects[]":
        "array of {target_roles: string[], text: string} — per-role situation updates",
      "available_cards[]":
        "array of {card_id: string, score: number, stress_delta: number} — blue cards available this turn",
      max_selections: "number — how many cards the CO can pick (default: 2)",
      base_stress_delta:
        "number — stress change applied at turn start regardless of card choice",
      "system_effects_on_start[]":
        "array of {system_id, operational_state: green|yellow|red, power_state: boolean} — board changes at turn start",
      "domain_effects_on_start[]":
        "array of {domain_id, threat_level: green|red} — domain threat changes at turn start",
      best_path:
        "{card_ids: string[], notes: string}|null — optimal card combination + why",
      acceptable_path:
        "{card_ids: string[], notes: string}|null — suboptimal but valid alternative",
      design_notes:
        "string — why this turn exists, what it teaches (facilitator-only)",
    },
    enums: {
      operational_state: ["green", "yellow", "red"],
      threat_level: ["green", "red"],
      game_mode: ["classic", "simple_collaborative"],
      player_type: ["decision_maker", "advisor"],
      system_category: ["system", "weapon"],
    },
  };
}

export function exportScenarioToJson(
  title: string,
  description: string,
  content: ScenarioContent,
  domain?: DomainConfigResponse,
): Blob {
  const data: ScenarioExport = { title, description, content };
  if (domain) {
    data._llm_schema = buildLlmSchema(domain);
  }
  return new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
}

export function parseScenarioImport(jsonString: string): ScenarioExport | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowed by typeof check above
  const obj = parsed as Record<string, unknown>;
  if (typeof obj["title"] !== "string") return null;
  if (typeof obj["content"] !== "object" || obj["content"] === null)
    return null;
  return {
    title: obj["title"],
    description:
      typeof obj["description"] === "string" ? obj["description"] : "",
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- validated above
    content: obj["content"] as ScenarioContent,
  };
}
