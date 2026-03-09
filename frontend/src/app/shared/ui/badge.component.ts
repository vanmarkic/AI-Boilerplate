import { Component, computed, input } from '@angular/core';
import { cn } from '../utils';

@Component({
  selector: 'app-badge',
  host: { '[class]': 'hostClasses()' },
  template: `<ng-content />`,
})
export class BadgeComponent {
  readonly variant = input<'default' | 'secondary' | 'destructive' | 'outline'>('default');

  private readonly variantClasses: Record<string, string> = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
    outline: 'border border-border text-foreground',
  };

  protected readonly hostClasses = computed(() =>
    cn(
      'inline-flex items-center rounded-[--radius-sm] px-sm py-[2px] text-xs font-medium tracking-wide uppercase',
      this.variantClasses[this.variant()],
    )
  );
}
