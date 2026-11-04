import { Flag, Landmark, Radar } from "lucide-react";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { formatCampaignMonth } from "../../shell/site-header-state.js";
import { BriefingActions } from "./components/BriefingActions.js";
import { BriefingProgress } from "./components/BriefingProgress.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
import { ScreenHeader } from "./components/ScreenHeader.js";
import { OPENING_BRIEFING_PAGE_VIEWS } from "./briefing-pages/opening-briefing-page-views.js";
import {
  BRIEFING_SCREEN_TITLE,
  OPENING_BRIEFING_PAGE_TITLES,
  canGoBack,
  nextPageTitle,
  openingBriefingPageAt,
} from "./new-game-briefing-screen-state.js";
import { useBriefingPager } from "./useBriefingPager.js";
import { useOpeningBriefing, type LoadOpeningBriefing } from "./useOpeningBriefing.js";
import { worldText } from "./world-situation-copy.js";

export interface NewGameBriefingScreenProps {
  readonly sessionId: string;
  readonly onInspectOpeningBriefing: LoadOpeningBriefing;
  readonly onTakeCommand: () => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

export function NewGameBriefingScreen({
  sessionId,
  onInspectOpeningBriefing,
  onTakeCommand,
  onPrimaryActionChange,
}: NewGameBriefingScreenProps) {
  const { projection, error } = useOpeningBriefing(sessionId, onInspectOpeningBriefing);
  const ready = projection !== null;
  const { pageIndex, goBack } = useBriefingPager({
    sessionId,
    ready,
    onTakeCommand,
    onPrimaryActionChange,
  });

  if (error !== null) {
    return (
      <NewGameScreenLayout size="sm" variant="centered">
        <ScreenHeader
          icon={<Flag />}
          title="Briefing unavailable"
          description={`The opening briefing could not be prepared. ${error}`}
        />
      </NewGameScreenLayout>
    );
  }

  if (projection === null) {
    return (
      <NewGameScreenLayout size="sm" variant="centered">
        <ScreenHeader
          icon={<Landmark />}
          title={BRIEFING_SCREEN_TITLE}
          description="Preparing the briefing…"
        />
      </NewGameScreenLayout>
    );
  }

  const page = openingBriefingPageAt(pageIndex);
  const View = page === null ? null : OPENING_BRIEFING_PAGE_VIEWS[page.id];

  return (
    <NewGameScreenLayout size="md">
      <ScreenHeader
        icon={<Landmark />}
        title={BRIEFING_SCREEN_TITLE}
        description={page?.title ?? BRIEFING_SCREEN_TITLE}
      />

      <BriefingProgress
        titles={OPENING_BRIEFING_PAGE_TITLES}
        currentIndex={pageIndex}
        label="Briefing progress"
      />

      {View !== null && <View projection={projection} />}

      <BriefingActions
        backLabel={worldText("actions.back")}
        canGoBack={canGoBack(pageIndex)}
        onBack={goBack}
        note={
          page?.reviewOnly === true
            ? `${worldText("world.reviewOnly")} ${worldText("actions.continue.hint", {
                next: nextPageTitle(pageIndex),
              })}`
            : undefined
        }
      />

      <div
        className="flex items-center gap-1.5 self-end text-xs text-muted-foreground"
        aria-hidden="true"
      >
        <Radar className="size-3.5" />
        {formatCampaignMonth(projection.month)}
      </div>
    </NewGameScreenLayout>
  );
}
