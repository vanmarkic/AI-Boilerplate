import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-clock-display',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'exercise-clock' },
  template: `
    <span class="exercise-clock__label">{{ label() }}</span>
    <span class="exercise-clock__value">{{ value() }}</span>
  `,
})
export class ClockDisplayComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
}
