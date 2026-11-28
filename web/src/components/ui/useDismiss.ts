import { useEffect, type KeyboardEvent, type RefObject } from 'react';

/**
 * Closing something that drops open (a popover, the map pill's card): a press or focus outside
 * `root` closes it, and the returned key handler closes it on Esc and puts focus back on
 * `trigger`. Put the handler on `root`.
 */
export function useDismiss(
  open: boolean,
  close: () => void,
  root: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
    };
  }, [open]);
  return (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    e.stopPropagation();
    close();
    trigger.current?.focus();
  };
}
