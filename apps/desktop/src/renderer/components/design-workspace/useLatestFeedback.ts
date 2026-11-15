import { useState } from "react";
import type { WorkshopView } from "@bluewave/ship-design";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { diffViews, type DesignFeedback } from "./designFeedback.js";

export interface LatestFeedback {
  readonly feedback: DesignFeedback | null;
  readonly phase: 0 | 1;
}

interface Tracked extends LatestFeedback {
  readonly view: WorkshopView;
}

export function useLatestFeedback(view: WorkshopView, format: PresentationFormat): LatestFeedback {
  const [tracked, setTracked] = useState<Tracked>({ view, feedback: null, phase: 0 });
  if (tracked.view.compiled.hash === view.compiled.hash) return tracked;
  const next: Tracked = {
    view,
    feedback: diffViews(tracked.view, view, format),
    phase: tracked.phase === 0 ? 1 : 0,
  };
  setTracked(next);
  return next;
}
