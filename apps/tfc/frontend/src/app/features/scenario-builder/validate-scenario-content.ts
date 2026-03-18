/**
 * Client-side validation for ScenarioContent, mirroring the backend
 * Pydantic ScenarioContent.validate_roles() rules.
 *
 * Returns an array of human-readable error strings (empty = valid).
 */
import type { ScenarioContent } from "../../core/scenario-api.service";

export function validateScenarioContent(content: ScenarioContent): string[] {
  const errors: string[] = [];

  const roles = content.roles ?? [];
  if (roles.length === 0) {
    errors.push("Scenario must define at least one role.");
  }

  const playerTypes = new Set(roles.map((r) => r.player_type));
  if (roles.length > 0 && !playerTypes.has("decision_maker")) {
    errors.push("At least one role must have player_type 'decision_maker'.");
  }

  const roleIds = new Set(roles.map((r) => r.id));
  for (const dt of content.decision_templates) {
    for (const rid of dt.target_roles ?? []) {
      if (!roleIds.has(rid)) {
        errors.push(
          `Decision template '${dt.id}' targets unknown role '${rid}'.`,
        );
      }
    }
  }

  return errors;
}
