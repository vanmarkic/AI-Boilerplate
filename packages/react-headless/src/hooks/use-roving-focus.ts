import {
  useCallback,
  useRef,
  useState,
  type FocusEventHandler,
  type KeyboardEventHandler,
  type RefCallback,
} from 'react';

export interface UseRovingFocusOptions {
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
}

export interface RovingFocusReturn {
  getItemProps(
    index: number,
    disabled?: boolean,
  ): {
    ref: RefCallback<HTMLElement>;
    tabIndex: number;
    onKeyDown: KeyboardEventHandler;
    onFocus: FocusEventHandler;
  };
  focusedIndex: number;
}

export function useRovingFocus(options: UseRovingFocusOptions = {}): RovingFocusReturn {
  const { orientation = 'horizontal', loop = true } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemsRef = useRef<Map<number, HTMLElement>>(new Map());
  const disabledRef = useRef<Set<number>>(new Set());
  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;

  const focusItem = useCallback((index: number) => {
    const el = itemsRef.current.get(index);
    if (el) {
      el.focus();
      setFocusedIndex(index);
    }
  }, []);

  const findNext = useCallback(
    (from: number, direction: 1 | -1): number | null => {
      const size = itemsRef.current.size;
      if (size === 0) return null;
      let candidate = from + direction;
      const maxSteps = size;
      for (let step = 0; step < maxSteps; step++) {
        if (candidate < 0) candidate = loop ? size - 1 : 0;
        if (candidate >= size) candidate = loop ? 0 : size - 1;
        if (!disabledRef.current.has(candidate)) return candidate;
        candidate += direction;
      }
      return null;
    },
    [loop],
  );

  const getItemProps = useCallback(
    (
      index: number,
      disabled = false,
    ): {
      ref: RefCallback<HTMLElement>;
      tabIndex: number;
      onKeyDown: KeyboardEventHandler;
      onFocus: FocusEventHandler;
    } => {
      if (disabled) {
        disabledRef.current.add(index);
      } else {
        disabledRef.current.delete(index);
      }

      return {
        ref: (el: HTMLElement | null) => {
          if (el) {
            itemsRef.current.set(index, el);
          } else {
            itemsRef.current.delete(index);
          }
        },
        tabIndex: index === focusedIndex && !disabled ? 0 : -1,
        onKeyDown: (e) => {
          const forwardKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
          const backKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

          let nextIndex: number | null = null;
          const currentIndex = focusedIndexRef.current;

          switch (e.key) {
            case forwardKey:
              nextIndex = findNext(currentIndex, 1);
              break;
            case backKey:
              nextIndex = findNext(currentIndex, -1);
              break;
            case 'Home':
              nextIndex = findNext(-1, 1);
              break;
            case 'End':
              nextIndex = findNext(itemsRef.current.size, -1);
              break;
            default:
              return;
          }

          if (nextIndex !== null) {
            e.preventDefault();
            focusItem(nextIndex);
          }
        },
        onFocus: () => {
          setFocusedIndex(index);
        },
      };
    },
    [focusedIndex, orientation, findNext, focusItem],
  );

  return { getItemProps, focusedIndex };
}
