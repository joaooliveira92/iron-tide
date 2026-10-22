import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBridge } from "../../../lib/bridge-context.js";
import type { CompiledRecord } from "../types.js";
import { filterRecords } from "../utils/filter.js";

export interface UseAstInspectorReturn {
  readonly filteredRecords: readonly CompiledRecord[];
  readonly searchTerm: string;
  readonly selectedRecord: CompiledRecord | null;
  readonly copied: boolean;
  readonly searchRef: React.RefObject<HTMLInputElement | null>;
  readonly setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  readonly setSelectedRecord: React.Dispatch<React.SetStateAction<CompiledRecord | null>>;
  readonly copyRecord: () => void;
}

export function useAstInspector(sessionId: string): UseAstInspectorReturn {
  const bridge = useBridge();
  const [records, setRecords] = useState<readonly CompiledRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<CompiledRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadContentPackRecords(): Promise<void> {
      if (bridge === undefined) return;
      try {
        const designsRes = await bridge.campaign.execute("inspectConstructionScreen", sessionId);
        if (!cancelled && designsRes.outcome === "success") {
          const designs = designsRes.value.designs.map((d) => ({
            id: d.designId || d.className,
            kind: "compiled-design",
            data: d,
          }));
          setRecords(designs);
        }
      } catch (err) {
        console.error(err);
      }
    }

    void loadContentPackRecords();
    return () => {
      cancelled = true;
    };
  }, [bridge, sessionId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target !== null && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      event.preventDefault();
      searchRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const copyRecord = useCallback(() => {
    if (selectedRecord === null) return;
    void navigator.clipboard.writeText(JSON.stringify(selectedRecord.data, null, 2));
    setCopied(true);
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1_500);
  }, [selectedRecord]);

  useEffect(
    () => () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    },
    [],
  );

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
