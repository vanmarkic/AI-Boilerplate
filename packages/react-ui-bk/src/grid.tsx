import { type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode, createElement } from 'react';

export type GridGap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface GridProps extends HTMLAttributes<HTMLElement> {
  /** Column definition. Number → `repeat(n, 1fr)`. String → `gridTemplateColumns` value. */
  columns?: number | string;
  /** Gap between cells. Default: `'md'`. */
  gap?: GridGap;
  /** Grow to fill parent flex container (`flex: 1; min-height: 0`). */
  fill?: boolean;
  /** HTML element to render. Default: `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

export function Grid({
  columns,
  gap = 'md',
  fill = false,
  as = 'div',
  className,
  style,
  children,
  ...rest
}: GridProps) {
  const columnStyle: CSSProperties =
    columns === undefined
      ? {}
      : typeof columns === 'number'
        ? { '--grid-cols': columns } as CSSProperties
        : { gridTemplateColumns: columns };

  return createElement(
    as,
    {
      className: className ? `layout-grid ${className}` : 'layout-grid',
      'data-gap': gap,
      style: {
        ...columnStyle,
        ...(fill ? { flex: 1, minHeight: 0 } : undefined),
        ...style,
      },
      ...rest,
    },
    children,
  );
}

export interface CellProps extends HTMLAttributes<HTMLElement> {
  /** Column span. Number → `span N`. `'full'` → `1 / -1`. */
  span?: number | 'full';
  /** Column start position. */
  start?: number;
  /** Row span. */
  rowSpan?: number;
  /** HTML element to render. Default: `'div'`. */
  as?: ElementType;
  children?: ReactNode;
}

export function Cell({
  span,
  start,
  rowSpan,
  as = 'div',
  style,
  children,
  ...rest
}: CellProps) {
  const cellStyle: CSSProperties = {
    ...(span !== undefined
      ? { gridColumn: span === 'full' ? '1 / -1' : `span ${span}` }
      : undefined),
    ...(start !== undefined ? { gridColumnStart: start } : undefined),
    ...(rowSpan !== undefined ? { gridRow: `span ${rowSpan}` } : undefined),
    ...style,
  };

  const hasStyles = Object.keys(cellStyle).length > 0;

  return createElement(
    as,
    {
      ...(hasStyles ? { style: cellStyle } : undefined),
      ...rest,
    },
    children,
  );
}
