// apps/tfc/frontend/src/app/features/player/role-card.types.ts
import type { ActiveDecision } from "../../core/decision-api.service";
import type { RoleDef } from "../../core/scenario-api.service";
import type { EventSnapshot } from "../../core/generated/state-changes.types";

export interface AdvisorRec {
  roleId: string;
  roleLabel: string;
  selection: string | null; // option label, or null if pending
}

export interface RoleCard {
  roleId: string;
  roleLabel: string;
  playerType: "decision_maker" | "advisor";
  intel: string | null;
  decision: ActiveDecision | null;
  status: "intel" | "active" | "done";
  advisorRecs: AdvisorRec[];
}

export function buildRoleCards(
  roles: RoleDef[],
  event: EventSnapshot | null,
  decision: ActiveDecision | null,
  submittedRoles: Set<string>,
  showDecisionMaker: boolean,
): RoleCard[] {
  if (!event && !decision) return [];
  const roleDescs = event?.role_descriptions ?? {};
  const targetRoles = decision?.target_roles ?? [];

  return roles
    .filter((role) => {
      if (role.player_type === "decision_maker" && !showDecisionMaker)
        return false;
      const hasIntel = roleDescs[role.id] != null;
      const hasDecision = targetRoles.includes(role.id);
      return hasIntel || hasDecision;
    })
    .map((role) => {
      const hasDecision = targetRoles.includes(role.id);
      const isDone = hasDecision && submittedRoles.has(role.id);
      const advisorRecs: AdvisorRec[] = [];

      if (role.player_type === "decision_maker" && decision) {
        const advisorTargets = targetRoles.filter((rid) => rid !== role.id);
        for (const advisorRoleId of advisorTargets) {
          const advisorRole = roles.find((r) => r.id === advisorRoleId);
          const recEntry = Object.entries(
            decision.recommendations || {},
          ).find(([key]) => {
            const colonIdx = key.indexOf(":");
            return colonIdx !== -1
              ? key.slice(colonIdx + 1) === advisorRoleId
              : key === advisorRoleId;
          });
          const optionId = recEntry?.[1] ?? null;
          const optionLabel = optionId
            ? (decision.options.find((o) => o.id === optionId)?.label ?? optionId)
            : null;
          advisorRecs.push({
            roleId: advisorRoleId,
            roleLabel: advisorRole?.label ?? advisorRoleId,
            selection: optionLabel,
          });
        }
      }

      return {
        roleId: role.id,
        roleLabel: role.label,
        playerType: role.player_type as "decision_maker" | "advisor",
        intel: roleDescs[role.id] ?? null,
        decision: hasDecision ? decision : null,
        status: hasDecision ? (isDone ? "done" : "active") : "intel",
        advisorRecs,
      } satisfies RoleCard;
    });
}
