import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  input,
  output,
  type TemplateRef,
} from "@angular/core";
import { NgTemplateOutlet, UpperCasePipe } from "@angular/common";
import { BadgeComponent } from "@aspect/ui";

@Component({
  selector: "tfc-board-column",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UpperCasePipe, NgTemplateOutlet, BadgeComponent],
  template: `
    <div class="board-column">
      <div class="board-column__header" (click)="headerClicked.emit()">
        <div>
          <span class="board-column__role-id">{{ roleId() | uppercase }}</span>
          <span class="board-column__role-label">{{ roleLabel() }}</span>
        </div>
        <ui-badge [variant]="badgeVariant()">{{ badgeLabel() }}</ui-badge>
      </div>

      <div class="board-column__intel">
        @if (intel()) {
          <div class="board-column__intel-text">{{ intel() }}</div>
        } @else {
          <div class="board-column__empty">Waiting for next turn...</div>
        }
      </div>

      <div class="board-column__decision">
        @if (decisionTpl(); as tpl) {
          <ng-container [ngTemplateOutlet]="tpl" />
        } @else {
          <div class="board-column__empty">No active decision</div>
        }
      </div>
    </div>
  `,
})
export class BoardColumnComponent {
  readonly roleId = input.required<string>();
  readonly roleLabel = input.required<string>();
  readonly intel = input<string | null>(null);
  readonly status = input<"intel" | "active" | "done">("intel");
  readonly expanded = input(false);

  readonly headerClicked = output<void>();

  readonly decisionTpl = contentChild<TemplateRef<unknown>>("decisionZone");

  readonly badgeVariant = computed<"default" | "secondary">(() => {
    return this.status() === "active" ? "default" : "secondary";
  });

  readonly badgeLabel = computed<string>(() => {
    const s = this.status();
    if (s === "intel") return "INTEL";
    if (s === "active") return "DECISION";
    return "DONE";
  });
}
