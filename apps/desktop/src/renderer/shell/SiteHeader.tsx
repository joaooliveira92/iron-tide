import { cn } from "../lib/utils.js";
import { translate } from "../lib/strings.js";
import { GlobalSearch } from "./GlobalSearch.js";
import {
  HeaderAdvanceMonth,
  HeaderCampaignMenu,
  HeaderChrome,
  HeaderContinueAction,
  HeaderNav,
  HeaderSecondaryRow,
  HeaderTitle,
  HeaderWindowControls,
  type HeaderCampaignMenuProps,
  type NavAction,
} from "./header/index.js";
import { DRAG, NO_DRAG } from "./header/drag-region.js";
import type { PriorityBriefingProps } from "./header/secondary-row/PriorityBriefing.js";
import type { PrimaryAction } from "./primary-action.js";
import type { SearchTarget } from "./global-search-state.js";
import type { ActiveView, HeaderCampaign, WizardStepCopy } from "./site-header-state.js";
import { useWindowContext } from "./WindowContext.js";

const EMPTY_SEARCH_TARGETS: readonly SearchTarget[] = [];

export interface SiteHeaderProps {
  readonly title?: string;
  readonly activeView?: ActiveView;
  readonly campaign?: HeaderCampaign | null;
  readonly wizardStep?: WizardStepCopy | undefined;
  readonly onActionClick?: (actionCode: string) => void;
  readonly back?: NavAction;
  readonly forward?: NavAction;
  readonly continueAction?: PrimaryAction;
  readonly searchTargets?: readonly SearchTarget[];
  readonly onSearchNavigate?: (id: string) => void;
  readonly onAdvanceMonth?: (() => void) | undefined;
  readonly advancingMonth?: boolean;
  readonly advanceDisabled?: boolean;
  readonly campaignMenu?: HeaderCampaignMenuProps;
  readonly briefing?: PriorityBriefingProps;
}

const NOOP = (): void => undefined;
const DISABLED_NAV: NavAction = { disabled: true, onTrigger: NOOP };

export function SiteHeader({
  title = translate("shell.header.title.default"),
  activeView = "menu",
  campaign = null,
  wizardStep,
  onActionClick,
  back = DISABLED_NAV,
  forward = DISABLED_NAV,
  continueAction,
  searchTargets = EMPTY_SEARCH_TARGETS,
  onSearchNavigate,
  onAdvanceMonth,
  advancingMonth = false,
  advanceDisabled = false,
  campaignMenu,
  briefing,
}: SiteHeaderProps) {
  const { platform } = useWindowContext();
  const isMac = platform === "darwin";

  return (
    <header
      className="sticky top-0 z-50 flex h-24 w-full shrink-0 flex-col border-b bg-background/70 backdrop-blur-md select-none supports-[backdrop-filter]:bg-background/60 group-data-[underlay=true]/chrome:bg-linear-to-b group-data-[underlay=true]/chrome:from-background/75 group-data-[underlay=true]/chrome:to-background/10 group-data-[underlay=true]/chrome:border-transparent group-data-[underlay=true]/chrome:backdrop-blur-sm group-data-[underlay=true]/chrome:supports-[backdrop-filter]:bg-transparent"
      style={DRAG}
    >
      <div
        className={cn(
          "flex h-14 w-full items-center gap-2 border-b pr-4 group-data-[underlay=true]/chrome:border-foreground/5",
          isMac ? "pl-25" : "pl-4",
        )}
      >
        <HeaderNav back={back} forward={forward} />

        <HeaderTitle title={title} />

        <div className="ml-auto flex items-center gap-2" style={NO_DRAG}>
          <GlobalSearch targets={searchTargets} onNavigate={(id) => onSearchNavigate?.(id)} />

          {continueAction !== undefined && <HeaderContinueAction action={continueAction} />}

          {campaign !== null && onAdvanceMonth !== undefined && (
            <HeaderAdvanceMonth
              onAdvance={onAdvanceMonth}
              advancing={advancingMonth}
              disabled={advanceDisabled}
            />
          )}

          {campaign !== null && campaignMenu !== undefined && (
            <HeaderCampaignMenu {...campaignMenu} />
          )}

          <HeaderChrome />
          <HeaderWindowControls />
        </div>
      </div>

      <div className="flex h-10 w-full items-center px-4">
        <HeaderSecondaryRow
          activeView={activeView}
          campaign={campaign}
          wizardStep={wizardStep}
          onActionClick={onActionClick}
          briefing={briefing}
        />
      </div>
    </header>
  );
}
