import { type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  disabled?: boolean;
  children?: ReactNode;
}

export function Card({ title, disabled, className, children, ...props }: CardProps) {
  return (
    <div
      className={className ? `card ${className}` : 'card'}
      data-disabled={disabled || undefined}
      {...props}
    >
      {title && <h3 className="card-title">{title}</h3>}
      <div className="card-content">{children}</div>
    </div>
  );
}
