import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'tfc-speed-display',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'class': 'exercise-speed' },
  template: `
    <span class="exercise-speed__label">Speed</span>
    <ng-content />
    <span class="exercise-speed__value">{{ value() }}x</span>
  `,
})
export class SpeedDisplayComponent {
  readonly value = input.required<number>();
}
