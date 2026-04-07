import { renderHook, act } from '@testing-library/react';
import { useControllableState } from './use-controllable-state';
import { describe, it, expect, vi } from 'vitest';

describe('useControllableState', () => {
  it('returns defaultValue in uncontrolled mode', () => {
    const { result } = renderHook(() => useControllableState({ defaultValue: 'hello' }));
    expect(result.current[0]).toBe('hello');
  });

  it('updates internal state in uncontrolled mode', () => {
    const { result } = renderHook(() => useControllableState({ defaultValue: 0 }));
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
  });

  it('calls onChange in uncontrolled mode', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 0, onChange }));
    act(() => result.current[1](5));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('uses controlled value over internal state', () => {
    const { result } = renderHook(() =>
      useControllableState({ value: 'controlled', defaultValue: 'default' }),
    );
    expect(result.current[0]).toBe('controlled');
  });

  it('calls onChange but does not update internal state in controlled mode', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useControllableState({ value: 'controlled', defaultValue: 'default', onChange }),
    );
    act(() => result.current[1]('new'));
    expect(onChange).toHaveBeenCalledWith('new');
    expect(result.current[0]).toBe('controlled');
  });

  it('does not fire onChange when controlled value changes externally', () => {
    const onChange = vi.fn();
    const { rerender } = renderHook(
      ({ value }) => useControllableState({ value, defaultValue: 'a', onChange }),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'b' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('warns when switching from uncontrolled to controlled', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = renderHook(
      ({ value }: { value?: string }) => useControllableState({ value, defaultValue: 'a' }),
      { initialProps: { value: undefined } },
    );
    rerender({ value: 'controlled' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('uncontrolled to controlled'));
    warn.mockRestore();
  });
});
