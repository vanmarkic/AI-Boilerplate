import { Directive, input } from '@angular/core';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'default' | 'lg';

@Directive({
  selector: 'button[uiButton], a[uiButton]',
  host: {
    'class': 'btn',
    '[attr.data-variant]': 'variant()',
    '[attr.data-size]': 'size()',
  },
})
export class ButtonDirective {
  readonly variant = input<ButtonVariant>('default');
  readonly size = input<ButtonSize>('default');
}
