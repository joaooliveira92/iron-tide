import { Swords } from "lucide-react";
import { useMemo } from "react";

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
import { LedgerTable } from "./LedgerTable.js";
import { SegmentCard } from "./SegmentCard.js";

const SHIP_LIST_LIMIT = 12;

function GroupRow({ segment }: { readonly segment: UpkeepSegment }) {
  const format = usePresentationFormat();
  const multiplier = format.number(segment.multiplier, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <LedgerTable.Row
      ariaLabel={`${segment.label}: ${format.count(segment.cost)} for ${segment.ships} ships — show detail`}
      detail={
        <SegmentCard
          swatchClassName={segment.className}
          title={segment.label}
          amount={format.money(segment.cost)}
          description={segment.description}
          facts={[
            { label: "Ships", value: format.count(segment.ships) },
            { label: "Rate against active", value: `×${multiplier}` },
            {
              label: "Share of upkeep",
              value: `${format.number(segment.shareOfUpkeep * 100, { maximumFractionDigits: 0 })}%`,
            },
          ]}
        />
      }
    >
      <LedgerTable.Swatch className={segment.className} />
      <LedgerTable.Label>
        {segment.label}{" "}
        <span className="text-xs text-muted-foreground">
          {segment.ships} {segment.ships === 1 ? "ship" : "ships"}
        </span>
      </LedgerTable.Label>
      <LedgerTable.Bar share={segment.shareOfUpkeep} fillClassName={segment.className} />
      <LedgerTable.Amount>{format.count(segment.cost)}</LedgerTable.Amount>
      <LedgerTable.Note>×{multiplier}</LedgerTable.Note>
    </LedgerTable.Row>
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
  const segments = useMemo(() => upkeepSegments(fleet), [fleet]);
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
          <LedgerTable.Root columns="fleet">
            {segments.map((segment) => (
              <GroupRow key={segment.readiness} segment={segment} />
            ))}
          </LedgerTable.Root>
        </>
      )}

      {topShips.length > 0 && (
        <section aria-label="Dearest ships" className="space-y-1">
          <h4 className="px-2 text-xs text-muted-foreground">Dearest ships to keep</h4>
          <LedgerTable.Root columns="fleet">
            {topShips.map((ship) => {
              const style = READINESS_STYLE[ship.readiness];
              return (
                <LedgerTable.Row
                  key={ship.id}
                  ariaLabel={`${ship.name}: ${format.count(ship.cost)} a month, ${style.label} — show detail`}
                  detail={
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
                  }
                >
                  <LedgerTable.Swatch className={style.className} />
                  <LedgerTable.Label className="truncate">{ship.name}</LedgerTable.Label>
                  <LedgerTable.Bar
                    share={shareOf(ship.cost, topCost)}
                    fillClassName={style.className}
                  />
                  <LedgerTable.Amount>{format.count(ship.cost)}</LedgerTable.Amount>
                  <LedgerTable.Note>{style.label}</LedgerTable.Note>
                </LedgerTable.Row>
              );
            })}
          </LedgerTable.Root>
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
