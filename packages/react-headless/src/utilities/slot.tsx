import {
  cloneElement,
  isValidElement,
  type ReactNode,
  type Ref,
  type HTMLAttributes,
  type CSSProperties,
} from 'react';

export interface SlotProps extends HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  ref?: Ref<HTMLElement>;
}

function composeRefs<T>(...refs: (Ref<T> | undefined)[]): Ref<T> {
  return (instance: T | null) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(instance);
      } else if (ref && typeof ref === 'object') {
        (ref as { current: T | null }).current = instance;
      }
    }
  };
}

function composeEventHandlers(
  slotHandler?: (...args: unknown[]) => void,
  childHandler?: (...args: unknown[]) => void,
): ((...args: unknown[]) => void) | undefined {
  if (!slotHandler && !childHandler) return undefined;
  return (...args: unknown[]) => {
    slotHandler?.(...args);
    childHandler?.(...args);
  };
}

export function Slot({ children, ref: slotRef, ...slotProps }: SlotProps) {
  if (!isValidElement(children)) {
    return children ?? null;
  }

  const childProps = children.props as Record<string, unknown>;
  const mergedProps: Record<string, unknown> = { ...slotProps };

  // Merge classNames
  const slotClass = slotProps.className;
  const childClass = childProps['className'] as string | undefined;
  if (slotClass || childClass) {
    mergedProps['className'] = [slotClass, childClass].filter(Boolean).join(' ');
  }

  // Merge styles (child wins)
  const slotStyle = slotProps.style as CSSProperties | undefined;
  const childStyle = childProps['style'] as CSSProperties | undefined;
  if (slotStyle || childStyle) {
    mergedProps['style'] = { ...slotStyle, ...childStyle };
  }

  // Merge event handlers
  for (const key of Object.keys(slotProps)) {
    if (
      key.startsWith('on') &&
      typeof (slotProps as Record<string, unknown>)[key] === 'function'
    ) {
      mergedProps[key] = composeEventHandlers(
        (slotProps as Record<string, unknown>)[key] as (...args: unknown[]) => void,
        childProps[key] as ((...args: unknown[]) => void) | undefined,
      );
    }
  }

  // Child props win for everything else
  for (const key of Object.keys(childProps)) {
    if (key === 'className' || key === 'style' || key === 'ref') continue;
    if (key.startsWith('on') && mergedProps[key]) continue;
    mergedProps[key] = childProps[key];
  }

  // Compose refs — React 19 uses ref-as-prop (on children.props, not children.ref)
  const childRef = childProps['ref'] as Ref<HTMLElement> | undefined;
  mergedProps['ref'] = composeRefs(slotRef, childRef);

  return cloneElement(children, mergedProps);
}
