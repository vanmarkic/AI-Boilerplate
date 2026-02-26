import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { cn } from '../utils';

@Component({
  selector: 'app-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'role': 'button',
    '[class]': 'hostClasses()',
    '[attr.disabled]': 'disabled() || null',
    '(click)': '!disabled() && clicked.emit()',
  },
  template: `<ng-content />`,
})
export class ButtonComponent {
  readonly variant = input<'default' | 'destructive' | 'outline' | 'ghost'>('default');
  readonly size = input<'sm' | 'default' | 'lg'>('default');
  readonly disabled = input(false);
  readonly clicked = output<void>();

  private readonly variantClasses: Record<string, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };

  private readonly sizeClasses: Record<string, string> = {
    sm: 'h-8 px-3 text-xs',
    default: 'h-9 px-4 py-2 text-sm',
    lg: 'h-10 px-8 text-base',
  };

  protected readonly hostClasses = computed(() =>
    cn(
      'inline-flex items-center justify-center rounded-md font-medium',
      'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      'disabled:pointer-events-none disabled:opacity-50',
      this.variantClasses[this.variant()],
      this.sizeClasses[this.size()],
    )
  );
}
