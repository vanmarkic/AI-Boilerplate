import { renderHook } from '@testing-library/react';
import { useScrollLock } from './use-scroll-lock';

describe('useScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  });

  it('sets overflow hidden when active', () => {
    renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('does not set overflow hidden when inactive', () => {
    renderHook(() => useScrollLock(false));
    expect(document.body.style.overflow).toBe('');
  });

  it('restores overflow on deactivation', () => {
    const { rerender } = renderHook(
      ({ active }) => useScrollLock(active),
      { initialProps: { active: true } },
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender({ active: false });
    expect(document.body.style.overflow).toBe('');
  });

  it('restores overflow on unmount', () => {
    const { unmount } = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('ref-counts nested activations', () => {
    const hook1 = renderHook(() => useScrollLock(true));
    const hook2 = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    hook1.unmount();
    expect(document.body.style.overflow).toBe('hidden');
    hook2.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('compensates scrollbar width with padding-right', () => {
    renderHook(() => useScrollLock(true));
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    expect(document.body.style.paddingRight).toBe(`${scrollbarWidth}px`);
  });
});
