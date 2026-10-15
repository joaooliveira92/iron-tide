import { useEffect } from "react";

import type { PrimaryAction, SetPrimaryAction } from "./primary-action.js";

/**
 * Registers the active screen's primary action with the shell for as long as
 * the screen owns it, clearing to idle on unmount or when the action changes.
 * Callers memoize `action` (or pass null while not ready) so the registration
 * does not churn on every render.
 */
export function usePrimaryAction(action: PrimaryAction | null, onChange: SetPrimaryAction): void {
  useEffect(() => {
    if (action === null) return;
    onChange(action);
    return () => onChange(null);
  }, [action, onChange]);
}
