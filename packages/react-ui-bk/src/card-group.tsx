import { type HTMLAttributes, type ReactNode, useState } from 'react';

export type CardGroupMode = 'aggregated' | 'disaggregated';

export interface CardGroupProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  count?: number;
  mode?: CardGroupMode;
  onModeChange?: (mode: CardGroupMode) => void;
  summary?: ReactNode;
  children?: ReactNode;
}

export function CardGroup({
  title,
  count = 0,
  mode: controlledMode,
  onModeChange,
  summary,
  className,
  children,
  ...props
}: CardGroupProps) {
  const [internalMode, setInternalMode] = useState<CardGroupMode>('aggregated');
  const mode = controlledMode ?? internalMode;

  function toggle() {
    const next = mode === 'aggregated' ? 'disaggregated' : 'aggregated';
    setInternalMode(next);
    onModeChange?.(next);
  }

  return (
    <div
      className={className ? `card-group ${className}` : 'card-group'}
      data-mode={mode}
      {...props}
    >
      <button
        type="button"
        className="card-group-toggle"
        onClick={toggle}
        aria-expanded={mode === 'disaggregated'}
      >
        <span className="card-group-title">{title}</span>
        <span className="card-group-count">{count}</span>
        <svg
          className="card-group-chevron"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {mode === 'aggregated' ? (
        <div className="card-group-summary">{summary}</div>
      ) : (
        <div className="card-group-items">{children}</div>
      )}
    </div>
  );
}
