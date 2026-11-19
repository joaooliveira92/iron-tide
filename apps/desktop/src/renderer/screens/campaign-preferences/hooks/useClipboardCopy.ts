import { useCallback, useMemo, useSyncExternalStore } from "react";
import { createTimedFlag } from "../../../lib/timed-flag.js";

export interface UseClipboardCopyReturn {
  readonly copied: boolean;
  readonly copy: (text: string) => Promise<void>;
}

export function useClipboardCopy(resetDelayMs = 2000): UseClipboardCopyReturn {
  const flag = useMemo(() => createTimedFlag(resetDelayMs), [resetDelayMs]);
  const copied = useSyncExternalStore(flag.subscribe, flag.get);

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      flag.raise();
    },
    [flag],
  );

  return { copied, copy };
}
