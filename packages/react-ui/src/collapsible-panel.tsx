import { type ReactNode } from 'react';

export interface CollapsiblePanelProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  open?: boolean;
  header?: ReactNode;
  children?: ReactNode;
}

export function CollapsiblePanel({
  variant = 'default',
  size = 'default',
  open = false,
  header,
  children,
}: CollapsiblePanelProps) {
  return (
    <details
      className="collapsible-panel"
      data-variant={variant}
      data-size={size}
      open={open}
    >
      <summary className="collapsible-panel-trigger">
        {header}
        <svg
          className="collapsible-panel-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </summary>
      <div className="collapsible-panel-content">{children}</div>
    </details>
  );
}
