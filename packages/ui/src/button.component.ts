import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonDirective, type ButtonSize, type ButtonVariant } from './button.directive';

@Component({
  selector: 'ui-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonDirective],
  template: `
    <button
      uiButton
      [variant]="variant()"
      [size]="size()"
      [disabled]="disabled()"
      (click)="clicked.emit()"
    >
      <ng-content />
    </button>
  `,
  host: { class: 'inline-flex' },
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('default');
  readonly size = input<ButtonSize>('default');
  readonly disabled = input(false);
  readonly clicked = output();
}
