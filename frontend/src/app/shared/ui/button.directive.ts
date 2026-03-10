import { computed, Directive, input } from '@angular/core';
import { cn } from '../utils';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'default' | 'lg';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-control-sm px-sm text-xs gap-xs',
  default: 'h-control-md px-md text-sm gap-sm',
  lg: 'h-control-lg px-lg text-base gap-sm',
};

const BASE_CLASSES = [
  'inline-flex items-center justify-center',
  'rounded-[--radius-md] font-medium',
  'transition-colors duration-fast',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'disabled:pointer-events-none disabled:opacity-50',
  'cursor-pointer',
].join(' ');

@Directive({
  selector: 'button[appButton], a[appButton]',
  host: {
    '[class]': 'hostClasses()',
  },
})
export class ButtonDirective {
  readonly variant = input<ButtonVariant>('default');
  readonly size = input<ButtonSize>('default');

  protected readonly hostClasses = computed(() =>
    cn(BASE_CLASSES, VARIANT_CLASSES[this.variant()], SIZE_CLASSES[this.size()]),
  );
}
