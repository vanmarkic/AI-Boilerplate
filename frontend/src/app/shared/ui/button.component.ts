import { Component, computed, input, output } from '@angular/core';
import { cn } from '../utils';

@Component({
  selector: 'app-button',
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
  readonly clicked = output();

  private readonly variantClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  } as const;

  private readonly sizeClasses = {
    sm: 'h-control-sm px-sm text-xs',
    default: 'h-control-md px-md py-xs text-sm',
    lg: 'h-control-lg px-xl text-base',
  } as const;

  protected readonly hostClasses = computed(() =>
    cn(
      'control-base',
      this.variantClasses[this.variant()],
      this.sizeClasses[this.size()],
    )
  );
}
