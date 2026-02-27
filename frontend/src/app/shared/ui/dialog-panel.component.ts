import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { cn } from '../utils';

@Component({
  selector: 'app-dialog-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus],
  host: {
    '(keydown.escape)': 'closed.emit()',
  },
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 z-50 bg-black/50"
      aria-hidden="true"
      (click)="closed.emit()"
    ></div>

    <!-- Panel -->
    <div
      cdkTrapFocus
      role="dialog"
      aria-modal="true"
      [class]="panelClasses()"
    >
      <div class="mb-sm font-semibold text-foreground">
        <ng-content select="[dialogTitle]" />
      </div>
      <div class="text-sm text-muted-foreground">
        <ng-content />
      </div>
      <div class="mt-md flex justify-end gap-sm">
        <ng-content select="[dialogFooter]" />
      </div>
    </div>
  `,
})
export class DialogPanelComponent {
  readonly variant = input<'default' | 'destructive'>('default');
  readonly closed = output<void>();

  private readonly variantClasses: Record<string, string> = {
    default: 'border-border',
    destructive: 'border-destructive',
  };

  protected readonly panelClasses = computed(() =>
    cn(
      'fixed left-1/2 top-1/2 z-50 w-full max-w-md',
      '-translate-x-1/2 -translate-y-1/2',
      'rounded-lg border bg-card p-lg shadow-lg',
      this.variantClasses[this.variant()],
    ),
  );
}
