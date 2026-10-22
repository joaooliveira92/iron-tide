import { useCallback, useEffect, useRef, useState } from "react";
import type { BluewaveDesktopBridge } from "../../../preload/index.js";
import { useBridge } from "../../lib/bridge-context.js";
import { writeUiStatePatch } from "../../lib/uiStateSidecar.js";
import {
  DEFAULT_INSPECTOR_LAYOUT,
  clampInspectorWidth,
  normalizeInspectorLayout,
  type InspectorLayout,
} from "./inspector-layout.js";

const PERSIST_DEBOUNCE_MS = 300;

async function readInspectorLayout(
  bridge: BluewaveDesktopBridge,
  sessionId: string,
): Promise<InspectorLayout | null> {
  const result = await bridge.campaign.execute("readUiState", sessionId);
  if (result.outcome !== "success") return null;
  const raw = result.value.uiState.inspector;
  return raw === undefined ? null : normalizeInspectorLayout(raw);
}

export interface UseInspectorLayoutResult {
  readonly layout: InspectorLayout;
  setWidth: (px: number) => void;
  toggleCollapsed: () => void;
}

export function useInspectorLayout(sessionId?: string): UseInspectorLayoutResult {
  const bridge = useBridge();
  const [layout, setLayout] = useState<InspectorLayout>(DEFAULT_INSPECTOR_LAYOUT);
  const latest = useRef(layout);
  const edited = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<InspectorLayout | null>(null);

  useEffect(() => {
    latest.current = layout;
  }, [layout]);

  useEffect(() => {
    if (bridge === undefined || sessionId === undefined) return;
    let cancelled = false;
    void (async () => {
      const stored = await readInspectorLayout(bridge, sessionId);
      if (!cancelled && stored !== null && !edited.current) setLayout(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [bridge, sessionId]);

  useEffect(
    () => () => {
      if (timer.current === null) return;
      clearTimeout(timer.current);
      timer.current = null;
      if (bridge !== undefined && sessionId !== undefined && pending.current !== null) {
        void writeUiStatePatch(bridge, sessionId, { inspector: pending.current });
      }
    },
    [bridge, sessionId],
  );

  const commit = useCallback(
    (next: InspectorLayout) => {
      edited.current = true;
      setLayout(next);
      latest.current = next;
      if (bridge === undefined || sessionId === undefined) return;
      pending.current = next;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        const value = pending.current;
        pending.current = null;
        if (value !== null) void writeUiStatePatch(bridge, sessionId, { inspector: value });
      }, PERSIST_DEBOUNCE_MS);
    },
    [bridge, sessionId],
  );

  const setWidth = useCallback(
    (px: number) => commit({ ...latest.current, widthPx: clampInspectorWidth(px) }),
    [commit],
  );
  const toggleCollapsed = useCallback(
    () => commit({ ...latest.current, collapsed: !latest.current.collapsed }),
    [commit],
  );

  return { layout, setWidth, toggleCollapsed };
}
