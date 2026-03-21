import type { ScenarioContent } from "../../core/scenario-api.service";

export interface ScenarioExport {
  title: string;
  description: string;
  content: ScenarioContent;
}

export function exportScenarioToJson(
  title: string,
  description: string,
  content: ScenarioContent,
): Blob {
  const data: ScenarioExport = { title, description, content };
  return new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
}

export function parseScenarioImport(
  jsonString: string,
): ScenarioExport | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  if (typeof obj["title"] !== "string") return null;
  if (typeof obj["content"] !== "object" || obj["content"] === null) return null;
  return {
    title: obj["title"],
    description: typeof obj["description"] === "string" ? obj["description"] : "",
    content: obj["content"] as ScenarioContent,
  };
}
