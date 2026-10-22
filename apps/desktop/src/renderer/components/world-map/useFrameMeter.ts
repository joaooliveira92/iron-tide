import { useCallback, useRef } from "react";

export interface FrameMeter {
  readonly sample: () => void;
  readonly reset: () => void;
}

export function useFrameMeter(meterRef: React.RefObject<HTMLSpanElement | null>): FrameMeter {
  const samples = useRef<number[]>([]);
  const lastFrame = useRef(0);
  const lastReport = useRef(0);

  const sample = useCallback(() => {
    const now = performance.now();
    if (lastFrame.current !== 0) {
      const delta = now - lastFrame.current;
      if (delta < 250) samples.current.push(delta);
      if (samples.current.length > 400) samples.current.shift();
    }
    lastFrame.current = now;
    if (now - lastReport.current > 250 && meterRef.current !== null) {
      lastReport.current = now;
      const sorted = [...samples.current].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
      const p50 = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
      meterRef.current.textContent =
        sorted.length < 8
          ? "drag or zoom to measure"
          : `p50 ${p50.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · n=${sorted.length}`;
    }
  }, [meterRef]);

  const reset = useCallback(() => {
    samples.current = [];
    lastFrame.current = 0;
  }, []);

  return { sample, reset };
}
