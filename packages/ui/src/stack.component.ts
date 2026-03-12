import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type StackDirection = 'vertical' | 'horizontal';
export type StackGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';
export type StackJustify = 'start' | 'center' | 'end' | 'between';

@Component({
  selector: 'ui-stack',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'stack',
    '[attr.data-direction]': 'direction()',
    '[attr.data-gap]': 'gap()',
    '[attr.data-align]': 'align()',
    '[attr.data-justify]': 'justify()',
  },
  template: `<ng-content />`,
})
export class StackComponent {
  readonly direction = input<StackDirection>('vertical');
  readonly gap = input<StackGap>('md');
  readonly align = input<StackAlign | null>(null);
  readonly justify = input<StackJustify | null>(null);
}
