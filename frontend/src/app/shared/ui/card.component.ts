import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
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
