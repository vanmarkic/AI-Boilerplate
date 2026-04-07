import { type ElementType, type HTMLAttributes, type ReactNode, createElement } from 'react';

export type StackGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface StackProps extends HTMLAttributes<HTMLElement> {
  /** Stack direction. Default: `'vertical'`. */
  direction?: 'vertical' | 'horizontal';
  /** Gap between children. Default: `'md'`. */
  gap?: StackGap;
  /** Cross-axis alignment. */
  align?: 'start' | 'center' | 'end' | 'stretch';
  /** Main-axis distribution. */
  justify?: 'start' | 'center' | 'end' | 'between';
  /** Grow to fill parent flex container (`flex: 1; min-height: 0`). */
  fill?: boolean;
  /** HTML element to render. Default: `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

export function Stack({
  direction = 'vertical',
  gap = 'md',
  align,
  justify,
  fill = false,
  as = 'div',
  className,
  style,
  children,
  ...rest
}: StackProps) {
  return createElement(
    as,
    {
      className: className ? `stack ${className}` : 'stack',
      'data-gap': gap,
      ...(direction === 'horizontal' ? { 'data-direction': 'horizontal' } : undefined),
      ...(align ? { 'data-align': align } : undefined),
      ...(justify ? { 'data-justify': justify } : undefined),
      style: fill ? { flex: 1, minHeight: 0, ...style } : style,
      ...rest,
    },
    children,
  );
}
