import { type HTMLAttributes, type ReactNode } from 'react';

export type SidebarSide = 'left' | 'right';

export interface SidebarLayoutProps extends HTMLAttributes<HTMLDivElement> {
  side?: SidebarSide;
  sidebar?: ReactNode;
  children?: ReactNode;
}

export function SidebarLayout({
  side = 'left',
  sidebar,
  className,
  children,
  ...props
}: SidebarLayoutProps) {
  return (
    <div
      className={className ? `sidebar-layout ${className}` : 'sidebar-layout'}
      data-side={side}
      {...props}
    >
      <aside className="sidebar-layout-sidebar">{sidebar}</aside>
      <div className="sidebar-layout-main">{children}</div>
    </div>
  );
}
