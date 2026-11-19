import type { PrimaryAction, SetPrimaryAction } from "./primary-action.js";
import { useExternalSync } from "./useExternalSync.js";

export function usePrimaryAction(action: PrimaryAction | null, onChange: SetPrimaryAction): void {
  useExternalSync(() => {
    if (action === null) return;
    onChange(action);
    return () => onChange(null);
  }, [action, onChange]);
}
