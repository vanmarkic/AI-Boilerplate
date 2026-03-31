import { type ReactNode } from 'react';
import { Dialog } from '@aspect/react-headless';

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
  return (
    <Dialog.Root open={true} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-backdrop" />
        <Dialog.Content className="dialog-panel" data-variant={variant}>
          {title && <Dialog.Title className="dialog-title">{title}</Dialog.Title>}
          <div className="dialog-body">{children}</div>
          {footer && <div className="dialog-footer">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
