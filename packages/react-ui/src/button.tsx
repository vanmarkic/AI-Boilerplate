import { type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'default' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children?: ReactNode;
}

export function Button({
  variant = 'default',
  size = 'default',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={className ? `btn ${className}` : 'btn'}
      data-variant={variant}
      data-size={size}
      {...props}
    >
      {children}
    </button>
  );
}
