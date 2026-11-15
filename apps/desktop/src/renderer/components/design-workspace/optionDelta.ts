import {
  applyEdit,
  buildWorkshopView,
  type DesignDraft,
  type DraftEdit,
  type WorkshopEnvironment,
  type WorkshopView,
} from "@bluewave/ship-design";

import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { diffViews } from "./designFeedback.js";

export interface Delta {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly direction: "up" | "down" | "flat";
}

const LEGACY_ASPECTS = ["speed", "displacement", "cost", "stability"] as const;

export function viewDeltas(
  before: WorkshopView,
  after: WorkshopView,
  format: PresentationFormat,
): Delta[] {
  const { aspects } = diffViews(before, after, format);
  const out: Delta[] = [];
  for (const id of LEGACY_ASPECTS) {
    const aspect = aspects.find((a) => a.aspect === id);
    if (aspect !== undefined)
      out.push({ id, label: aspect.label, text: aspect.text, direction: aspect.direction });
  }
  return out;
}

export function previewOptionDeltas(
  draft: DesignDraft,
  env: WorkshopEnvironment,
  before: WorkshopView,
  edit: DraftEdit,
  format: PresentationFormat,
): readonly Delta[] | null {
  let after: WorkshopView;
  try {
    after = buildWorkshopView(applyEdit(draft, edit), env);
  } catch {
    return null;
  }
  return viewDeltas(before, after, format);
}
