import { Component, input } from '@angular/core';

@Component({
  selector: 'asp-badge',
  host: {
    'class': 'badge',
    '[attr.data-variant]': 'variant()',
  },
  template: `<ng-content />`,
})
export class BadgeComponent {
  readonly variant = input<'default' | 'secondary' | 'destructive' | 'outline'>('default');
}
