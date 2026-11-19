import { useCallback } from "react";

export function useDismissOnOutside(
  open: boolean,
  onDismiss: () => void,
): (root: HTMLElement | null) => (() => void) | void {
  return useCallback(
    (root: HTMLElement | null) => {
      if (root === null || !open) return;

      const onPointerDown = (event: PointerEvent) => {
        if (!root.contains(event.target as Node)) onDismiss();
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
    },
    [open, onDismiss],
  );
}
