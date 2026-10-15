import { useCallback, useEffect, useState } from "react";

import type { SetPrimaryAction } from "../../shell/primary-action.js";
import {
  OPENING_BRIEFING_PAGE_COUNT,
  PAGE_1_NEXT_LABEL,
  PAGE_LAST_ACTION_LABEL,
  nextPageIndex,
  previousPageIndex,
} from "./new-game-briefing-screen-state.js";

const EMPTY_PAGE_INDEX = 0;

export interface BriefingPagerOptions {
  readonly sessionId: string;
  readonly ready: boolean;
  readonly onTakeCommand: () => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

export interface BriefingPager {
  readonly pageIndex: number;
  readonly goBack: () => void;
}

/**
 * Owns the briefing's linear page cursor and its primary-action registration.
 * The cursor resets when the session changes; the primary action only registers
 * once the projection has loaded, so the shell never shows a dead trigger.
 */
export function useBriefingPager({
  sessionId,
  ready,
  onTakeCommand,
  onPrimaryActionChange,
}: BriefingPagerOptions): BriefingPager {
  const [pageIndex, setPageIndex] = useState(EMPTY_PAGE_INDEX);

  useEffect(() => {
    setPageIndex(EMPTY_PAGE_INDEX);
  }, [sessionId]);

  const isLastPage = pageIndex === OPENING_BRIEFING_PAGE_COUNT - 1;

  useEffect(() => {
    if (!ready) return;
    onPrimaryActionChange({
      label: isLastPage ? PAGE_LAST_ACTION_LABEL : pageIndex === 0 ? PAGE_1_NEXT_LABEL : "Next",
      disabled: false,
      onTrigger: isLastPage ? onTakeCommand : () => setPageIndex(nextPageIndex(pageIndex)),
    });
    return () => onPrimaryActionChange(null);
  }, [ready, isLastPage, pageIndex, onTakeCommand, onPrimaryActionChange]);

  const goBack = useCallback(() => {
    setPageIndex(previousPageIndex(pageIndex));
  }, [pageIndex]);

  return { pageIndex, goBack };
}
