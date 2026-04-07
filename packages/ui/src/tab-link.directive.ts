import { Directive, input } from '@angular/core';

@Directive({
  selector: 'a[uiTabLink]',
  host: {
    'class': 'tab-link',
    'role': 'tab',
    '[attr.aria-selected]': 'active() || null',
    '[attr.data-active]': 'active() || null',
  },
})
export class TabLinkDirective {
  readonly active = input(false);
}
