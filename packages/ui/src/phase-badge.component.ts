import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-phase-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'exercise-phase',
    '[attr.data-phase]': 'phase()',
  },
  template: `{{ phase() }}`,
})
export class PhaseBadgeComponent {
  readonly phase = input.required<string>();
}
