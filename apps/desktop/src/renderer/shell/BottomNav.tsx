import { DEBUG_MODE } from "./debug-flag.js";
import { cn } from "../lib/utils.js";
import { translate } from "../lib/strings.js";
import { CAMPAIGN_NAVIGATION_SECTIONS, showsCampaignNavigation } from "./campaign-navigation.js";
import type { Screen } from "./campaign-screen-registry.js";
import { Tip } from "../components/ui/tip.js";
import { shouldShowTooltip, useTooltipDetail } from "./tooltip-detail.js";

export interface BottomNavProps {
  readonly screen: Screen;
  readonly onSelect: (screen: Screen) => void;
  readonly footer?: string;
}

export function BottomNav({ screen, onSelect, footer }: BottomNavProps) {
  const tooltipDetail = useTooltipDetail();
  if (!showsCampaignNavigation(screen)) return null;

  return (
    <nav
      aria-label={translate("nav.bottom.landmark")}
      data-testid="bottom-nav"
      className="shrink-0 border-t bg-background/70 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] backdrop-blur-md select-none supports-[backdrop-filter]:bg-background/60 group-data-[underlay=true]/chrome:border-transparent group-data-[underlay=true]/chrome:bg-background/90 group-data-[underlay=true]/chrome:backdrop-blur-xl group-data-[underlay=true]/chrome:supports-[backdrop-filter]:bg-background/80"
    >
      <ul className="flex w-full items-stretch gap-1 overflow-x-auto px-2 py-1">
        {CAMPAIGN_NAVIGATION_SECTIONS.flatMap((section) => section.items).map((item) => {
          const active = screen === item.id;
          return (
            <li key={item.id} className="min-w-16 flex-1">
              <Tip label={item.label} side="top" disabled={!shouldShowTooltip(tooltipDetail)}>
                <button
                  type="button"
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  data-active={active}
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-xs leading-tight outline-none",
                    "hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring",
                    "data-[active=true]:bg-accent data-[active=true]:font-medium data-[active=true]:text-accent-foreground",
                  )}
                >
                  <item.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="max-w-full whitespace-nowrap">{item.shortLabel}</span>
                </button>
              </Tip>
            </li>
          );
        })}
      </ul>
      {DEBUG_MODE && footer !== undefined && (
        <span className="block truncate px-3 pb-1 font-mono text-[12px] text-muted-foreground">
          {footer}
        </span>
      )}
    </nav>
  );
}
