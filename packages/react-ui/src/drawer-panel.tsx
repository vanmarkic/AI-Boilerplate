import { type ReactNode, useEffect, useRef } from 'react';

export type DrawerSide = 'left' | 'right';

export interface DrawerPanelProps {
  side?: DrawerSide;
  open?: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
}

export function DrawerPanel({
  side = 'right',
  open = false,
  onClose,
  title,
  children,
}: DrawerPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [open]);

  return (
    <>
      {open && (
        <div
          className="drawer-backdrop"
          aria-hidden="true"
          onClick={() => onClose?.()}
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className="drawer-panel"
        data-side={side}
        data-state={open ? 'open' : 'closed'}
      >
        <div className="drawer-header">
          {title}
          <button
            className="drawer-close-btn"
            aria-label="Close drawer"
            onClick={() => onClose?.()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              width="18"
              height="18"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}
