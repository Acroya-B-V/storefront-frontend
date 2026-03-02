import { useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';

const FOCUSABLE_SELECTOR =
  'button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab focus within `ref` while `isActive` is true.
 * Calls `onEscape` when the Escape key is pressed.
 * Also prevents body scroll while active.
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement>,
  isActive: boolean,
  onEscape: () => void,
): void {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
        return;
      }

      if (e.key === 'Tab' && ref.current) {
        const focusable = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, onEscape]);
}
