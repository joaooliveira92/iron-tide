import { useCallback, useState } from "react";

export interface UseClipboardCopyReturn {
  readonly copied: boolean;
  readonly copy: (text: string) => Promise<void>;
}

export function useClipboardCopy(resetDelayMs = 2000): UseClipboardCopyReturn {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), resetDelayMs);
    },
    [resetDelayMs],
  );

  return { copied, copy };
}
