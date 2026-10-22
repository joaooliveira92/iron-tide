import { useEffect, useState } from "react";
import {
  CHECKLIST_LINES,
  CHECKLIST_REVEAL_INTERVAL_MS,
  FLAVOR_MESSAGES,
  FLAVOR_ROTATION_INTERVAL_MS,
} from "./world-generation-presentation.js";

export interface WorldGenerationChecklistState {
  readonly revealedCount: number;
  readonly flavorText: string;
}

export function useWorldGenerationChecklist(active: boolean): WorldGenerationChecklistState {
  const [revealedCount, setRevealedCount] = useState(1);
  const [flavorIndex, setFlavorIndex] = useState(0);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setRevealedCount((count) => Math.min(count + 1, CHECKLIST_LINES.length));
    }, CHECKLIST_REVEAL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setFlavorIndex((index) => (index + 1) % FLAVOR_MESSAGES.length);
    }, FLAVOR_ROTATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active]);

  return {
    revealedCount,
    flavorText: FLAVOR_MESSAGES[flavorIndex] ?? FLAVOR_MESSAGES[0]!,
  };
}
