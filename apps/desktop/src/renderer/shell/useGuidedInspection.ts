import { useMemo, useSyncExternalStore } from "react";
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

interface InspectionSnapshot {
  readonly inspection: UiStateFirstMonthInspection | undefined;
  readonly stepIndex: number;
  readonly visible: boolean;
  readonly loading: boolean;
}

interface InspectionStore {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => InspectionSnapshot;
  readonly advance: (currentIndex: number) => Promise<void>;
  readonly dismiss: (currentIndex: number) => Promise<void>;
  readonly restart: () => Promise<void>;
  readonly setVisible: (visible: boolean) => void;
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

function loadedSnapshot(stored: UiStateFirstMonthInspection | undefined): InspectionSnapshot {
  if (stored === undefined) {
    return { inspection: emptyInspection(), stepIndex: 0, visible: true, loading: false };
  }
  if (stored.status === "completed" || stored.status === "dismissed") {
    return { inspection: stored, stepIndex: 0, visible: false, loading: false };
  }
  if (stored.status === "not_started") {
    return {
      inspection: stored,
      stepIndex: 0,
      visible: shouldAutoOpen(stored),
      loading: false,
    };
  }
  return { inspection: stored, stepIndex: resumeStepIndex(stored), visible: true, loading: false };
}

function createInspectionStore(
  bridge: BluewaveDesktopBridge | undefined,
  sessionId: string | null,
): InspectionStore {
  const listeners = new Set<() => void>();
  let snapshot: InspectionSnapshot = {
    inspection: undefined,
    stepIndex: 0,
    visible: false,
    loading: sessionId !== null,
  };
  let generation = 0;

  function update(patch: Partial<InspectionSnapshot>): void {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  }

  async function load(token: number, id: string): Promise<void> {
    const stored = await readInspection(bridge, id);
    if (token !== generation) return;
    snapshot = loadedSnapshot(stored);
    for (const listener of listeners) listener();
  }

  async function advance(currentIndex: number): Promise<void> {
    if (sessionId === null) return;
    const next = nextInspectionState(snapshot.inspection ?? emptyInspection(), currentIndex);
    const persisted = await writeInspection(bridge, sessionId, next);
    if (currentIndex >= GUIDED_STEP_COUNT - 1) {
      update({ inspection: persisted ?? next, visible: false });
      return;
    }
    update({ inspection: persisted ?? next, stepIndex: currentIndex + 1 });
  }

  async function dismiss(currentIndex: number): Promise<void> {
    if (sessionId === null) {
      update({ visible: false });
      return;
    }
    const next = dismissedInspectionState(currentIndex);
    const persisted = await writeInspection(bridge, sessionId, next);
    update({ inspection: persisted ?? next, visible: false });
  }

  async function restart(): Promise<void> {
    if (sessionId === null) return;
    const next = restartedInspection();
    const persisted = await writeInspection(bridge, sessionId, next);
    update({ inspection: persisted ?? next, stepIndex: 0, visible: true });
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      if (listeners.size === 1 && sessionId !== null) {
        snapshot = { ...snapshot, loading: true };
        void load(generation, sessionId);
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) generation += 1;
      };
    },
    getSnapshot: () => snapshot,
    advance,
    dismiss,
    restart,
    setVisible: (visible) => update({ visible }),
  };
}

export function useGuidedInspection(
  options: UseGuidedInspectionOptions,
): UseGuidedInspectionResult {
  const { sessionId } = options;
  const bridge = useBridge();
  const store = useMemo(() => createInspectionStore(bridge, sessionId), [bridge, sessionId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return {
    ...snapshot,
    advance: store.advance,
    dismiss: store.dismiss,
    restart: store.restart,
    setVisible: store.setVisible,
  };
}
