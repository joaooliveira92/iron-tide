import { useEffect, useRef, useState } from "react";
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
  const [fired, setFired] = useState(0);
  useEffect(() => {
    if (!running || busy || ended) return undefined;
    const timer = setTimeout(() => {
      step.current();
      setFired((count) => count + 1);
    }, stepIntervalMs(scale));
    return () => clearTimeout(timer);
  }, [running, scale, busy, ended, fired]);
}
