import { useCallback, useMemo, useState } from "react";

import type { PrimaryAction, SetPrimaryAction } from "../../shell/primary-action.js";
import { usePrimaryAction } from "../../shell/usePrimaryAction.js";
import {
  OPENING_BRIEFING_PAGE_COUNT,
  forwardLabel,
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

export function useBriefingPager({
  sessionId,
  ready,
  onTakeCommand,
  onPrimaryActionChange,
}: BriefingPagerOptions): BriefingPager {
  const [pageIndex, setPageIndex] = useState(EMPTY_PAGE_INDEX);
  const [pagedSessionId, setPagedSessionId] = useState(sessionId);

  if (pagedSessionId !== sessionId) {
    setPagedSessionId(sessionId);
    setPageIndex(EMPTY_PAGE_INDEX);
  }

  const isLastPage = pageIndex === OPENING_BRIEFING_PAGE_COUNT - 1;

  const primaryAction = useMemo<PrimaryAction | null>(
    () =>
      ready
        ? {
            label: forwardLabel(pageIndex),
            disabled: false,
            onTrigger: isLastPage ? onTakeCommand : () => setPageIndex(nextPageIndex(pageIndex)),
          }
        : null,
    [ready, isLastPage, pageIndex, onTakeCommand],
  );
  usePrimaryAction(primaryAction, onPrimaryActionChange);

  const goBack = useCallback(() => {
    setPageIndex(previousPageIndex(pageIndex));
  }, [pageIndex]);

  return { pageIndex, goBack };
}
