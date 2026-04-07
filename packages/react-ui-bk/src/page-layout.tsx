import { type ReactNode } from 'react';

export interface PageLayoutProps {
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}

export function PageLayout({ header, footer, children }: PageLayoutProps) {
  return (
    <div className="page-layout">
      {header && <header className="page-layout-header">{header}</header>}
      <main className="page-layout-main">{children}</main>
      {footer && <footer className="page-layout-footer">{footer}</footer>}
    </div>
  );
}
