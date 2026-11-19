import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { useBridge } from "../../../lib/bridge-context.js";
import { createTimedFlag } from "../../../lib/timed-flag.js";
import { createValueStore, subscribeWithLifecycle } from "../../../lib/value-store.js";
import type { CompiledRecord } from "../types.js";
import { filterRecords } from "../utils/filter.js";

const COPIED_FLAG_MS = 1_500;

export interface UseAstInspectorReturn {
  readonly filteredRecords: readonly CompiledRecord[];
  readonly searchTerm: string;
  readonly selectedRecord: CompiledRecord | null;
  readonly copied: boolean;
  readonly searchRef: React.RefCallback<HTMLInputElement>;
  readonly setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  readonly setSelectedRecord: React.Dispatch<React.SetStateAction<CompiledRecord | null>>;
  readonly copyRecord: () => void;
}

export function useAstInspector(sessionId: string): UseAstInspectorReturn {
  const bridge = useBridge();
  const [recordStore] = useState(() => createValueStore<readonly CompiledRecord[]>([]));
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CompiledRecord | null>(null);
  const [copyFlag] = useState(() => createTimedFlag(COPIED_FLAG_MS));

  const subscribeRecords = useMemo(
    () =>
      subscribeWithLifecycle(recordStore, (target) => {
        let cancelled = false;

        async function loadContentPackRecords(): Promise<void> {
          if (bridge === undefined) return;
          try {
            const designsRes = await bridge.campaign.execute(
              "inspectConstructionScreen",
              sessionId,
            );
            if (!cancelled && designsRes.outcome === "success") {
              target.set(
                designsRes.value.designs.map((d) => ({
                  id: d.designId || d.className,
                  kind: "compiled-design",
                  data: d,
                })),
              );
            }
          } catch (err) {
            console.error(err);
          }
        }

        void loadContentPackRecords();
        return () => {
          cancelled = true;
        };
      }),
    [recordStore, bridge, sessionId],
  );
  const records = useSyncExternalStore(subscribeRecords, recordStore.get);
  const copied = useSyncExternalStore(copyFlag.subscribe, copyFlag.get);

  const searchRef = useCallback((input: HTMLInputElement | null) => {
    if (input === null) return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      event.preventDefault();
      input?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const copyRecord = useCallback(() => {
    if (selectedRecord === null) return;
    void navigator.clipboard.writeText(JSON.stringify(selectedRecord.data, null, 2));
    copyFlag.raise();
  }, [selectedRecord, copyFlag]);

  const filteredRecords = useMemo(() => filterRecords(records, searchTerm), [records, searchTerm]);

  return {
    filteredRecords,
    searchTerm,
    selectedRecord,
    copied,
    searchRef,
    setSearchTerm,
    setSelectedRecord,
    copyRecord,
  };
}
