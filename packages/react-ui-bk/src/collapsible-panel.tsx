import { type ReactNode } from 'react';
import { Collapsible } from '@aspect/react-headless';

export interface CollapsiblePanelProps {
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  header?: ReactNode;
  children?: ReactNode;
}

export function CollapsiblePanel({
  variant = 'default',
  size = 'default',
  open,
  defaultOpen,
  onOpenChange,
  disabled,
  header,
  children,
}: CollapsiblePanelProps) {
  return (
    <Collapsible.Root
      open={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      disabled={disabled}
      className="collapsible-panel"
      data-variant={variant}
      data-size={size}
    >
      <Collapsible.Trigger asChild>
        <button className="collapsible-panel-trigger" type="button">
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
        </button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <div className="collapsible-panel-content">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
