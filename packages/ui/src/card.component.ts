import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ui-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'card' },
  template: `
    @if (title()) {
      <h3 class="card-title">{{ title() }}</h3>
    }
    <div class="card-content">
      <ng-content />
    </div>
  `,
})
export class CardComponent {
  readonly title = input('');
}
