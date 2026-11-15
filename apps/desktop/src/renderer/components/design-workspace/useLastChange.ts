import { useCallback, useState } from "react";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { deriveLastChange, type Describe, type LastChange, type Snapshot } from "./lastChange.js";

export function useLastChange(
  current: Snapshot,
  describe: Describe,
  format: PresentationFormat,
): { readonly lastChange: LastChange | null; readonly clearLastChange: () => void } {
  const [seen, setSeen] = useState<Snapshot>(current);
  const [lastChange, setLastChange] = useState<LastChange | null>(null);
  if (seen.log !== current.log) {
    setSeen(current);
    setLastChange(deriveLastChange(seen, current, describe, format));
  } else if (seen.view !== current.view) {
    setSeen(current);
    setLastChange(null);
  }
  const clearLastChange = useCallback(() => setLastChange(null), []);
  return { lastChange, clearLastChange };
}
