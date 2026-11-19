import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createValueStore, subscribeWithLifecycle } from "../../../lib/value-store.js";
import { stepIntervalMs, type TacticalTimeScale } from "./tactical-time.js";

export interface TacticalPacerInput {
  readonly running: boolean;
  readonly scale: TacticalTimeScale;
  readonly busy: boolean;
  readonly ended: boolean;
  readonly onStep: () => void;
}

export function useTacticalPacer({
  running,
  scale,
  busy,
  ended,
  onStep,
}: TacticalPacerInput): void {
  const step = useRef(onStep);
  step.current = onStep;
  const [fires] = useState(() => createValueStore(0));
  const fired = useSyncExternalStore(fires.subscribe, fires.get);
  const armed = running && !busy && !ended;
  const subscribe = useMemo(
    () =>
      armed
        ? subscribeWithLifecycle(fires, () => {
            const timer = setTimeout(() => {
              step.current();
              fires.set((count) => count + 1);
            }, stepIntervalMs(scale));
            return () => clearTimeout(timer);
          })
        : fires.subscribe,
    [armed, scale, fired, fires],
  );
  useSyncExternalStore(subscribe, fires.get);
}
