import { type RefObject, useEffect, useRef } from 'react';

export interface UseFocusTrapOptions {
  active: boolean;
  initialFocusRef?: RefObject<HTMLElement>;
  returnFocusOnDeactivate?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return elements.filter(
    (el) =>
      !el.hasAttribute('disabled') &&
      !el.closest('[aria-hidden="true"]') &&
      !el.hasAttribute('hidden') &&
      el.tabIndex !== -1,
  );
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  options: UseFocusTrapOptions,
): void {
  const { active, initialFocusRef, returnFocusOnDeactivate = true } = options;
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const focusableElements = getFocusableElements(container);
    const initialFocus = initialFocusRef?.current;

    if (
      initialFocus &&
      !initialFocus.hasAttribute('disabled') &&
      !initialFocus.hasAttribute('hidden')
    ) {
      initialFocus.focus();
    } else if (focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      container.tabIndex = -1;
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const currentFocusable = getFocusableElements(container);
      if (currentFocusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const observer = new MutationObserver(() => {
      // Re-query focusable elements on DOM mutations — the keydown
      // handler already calls getFocusableElements dynamically
    });
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'tabindex'],
    });

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      observer.disconnect();
      if (returnFocusOnDeactivate && previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [active, containerRef, initialFocusRef, returnFocusOnDeactivate]);
}
