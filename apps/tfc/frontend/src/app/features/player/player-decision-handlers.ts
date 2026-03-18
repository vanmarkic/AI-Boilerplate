import type { WritableSignal } from '@angular/core';
import type { AdvisorRecommendation } from '../../shared/advisor-bubbles.component';
import { DecisionApiService } from '../../core/decision-api.service';
import type { ActiveDecision } from '../../core/decision-api.service';
import { ExerciseStore } from '../../core/exercise.store';
import type { RoleRecommendation } from '../../shared/all-advisors-panel.component';

type SubmitEvent = { selectedOptions: string[]; freeText: string };

export function buildAdvisorRecs(
  decision: ActiveDecision,
  roles: { id: string; label: string }[],
): AdvisorRecommendation[] {
  const recs = decision.recommendations || {};
  return Object.entries(recs).map(([key, oid]) => {
    const colonIdx = key.indexOf(':');
    if (colonIdx !== -1) {
      const roleId = key.slice(colonIdx + 1);
      const roleInfo = roles.find((r) => r.id === roleId);
      return { participantId: key, participantName: roleInfo?.label ?? roleId, optionId: oid };
    }
    return { participantId: key, participantName: key, optionId: oid };
  });
}

export function getScenarioAdvisorRoles(
  roles: { id: string; label: string; player_type: string }[],
): { id: string; label: string }[] {
  return roles.filter((r) => r.player_type === 'advisor');
}

export function submitRecommendation(
  api: DecisionApiService,
  exerciseId: number,
  decision: ActiveDecision,
  participantId: string,
  event: SubmitEvent,
): void {
  const optionId = event.selectedOptions[0];
  if (!optionId) return;
  api.submitRecommendation(exerciseId, decision.id, optionId, participantId).subscribe();
}

export function submitRoleRecommendation(
  api: DecisionApiService,
  exerciseId: number,
  decision: ActiveDecision,
  participantId: string,
  rec: RoleRecommendation,
): void {
  const optionId = rec.selectedOptions[0];
  if (!optionId) return;
  api.submitRecommendation(
    exerciseId, decision.id, optionId, participantId, rec.roleId,
  ).subscribe();
}

export function submitDecision(
  api: DecisionApiService,
  store: InstanceType<typeof ExerciseStore>,
  exerciseId: number,
  decision: ActiveDecision,
  participantId: string,
  event: SubmitEvent,
): void {
  api.submitResponse(Number(decision.id), {
    participant_id: participantId,
    participant_name: participantId,
    selected_options: event.selectedOptions,
    free_text: event.freeText || null,
  }).subscribe();
  api.closeEngineDecision(exerciseId, decision.id, event.selectedOptions).subscribe({
    next: () => store.closeDecision(decision.id),
  });
}

export function resolvePlayerRole(
  ctx: { roles?: { id: string; label: string; player_type: string }[] },
  role: string,
  gameMode: string,
  store: InstanceType<typeof ExerciseStore>,
  roleLabel: WritableSignal<string>,
): void {
  store.setContext(ctx);
  if (!gameMode && ctx.roles && ctx.roles.length > 0) {
    store.setGameMode('simple_collaborative');
  }
  const roleInfo = ctx.roles?.find((r) => r.id === role);
  if (roleInfo) {
    store.setPlayerType(roleInfo.player_type);
    roleLabel.set(roleInfo.label);
  } else if (role === 'all_advisors') {
    store.setPlayerType('advisor');
    roleLabel.set('All Advisors');
  } else if (role === 'decision_maker') {
    store.setPlayerType('decision_maker');
    roleLabel.set('Decision Maker');
  }
}
