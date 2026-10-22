import { useCallback, useEffect, useState } from "react";
import type { UiStateFirstMonthInspection } from "../../shared/ui-state-contract.js";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { useBridge } from "../lib/bridge-context.js";
import { readUiState, writeUiStatePatch } from "../lib/uiStateSidecar.js";
import {
  GUIDED_STEP_COUNT,
  dismissedInspectionState,
  emptyInspection,
  nextInspectionState,
  restartedInspection,
  resumeStepIndex,
  shouldAutoOpen,
} from "./guided-inspection-state.js";

export interface UseGuidedInspectionOptions {
  readonly sessionId: string | null;
}

export interface UseGuidedInspectionResult {
  readonly inspection: UiStateFirstMonthInspection | undefined;
  readonly stepIndex: number;
  readonly visible: boolean;
  readonly loading: boolean;
  advance: (currentIndex: number) => Promise<void>;
  dismiss: (currentIndex: number) => Promise<void>;
  restart: () => Promise<void>;
  setVisible: (v: boolean) => void;
}

async function readInspection(
  bridge: BluewaveDesktopBridge | undefined,
  sessionId: string,
): Promise<UiStateFirstMonthInspection | undefined> {
  const uiState = await readUiState(bridge, sessionId);
  return uiState?.firstMonthInspection;
}

async function writeInspection(
  bridge: BluewaveDesktopBridge | undefined,
  sessionId: string,
  inspection: UiStateFirstMonthInspection,
): Promise<UiStateFirstMonthInspection | undefined> {
  const uiState = await writeUiStatePatch(bridge, sessionId, {
    firstMonthInspection: inspection,
  });
  return uiState?.firstMonthInspection;
}

export function useGuidedInspection(
  options: UseGuidedInspectionOptions,
): UseGuidedInspectionResult {
  const { sessionId } = options;
  const bridge = useBridge();
  const [inspection, setInspection] = useState<UiStateFirstMonthInspection | undefined>(undefined);
  const [stepIndex, setStepIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId === null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const stored = await readInspection(bridge, sessionId);
      if (cancelled) return;
      if (stored === undefined) {
        setInspection(emptyInspection());
        setStepIndex(0);
        setVisible(true);
      } else if (stored.status === "completed" || stored.status === "dismissed") {
        setInspection(stored);
        setVisible(false);
        setStepIndex(0);
      } else if (stored.status === "not_started") {
        setInspection(stored);
        setStepIndex(0);
        setVisible(shouldAutoOpen(stored));
      } else {
        setInspection(stored);
        setStepIndex(resumeStepIndex(stored));
        setVisible(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [bridge, sessionId]);

  const advance = useCallback(
    async (currentIndex: number) => {
      if (sessionId === null) return;
      const current = inspection ?? emptyInspection();
      const next = nextInspectionState(current, currentIndex);
      const isLast = currentIndex >= GUIDED_STEP_COUNT - 1;
      if (isLast) {
        const persisted = await writeInspection(bridge, sessionId, next);
        setInspection(persisted ?? next);
        setVisible(false);
        return;
      }
      const persisted = await writeInspection(bridge, sessionId, next);
      setInspection(persisted ?? next);
      setStepIndex(currentIndex + 1);
    },
    [bridge, sessionId, inspection],
  );

  const dismiss = useCallback(
    async (currentIndex: number) => {
      if (sessionId === null) {
        setVisible(false);
        return;
      }
      const next = dismissedInspectionState(currentIndex);
      const persisted = await writeInspection(bridge, sessionId, next);
      setInspection(persisted ?? next);
      setVisible(false);
    },
    [bridge, sessionId],
  );

  const restart = useCallback(async () => {
    if (sessionId === null) return;
    const next = restartedInspection();
    const persisted = await writeInspection(bridge, sessionId, next);
    setInspection(persisted ?? next);
    setStepIndex(0);
    setVisible(true);
  }, [sessionId]);

  return {
    inspection,
    stepIndex,
    visible,
    loading,
    advance,
    dismiss,
    restart,
    setVisible,
  };
}
