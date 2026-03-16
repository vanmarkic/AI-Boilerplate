import { Directive } from '@angular/core';

@Directive({
  selector: 'a[uiTabLink]',
  host: { class: 'tab-link' },
})
export class TabLinkDirective {}
