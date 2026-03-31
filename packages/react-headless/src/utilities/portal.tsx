import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface PortalProps {
  container?: HTMLElement;
  children: ReactNode;
}

export function Portal({ container, children }: PortalProps) {
  const target = container ?? (typeof document !== 'undefined' ? document.body : null);
  if (!target) return null;
  return createPortal(children, target);
}
