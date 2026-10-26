import { Swords } from "lucide-react";

import { Badge } from "../../../components/ui/badge.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { FleetUpkeep } from "../../../../shared/budget-contract.js";
import {
  READINESS_STYLE,
  shareOf,
  upkeepSegments,
  type UpkeepSegment,
} from "../commitments-view.js";
import { SegmentCard } from "./SegmentCard.js";

const ROW =
  "grid w-full grid-cols-[0.75rem_minmax(0,1fr)_minmax(3rem,8rem)_4rem_5.5rem] items-center gap-x-3 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring";
const SHIP_LIST_LIMIT = 12;

function GroupRow({ segment }: { readonly segment: UpkeepSegment }) {
  const format = usePresentationFormat();
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        render={<button type="button" />}
        aria-label={`${segment.label}: ${format.count(segment.cost)} for ${segment.ships} ships — show detail`}
        className={ROW}
      >
        <span aria-hidden="true" className={cn("size-2.5 rounded-sm", segment.className)} />
        <span>
          {segment.label}{" "}
          <span className="text-xs text-muted-foreground">
            {segment.ships} {segment.ships === 1 ? "ship" : "ships"}
          </span>
        </span>
        <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className={cn("block h-full rounded-full", segment.className)}
            style={{ width: `${segment.shareOfUpkeep * 100}%` }}
          />
        </span>
        <span className="text-right font-medium tabular-nums">{format.count(segment.cost)}</span>
        <span className="text-right text-xs tabular-nums text-muted-foreground">
          ×
          {format.number(segment.multiplier, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="left" align="center" className="w-72">
        <SegmentCard
          swatchClassName={segment.className}
          title={segment.label}
          amount={format.money(segment.cost)}
          description={segment.description}
          facts={[
            { label: "Ships", value: format.count(segment.ships) },
            {
              label: "Rate against active",
              value: `×${format.number(segment.multiplier, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
            {
              label: "Share of upkeep",
              value: `${format.number(segment.shareOfUpkeep * 100, { maximumFractionDigits: 0 })}%`,
            },
          ]}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

export function FleetUpkeepTab({
  fleet,
  income,
}: {
  readonly fleet: FleetUpkeep;
  readonly income: number;
}) {
  const format = usePresentationFormat();
  const segments = upkeepSegments(fleet);
  const topShips = fleet.ships.slice(0, SHIP_LIST_LIMIT);
  const topCost = topShips[0]?.cost ?? 0;
  const hidden = fleet.ships.length - topShips.length;

  return (
    <div className="space-y-6" data-testid="fleet-upkeep">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-base font-medium tracking-tight">
          {fleet.ships.length === 0
            ? "No ships on the books, so nothing to maintain."
            : `The fleet costs ${format.count(fleet.total)} a month to keep, ${format.number(
                shareOf(fleet.total, income) * 100,
                { maximumFractionDigits: 0 },
              )}% of income.`}
        </p>
        {fleet.atWar && (
          <HoverCard>
            <HoverCardTrigger
              delay={0}
              closeDelay={0}
              render={<button type="button" />}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Badge variant="outline" className="gap-1 border-destructive/50 text-destructive">
                <Swords aria-hidden="true" className="size-3" />
                At war +{format.count(fleet.warSurcharge)}
              </Badge>
            </HoverCardTrigger>
            <HoverCardContent side="bottom" align="start" className="w-72">
              <SegmentCard
                title="Wartime surcharge"
                amount={format.money(fleet.warSurcharge)}
                description="While your nation is at war, every active ship costs more to keep. Ships in reserve, mothballed or in repair are not affected."
              />
            </HoverCardContent>
          </HoverCard>
        )}
      </div>

      {segments.length > 0 && (
        <>
          <div
            role="img"
            aria-label={`Fleet upkeep by readiness: ${segments
              .map((segment) => `${segment.label} ${format.count(segment.cost)}`)
              .join(", ")}`}
            className="flex h-8 w-full overflow-hidden rounded-md bg-muted/70 ring-1 ring-border"
          >
            {segments.map((segment) => (
              <div
                key={segment.readiness}
                className={cn(
                  "h-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
                  segment.className,
                )}
                style={{ width: `${segment.shareOfUpkeep * 100}%` }}
              />
            ))}
          </div>
          <div className="space-y-0.5">
            {segments.map((segment) => (
              <GroupRow key={segment.readiness} segment={segment} />
            ))}
          </div>
        </>
      )}

      {topShips.length > 0 && (
        <section aria-label="Dearest ships" className="space-y-1">
          <h4 className="px-2 text-xs text-muted-foreground">Dearest ships to keep</h4>
          <ul className="space-y-0.5">
            {topShips.map((ship) => {
              const style = READINESS_STYLE[ship.readiness];
              return (
                <li key={ship.id}>
                  <HoverCard>
                    <HoverCardTrigger
                      delay={0}
                      closeDelay={0}
                      render={<button type="button" />}
                      aria-label={`${ship.name}: ${format.count(ship.cost)} a month, ${style.label} — show detail`}
                      className={ROW}
                    >
                      <span
                        aria-hidden="true"
                        className={cn("size-2.5 rounded-sm", style.className)}
                      />
                      <span className="truncate">{ship.name}</span>
                      <span
                        aria-hidden="true"
                        className="h-1.5 overflow-hidden rounded-full bg-muted"
                      >
                        <span
                          className={cn("block h-full rounded-full", style.className)}
                          style={{ width: `${shareOf(ship.cost, topCost) * 100}%` }}
                        />
                      </span>
                      <span className="text-right font-medium tabular-nums">
                        {format.count(ship.cost)}
                      </span>
                      <span className="text-right text-xs text-muted-foreground">
                        {style.label}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent side="left" align="center" className="w-72">
                      <SegmentCard
                        swatchClassName={style.className}
                        title={ship.name}
                        amount={format.money(ship.cost)}
                        description={style.description}
                        facts={[
                          {
                            label: "Share of fleet upkeep",
                            value: `${format.number(shareOf(ship.cost, fleet.total) * 100, { maximumFractionDigits: 1 })}%`,
                          },
                        ]}
                        note={
                          ship.overBase
                            ? "Stationed beyond its base, which adds to its upkeep."
                            : null
                        }
                      />
                    </HoverCardContent>
                  </HoverCard>
                </li>
              );
            })}
          </ul>
          {hidden > 0 && (
            <p className="px-2 text-xs text-muted-foreground">
              and {format.count(hidden)} cheaper {hidden === 1 ? "ship" : "ships"}.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
