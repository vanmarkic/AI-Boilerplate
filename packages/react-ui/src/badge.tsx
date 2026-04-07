import { type HTMLAttributes, type ReactNode } from 'react';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children?: ReactNode;
}

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span className={className ? `badge ${className}` : 'badge'} data-variant={variant} {...props}>
      {children}
    </span>
  );
}
