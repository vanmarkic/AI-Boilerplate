import { type HTMLAttributes, type ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children?: ReactNode;
}

export function Card({ title, className, children, ...props }: CardProps) {
  return (
    <div className={className ? `card ${className}` : 'card'} {...props}>
      {title && <h3 className="card-title">{title}</h3>}
      <div className="card-content">{children}</div>
    </div>
  );
}
