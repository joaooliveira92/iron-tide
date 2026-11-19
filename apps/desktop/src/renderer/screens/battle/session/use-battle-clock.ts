import { useCallback, useState } from "react";
import { DEFAULT_TIME_SCALE, type TacticalTimeScale } from "../tactical/tactical-time.js";
import { useTacticalPacer } from "../tactical/useTacticalPacer.js";

export interface BattleClockInput {
  readonly busy: boolean;
  readonly ended: boolean;
  readonly loaded: boolean;
  readonly onStep: () => void;
}

export interface BattleClock {
  readonly running: boolean;
  readonly scale: TacticalTimeScale;
  readonly setScale: (scale: TacticalTimeScale) => void;
  readonly toggleRunning: () => void;
  readonly pause: () => void;
}

export function useBattleClock({ busy, ended, loaded, onStep }: BattleClockInput): BattleClock {
  const [running, setRunning] = useState(false);
  const [scale, setScale] = useState<TacticalTimeScale>(DEFAULT_TIME_SCALE);

  useTacticalPacer({ running, scale, busy, ended: !loaded || ended, onStep });

  const [seenEnded, setSeenEnded] = useState(ended);
  if (seenEnded !== ended) {
    setSeenEnded(ended);
    if (ended) setRunning(false);
  }

  const toggleRunning = useCallback(() => setRunning((current) => !current), []);
  const pause = useCallback(() => setRunning(false), []);

  return { running, scale, setScale, toggleRunning, pause };
}
