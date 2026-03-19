import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  computed,
} from "@angular/core";
import type { DecisionOption } from "../core/decision-api.service";

@Component({
  selector: "tfc-playing-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="playing-card"
      [class.playing-card--selected]="selected()"
      [class.playing-card--recommended]="recommended()"
      [class.playing-card--disabled]="disabled()"
      [disabled]="disabled()"
      (click)="clicked.emit()"
    >
      @if (option().role) {
        <span
          class="playing-card__role-badge"
          [attr.data-role]="option().role"
          >{{ roleAbbrev() }}</span
        >
      }
      <span class="playing-card__code">{{ option().id }}</span>
      <span class="playing-card__label">{{ option().label }}</span>
      <span
        class="playing-card__score"
        [attr.data-sign]="scoreSign()"
        >{{ scoreDisplay() }}</span
      >
      @if (recommended()) {
        <span class="playing-card__rec-badge">REC</span>
      }
    </button>
  `,
})
export class PlayingCardComponent {
  readonly option = input.required<DecisionOption>();
  readonly selected = input(false);
  readonly recommended = input(false);
  readonly disabled = input(false);
  readonly clicked = output();

  protected readonly roleAbbrev = computed(() => {
    const role = this.option().role;
    return role ? role.toUpperCase() : "";
  });

  protected readonly scoreSign = computed(() => {
    const score = this.option().score ?? 0;
    if (score > 0) return "positive";
    if (score < 0) return "negative";
    return "zero";
  });

  protected readonly scoreDisplay = computed(() => {
    const score = this.option().score ?? 0;
    if (score > 0) return `+${score}`;
    return `${score}`;
  });
}
