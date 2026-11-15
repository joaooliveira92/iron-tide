import { useMemo, useState } from "react";
import type { DraftEdit, WorkshopEnvironment } from "@bluewave/ship-design";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import { useOptionalDesignState } from "./DesignWorkspaceContext.js";
import { feedbackDeltas } from "./feedbackDeltas.js";
import { createOptionFeedbackCache, previewOptionFeedback } from "./optionFeedback.js";
import type { Delta } from "./optionDelta.js";

export interface OptionPreview {
  readonly active: string | null;
  readonly setActive: (option: string | null) => void;
  readonly deltas: readonly Delta[];
}

export function useOptionPreview(editFor: (option: string) => DraftEdit | null): OptionPreview {
  const state = useOptionalDesignState();
  const format = usePresentationFormat();
  const [active, setActive] = useState<string | null>(null);
  const cache = useMemo(() => createOptionFeedbackCache(previewOptionFeedback), []);
  const content = state?.content;
  const month = state?.month;
  const nationId = state?.draft.nationId;
  const environment = useMemo(() => {
    let env: WorkshopEnvironment | null = null;
    return () => {
      if (content === undefined || month === undefined) return null;
      env ??= content.environmentFor(month, nationId);
      return env;
    };
  }, [content, month, nationId]);
  const deltas = useMemo(() => {
    if (active === null || state === null) return [];
    const edit = editFor(active);
    const env = environment();
    if (edit === null || env === null) return [];
    return feedbackDeltas(cache.feedbackFor(state.draft, env, state.view, edit, format));
  }, [active, state, editFor, environment, cache, format]);
  return { active, setActive, deltas };
}
