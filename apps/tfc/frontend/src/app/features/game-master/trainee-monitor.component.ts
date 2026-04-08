import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";
import { BadgeComponent } from "@aspect/ui";
import type { ParticipantPresence } from "../../core/exercise.store";
import type { ActiveDecision } from "../../core/decision-api.service";

type DecisionStatus = "pending" | "submitted" | "timed_out";

interface TraineeCard {
  id: string;
  displayName: string;
  role: string | null;
  connected: boolean;
  decisionStatuses: { decisionId: string; title: string; status: DecisionStatus }[];
}

@Component({
  selector: "tfc-trainee-monitor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  template: `
    <div class="trainee-monitor">
      @for (card of cards(); track card.id) {
        <div class="trainee-monitor__card">
          <div class="trainee-monitor__header">
            <span
              class="trainee-monitor__status-dot"
              [attr.data-connected]="card.connected"
            ></span>
            <span class="trainee-monitor__name">{{ card.displayName }}</span>
          </div>
          @if (card.role) {
            <ui-badge variant="secondary">{{ card.role }}</ui-badge>
          }
          @for (ds of card.decisionStatuses; track ds.decisionId) {
            <div class="trainee-monitor__decision">
              <span class="trainee-monitor__decision-title">{{ ds.title }}</span>
              <ui-badge [variant]="badgeVariant(ds.status)">{{ ds.status }}</ui-badge>
            </div>
          }
        </div>
      } @empty {
        <p class="trainee-monitor__empty">No participants connected.</p>
      }
    </div>
  `,
})
export class TraineeMonitorComponent {
  readonly participants = input<ParticipantPresence[]>([]);
  readonly decisions = input<ActiveDecision[]>([]);
  readonly recommendations = input<Record<string, Record<string, string>>>({});

  protected readonly cards = computed<TraineeCard[]>(() => {
    const participants = this.participants();
    const openDecisions = this.decisions().filter((d) => d.status === "open");

    return participants.map((p) => {
      const decisionStatuses = openDecisions
        .filter(
          (d) =>
            d.target_roles.length === 0 ||
            (p.role !== null && d.target_roles.includes(p.role)),
        )
        .map((d) => {
          let status: DecisionStatus = "pending";
          if (d.recommendations[p.id]) {
            status = "submitted";
          } else if (d.status === "timed_out") {
            status = "timed_out";
          }
          return { decisionId: d.id, title: d.title, status };
        });

      return {
        id: p.id,
        displayName: p.display_name,
        role: p.role,
        connected: p.connected,
        decisionStatuses,
      };
    });
  });

  protected badgeVariant(
    status: DecisionStatus,
  ): "default" | "secondary" | "destructive" {
    switch (status) {
      case "submitted":
        return "default";
      case "timed_out":
        return "destructive";
      default:
        return "secondary";
    }
  }
}
