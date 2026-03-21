import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
} from "@angular/core";
import { DrawerPanelComponent } from "@aspect/ui";
import type { ActiveDecision } from "../core/decision-api.service";
import type { RoleDef } from "../core/scenario-api.service";

interface DecisionLogEntry {
  turnNumber: number;
  title: string;
  status: string;
  recommendations: { roleLabel: string; optionLabel: string }[];
  finalDecision: string[] | null;
}

@Component({
  selector: "tfc-logs-drawer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerPanelComponent],
  template: `
    <ui-drawer-panel side="right" [open]="open()" (closed)="open.set(false)">
      <h2 drawerTitle>Decision Log</h2>
      <div class="decision-log">
        @for (entry of decisionLog(); track entry.turnNumber) {
          <div class="decision-entry" [attr.data-status]="entry.status" data-testid="decision-entry">
            <div class="decision-header">
              <span class="decision-turn">Turn {{ entry.turnNumber }}</span>
              <span class="decision-title">{{ entry.title }}</span>
            </div>
            @if (entry.recommendations.length > 0) {
              <div class="decision-recommendations">
                @for (rec of entry.recommendations; track rec.roleLabel) {
                  <div class="decision-rec" data-testid="recommendation">
                    <span class="decision-rec__role">{{ rec.roleLabel }}</span>
                    <span class="decision-rec__arrow">&rarr;</span>
                    <span class="decision-rec__option">{{ rec.optionLabel }}</span>
                  </div>
                }
              </div>
            }
            @if (entry.finalDecision) {
              <div class="decision-final" data-testid="final-decision">
                <span class="decision-final__label">Final</span>
                <span class="decision-final__arrow">&rarr;</span>
                <span class="decision-final__option">{{ entry.finalDecision.join(', ') }}</span>
              </div>
            } @else {
              <div class="decision-pending">Awaiting decision...</div>
            }
          </div>
        } @empty {
          <p class="logs-empty">No decisions yet.</p>
        }
      </div>
    </ui-drawer-panel>
  `,
})
export class LogsDrawerComponent {
  readonly open = model(false);
  readonly decisions = input<ActiveDecision[]>([]);
  readonly roles = input<RoleDef[]>([]);

  protected decisionLog = computed<DecisionLogEntry[]>(() => {
    const decisions = this.decisions();
    const roles = this.roles();
    const roleMap = new Map(roles.map((r) => [r.id, r.label]));

    return decisions
      .slice()
      .sort((a, b) => a.opened_at_pt_ms - b.opened_at_pt_ms)
      .map((d, i) => this.toLogEntry(d, i + 1, roleMap));
  });

  private toLogEntry(
    d: ActiveDecision,
    turnNumber: number,
    roleMap: Map<string, string>,
  ): DecisionLogEntry {
    const optionMap = new Map(
      d.options.map((o) => [o.id, o.label]),
    );

    const recommendations = Object.entries(d.recommendations).map(
      ([key, optionId]) => {
        const roleId = key.includes(":") ? key.split(":")[1] : key;
        return {
          roleLabel: roleMap.get(roleId) ?? roleId,
          optionLabel: optionMap.get(optionId) ?? optionId,
        };
      },
    );

    const finalDecision =
      d.status === "closed" && d.selected_option_ids.length > 0
        ? d.selected_option_ids.map((id: string) => optionMap.get(id) ?? id)
        : null;

    return {
      turnNumber,
      title: d.title,
      status: d.status,
      recommendations,
      finalDecision,
    };
  }
}
