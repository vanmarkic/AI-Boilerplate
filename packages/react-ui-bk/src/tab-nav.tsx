import { type AnchorHTMLAttributes, type ReactNode } from 'react';
import { Tabs } from '@aspect/react-headless';

export interface TabNavProps {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: ReactNode;
}

export function TabNav({ value, onValueChange, children }: TabNavProps) {
  return (
    <Tabs.Root value={value} onValueChange={onValueChange}>
      <nav>
        <Tabs.List className="tab-nav">{children}</Tabs.List>
      </nav>
    </Tabs.Root>
  );
}

export interface TabLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  value: string;
  children?: ReactNode;
}

export function TabLink({ value, href, children, ...props }: TabLinkProps) {
  return (
    <Tabs.Trigger value={value} asChild>
      <a href={href} className="tab-link" {...props}>{children}</a>
    </Tabs.Trigger>
  );
}
