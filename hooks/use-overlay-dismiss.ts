"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Dismiss + focus management for custom (non-native-`<dialog>`) overlays.
 *
 * Native `<dialog>` opened with `showModal()` already gives us Escape-to-close
 * and a focus trap for free; the hand-rolled `fixed inset-0` overlays do not.
 * This hook brings them to parity:
 *  - Escape closes the overlay (captured at document level, so it works no
 *    matter where focus currently sits).
 *  - Focus is moved into the overlay on open and restored to the previously
 *    focused element on close.
 *  - Tab / Shift+Tab are trapped within the overlay.
 *
 * Returns a ref to attach to the overlay's content panel.
 */
export function useOverlayDismiss<T extends HTMLElement = HTMLDivElement>(
  active: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  // Keep the latest onClose without re-subscribing the listener every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const visibleFocusables = () =>
      node
        ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.getClientRects().length > 0,
          )
        : [];

    // Move focus into the overlay once children (and any autoFocus) have settled.
    const raf = requestAnimationFrame(() => {
      if (!node) return;
      // Respect an element that already grabbed focus inside (e.g. autoFocus).
      if (node.contains(document.activeElement)) return;
      const focusables = visibleFocusables();
      (focusables[0] ?? node).focus({ preventScroll: true });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const focusables = visibleFocusables();
      if (focusables.length === 0) {
        e.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (activeEl === first || !node.contains(activeEl)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (activeEl === last || !node.contains(activeEl)) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return ref;
}
