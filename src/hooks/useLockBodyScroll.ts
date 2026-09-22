import { useEffect } from 'react';

/**
 * Custom Hook: useLockBodyScroll
 * Locks document.body scrolling when a modal or side-drawer is active.
 * Prevents iOS Safari scroll chaining / background scroll bleed and restores
 * the original overflow state on cleanup.
 *
 * @param isLocked boolean indicating whether scroll lock is active (default: true)
 */
export function useLockBodyScroll(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked) return;

    // Capture previous overflow styles
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalBodyTouchAction = document.body.style.touchAction;

    // Apply scroll lock to document body
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    // Prevent default bounce/scroll chaining on iOS touchmove when touching non-scrollable targets
    const handleTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      // If the touch target is not inside an element marked with overscroll-contain or scrollable overflow, prevent default
      if (target && !target.closest('.overflow-y-auto, .overflow-auto, [data-allow-scroll]')) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    // Cleanup: restore original body styles and remove listeners
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.body.style.touchAction = originalBodyTouchAction;
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isLocked]);
}

export default useLockBodyScroll;
