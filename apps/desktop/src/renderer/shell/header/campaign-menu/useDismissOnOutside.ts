import { useEffect, type RefObject } from "react";

/**
 * Dismisses an open disclosure when the pointer lands outside `rootRef` or Escape is pressed.
 * Inert while `open` is false, so callers can leave it mounted unconditionally.
 */
export function useDismissOnOutside(
  rootRef: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [rootRef, open, onDismiss]);
}
