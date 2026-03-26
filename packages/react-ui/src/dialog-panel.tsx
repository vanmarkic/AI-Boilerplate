import { type ReactNode, useEffect } from 'react';

export interface DialogPanelProps {
  variant?: 'default' | 'destructive';
  onClose?: () => void;
  title?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function DialogPanel({
  variant = 'default',
  onClose,
  title,
  footer,
  children,
}: DialogPanelProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <>
      <div
        className="dialog-backdrop"
        onClick={() => onClose?.()}
        aria-hidden="true"
      />
      <div
        className="dialog-panel"
        data-variant={variant}
        role="dialog"
        aria-modal="true"
      >
        {title && <div className="dialog-title">{title}</div>}
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </>
  );
}
