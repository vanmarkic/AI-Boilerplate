import { type AnchorHTMLAttributes, type ReactNode } from 'react';

export interface TabNavProps {
  children?: ReactNode;
}

export function TabNav({ children }: TabNavProps) {
  return <nav className="tab-nav">{children}</nav>;
}

export interface TabLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean;
  children?: ReactNode;
}

export function TabLink({
  active,
  className,
  children,
  ...props
}: TabLinkProps) {
  const classes = ['tab-link'];
  if (active) classes.push('active');
  if (className) classes.push(className);

  return (
    <a className={classes.join(' ')} {...props}>
      {children}
    </a>
  );
}
