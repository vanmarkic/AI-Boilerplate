import { useCallback, useRef, useState } from 'react';

export interface UseControllableStateOptions<T> {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}

export function useControllableState<T>(
  options: UseControllableStateOptions<T>,
): [T, (value: T) => void] {
  const { value: controlledValue, defaultValue, onChange } = options;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const wasControlledRef = useRef(isControlled);

  if (process.env.NODE_ENV !== 'production') {
    if (wasControlledRef.current && !isControlled) {
      console.warn(
        'A component changed from controlled to uncontrolled. This is not supported.',
      );
    }
    if (!wasControlledRef.current && isControlled) {
      console.warn(
        'A component changed from uncontrolled to controlled. This is not supported.',
      );
    }
  }
  wasControlledRef.current = isControlled;

  const currentValue = isControlled ? controlledValue : internalValue;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) {
        setInternalValue(next);
      }
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [currentValue, setValue];
}
