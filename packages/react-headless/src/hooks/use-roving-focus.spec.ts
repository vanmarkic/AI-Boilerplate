import { renderHook, act } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useRovingFocus } from './use-roving-focus';
import type React from 'react';

function setupItems(hook: { current: ReturnType<typeof useRovingFocus> }, count: number) {
  const items: HTMLButtonElement[] = [];
  for (let i = 0; i < count; i++) {
    const btn = document.createElement('button');
    btn.textContent = `Item ${i}`;
    document.body.appendChild(btn);
    const props = hook.current.getItemProps(i);
    btn.tabIndex = props.tabIndex;
    btn.addEventListener('keydown', props.onKeyDown as EventListener);
    btn.addEventListener('focus', props.onFocus as EventListener);
    if (typeof props.ref === 'function') props.ref(btn);
    items.push(btn);
  }
  return items;
}

describe('useRovingFocus', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('sets tabIndex 0 on first item, -1 on rest', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    expect(result.current.getItemProps(0).tabIndex).toBe(0);
    expect(result.current.getItemProps(1).tabIndex).toBe(-1);
    expect(result.current.getItemProps(2).tabIndex).toBe(-1);
  });

  it('starts focusedIndex at 0', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    expect(result.current.focusedIndex).toBe(0);
  });

  it('ArrowRight moves focus forward (horizontal)', () => {
    const { result } = renderHook(() => useRovingFocus({ orientation: 'horizontal' }));
    const items = setupItems(result, 3);
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowRight' });
    expect(result.current.focusedIndex).toBe(1);
  });

  it('ArrowDown moves focus forward (vertical)', () => {
    const { result } = renderHook(() => useRovingFocus({ orientation: 'vertical' }));
    const items = setupItems(result, 3);
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    expect(result.current.focusedIndex).toBe(1);
  });

  it('Home jumps to first item', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    const items = setupItems(result, 3);
    items[2].focus();
    act(() => {
      result.current.getItemProps(2).onFocus({} as React.FocusEvent);
    });
    fireEvent.keyDown(items[2], { key: 'Home' });
    expect(result.current.focusedIndex).toBe(0);
  });

  it('End jumps to last item', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    const items = setupItems(result, 3);
    items[0].focus();
    fireEvent.keyDown(items[0], { key: 'End' });
    expect(result.current.focusedIndex).toBe(2);
  });

  it('loops from last to first', () => {
    const { result } = renderHook(() => useRovingFocus({ loop: true }));
    const items = setupItems(result, 3);
    items[2].focus();
    act(() => {
      result.current.getItemProps(2).onFocus({} as React.FocusEvent);
    });
    fireEvent.keyDown(items[2], { key: 'ArrowRight' });
    expect(result.current.focusedIndex).toBe(0);
  });

  it('skips disabled items', () => {
    const { result } = renderHook(() => useRovingFocus({}));
    // Item 1 is disabled
    expect(result.current.getItemProps(1, true).tabIndex).toBe(-1);
    const items = setupItems(result, 3);
    items[0].focus();
    // Override getItemProps to mark item 1 as disabled
    const propsDisabled = result.current.getItemProps(1, true);
    items[1].tabIndex = propsDisabled.tabIndex;
    fireEvent.keyDown(items[0], { key: 'ArrowRight' });
    expect(result.current.focusedIndex).toBe(2);
  });
});
