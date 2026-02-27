import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  host: { 'class': 'block rounded-lg border border-border bg-card p-md shadow-sm' },
  template: `
    @if (title()) {
      <h3 class="text-lg font-semibold text-card-foreground mb-sm">{{ title() }}</h3>
    }
    <div class="text-sm text-muted-foreground">
      <ng-content />
    </div>
  `,
})
export class CardComponent {
  readonly title = input('');
}
