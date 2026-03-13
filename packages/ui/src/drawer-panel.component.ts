import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';

export type DrawerSide = 'left' | 'right';

@Component({
  selector: 'ui-drawer-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus],
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    @if (open()) {
      <div
        class="drawer-backdrop"
        aria-hidden="true"
        (click)="closed.emit()"
      ></div>
    }

    <div
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="open()"
      role="dialog"
      aria-modal="true"
      class="drawer-panel"
      [attr.data-side]="side()"
      [attr.data-state]="open() ? 'open' : 'closed'"
    >
      <div class="drawer-header">
        <ng-content select="[drawerTitle]" />
        <button
          class="drawer-close-btn"
          aria-label="Close drawer"
          (click)="closed.emit()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            width="18"
            height="18"
            aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div class="drawer-body">
        <ng-content />
      </div>
    </div>
  `,
})
export class DrawerPanelComponent {
  readonly side = input<DrawerSide>('right');
  readonly open = input(false);
  readonly closed = output();
}
