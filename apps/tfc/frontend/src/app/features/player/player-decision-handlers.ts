import { DecisionApiService } from '../../core/decision-api.service';
import type { ActiveDecision } from '../../core/decision-api.service';
import { ExerciseStore } from '../../core/exercise.store';
import type { RoleRecommendation } from '../../shared/all-advisors-panel.component';

type SubmitEvent = { selectedOptions: string[]; freeText: string };

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
