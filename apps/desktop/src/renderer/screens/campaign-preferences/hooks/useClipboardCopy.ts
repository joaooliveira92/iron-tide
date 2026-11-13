import { useCallback, useEffect, useRef, useState } from "react";

export interface UseClipboardCopyReturn {
  readonly copied: boolean;
  readonly copy: (text: string) => Promise<void>;
}

export function useClipboardCopy(resetDelayMs = 2000): UseClipboardCopyReturn {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      clearTimeout(resetTimer.current);
      setCopied(true);
      resetTimer.current = setTimeout(() => {
        resetTimer.current = undefined;
        setCopied(false);
      }, resetDelayMs);
    },
    [resetDelayMs],
  );

  return { copied, copy };
}
