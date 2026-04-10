import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { BadgeComponent, ButtonDirective } from '@aspect/ui';
import type { ParticipantPresence } from '../../core/exercise.store';
import type { ActiveDecision } from '../../core/decision-api.service';

@Component({
  selector: 'tfc-trainee-monitor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonDirective],
  template: `
    <div class="trainee-monitor__grid">
      @for (p of participants(); track p.id) {
        <div class="trainee-card">
          <div class="trainee-card__header">
            <span class="presence-dot"
              [class.presence-dot--connected]="p.connected"
              [class.presence-dot--disconnected]="!p.connected"></span>
            <span class="trainee-card__name">{{ p.display_name }}</span>
            <ui-badge variant="secondary">{{ p.role }}</ui-badge>
          </div>

          @for (d of decisionsFor(p.id); track d.id) {
            <div class="trainee-card__decision">
              <span class="text-xs text-muted-foreground">{{ d.title }}</span>
              <ui-badge [variant]="decisionStatusVariant(d)">
                {{ d.status }}
              </ui-badge>
              @if (d.completion_mode === 'gm_closes') {
                <button uiButton variant="outline" size="sm"
                  (click)="closeDecision.emit(d.id)">
                  Validate &amp; Close
                </button>
              }
            </div>
          }

          @if (decisionsFor(p.id).length === 0) {
            <span class="text-xs text-muted-foreground">No open decisions</span>
          }
        </div>
      } @empty {
        <p class="text-muted-foreground text-sm">No participants connected.</p>
      }
    </div>
  `,
})
export class TraineeMonitorComponent {
  readonly participants = input<ParticipantPresence[]>([]);
  readonly decisions = input<ActiveDecision[]>([]);

  readonly closeDecision = output<string>();

  protected decisionsFor(participantId: string): ActiveDecision[] {
    return this.decisions().filter(
      (d) => d.target_roles.length === 0 || this.participantRoleMatches(participantId, d),
    );
  }

  private participantRoleMatches(participantId: string, decision: ActiveDecision): boolean {
    const participant = this.participants().find((p) => p.id === participantId);
    if (!participant) { return false; }
    return decision.target_roles.length === 0 || decision.target_roles.includes(participant.role);
  }

  protected decisionStatusVariant(decision: ActiveDecision): 'default' | 'secondary' | 'destructive' {
    if (decision.status === 'open') { return 'default'; }
    if (decision.status === 'timed_out') { return 'destructive'; }
    return 'secondary';
  }
}
