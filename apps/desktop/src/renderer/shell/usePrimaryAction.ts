import { useEffect } from "react";

import type { PrimaryAction, SetPrimaryAction } from "./primary-action.js";

export function usePrimaryAction(action: PrimaryAction | null, onChange: SetPrimaryAction): void {
  useEffect(() => {
    if (action === null) return;
    onChange(action);
    return () => onChange(null);
  }, [action, onChange]);
}
