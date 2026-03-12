import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';

@Component({
  selector: 'ui-dialog-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus],
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <div
      class="dialog-backdrop"
      aria-hidden="true"
      (click)="closed.emit()"
    ></div>

    <div
      cdkTrapFocus
      role="dialog"
      aria-modal="true"
      class="dialog-panel"
      [attr.data-variant]="variant()"
    >
      <div class="dialog-title">
        <ng-content select="[dialogTitle]" />
      </div>
      <div class="dialog-body">
        <ng-content />
      </div>
      <div class="dialog-footer">
        <ng-content select="[dialogFooter]" />
      </div>
    </div>
  `,
})
export class DialogPanelComponent {
  readonly variant = input<'default' | 'destructive'>('default');
  readonly closed = output();
}
