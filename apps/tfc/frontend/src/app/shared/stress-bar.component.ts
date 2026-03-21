import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

@Component({
  selector: "tfc-stress-bar",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "stress-bar",
    "[attr.data-severity]": "severity()",
  },
  template: `
    <span class="stress-bar__title">Stress</span>
    <span class="stress-bar__label" data-testid="stress-bar">{{ stress() }}</span>
    <div class="stress-bar__track">
      <div
        class="stress-bar__fill"
        [style.width.%]="fillPercent()"
      ></div>
    </div>
  `,
})
export class StressBarComponent {
  readonly stress = input(0);

  protected readonly severity = computed(() => {
    const s = this.stress();
    if (s <= 3) return "low";
    if (s <= 6) return "medium";
    return "high";
  });

  protected readonly fillPercent = computed(() => {
    return Math.min(this.stress() / 10, 1) * 100;
  });
}
