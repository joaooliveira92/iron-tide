import {
  applyEdit,
  buildWorkshopView,
  type DesignDraft,
  type DraftEdit,
  type WorkshopEnvironment,
  type WorkshopView,
} from "@bluewave/ship-design";

import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { diffViews, type DesignFeedback } from "./designFeedback.js";

export type OptionPreviewer = typeof previewOptionFeedback;

export function previewOptionFeedback(
  draft: DesignDraft,
  env: WorkshopEnvironment,
  before: WorkshopView,
  edit: DraftEdit,
  format: PresentationFormat,
): DesignFeedback | null {
  try {
    return diffViews(before, buildWorkshopView(applyEdit(draft, edit), env), format);
  } catch {
    return null;
  }
}

export interface OptionFeedbackCache {
  readonly feedbackFor: (
    draft: DesignDraft,
    env: WorkshopEnvironment,
    before: WorkshopView,
    edit: DraftEdit,
    format: PresentationFormat,
  ) => DesignFeedback | null;
}

export function createOptionFeedbackCache(
  preview: OptionPreviewer = previewOptionFeedback,
): OptionFeedbackCache {
  let hash = "";
  let scope: { readonly env: WorkshopEnvironment; readonly format: PresentationFormat } | null =
    null;
  let entries = new Map<string, DesignFeedback | null>();
  return {
    feedbackFor(draft, env, before, edit, format) {
      if (before.compiled.hash !== hash || scope?.env !== env || scope.format !== format) {
        hash = before.compiled.hash;
        scope = { env, format };
        entries = new Map();
      }
      const key = JSON.stringify(edit);
      const known = entries.get(key);
      if (known !== undefined || entries.has(key)) return known ?? null;
      const made = preview(draft, env, before, edit, format);
      entries.set(key, made);
      return made;
    },
  };
}
