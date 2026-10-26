import { useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Crown,
  Eye,
  Info,
  Landmark,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "../components/ui/badge.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/ui/hover-card.js";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.js";
import { Toggle } from "../components/ui/toggle.js";
import { PinnedHint, usePinnableCard } from "./pinnable-card.js";
import { buildTrend, type TrendDetail } from "./status-strip-trend.js";
import { activeAlertsCount, type CampaignReads } from "./campaign-reads.js";
import { cn } from "../lib/utils.js";
import { useDensity } from "./DensityContext.js";
import { usePresentationFormat } from "./usePresentationFormat.js";
import {
  BalanceCard,
  BudgetLineCard,
  BudgetSummaryCard,
  PrestigeCard,
  ShipyardCard,
  StationsCard,
  TreasuryCard,
  TrendDelta,
} from "./StatusStripCards.js";
import {
  CardFoot,
  CardHeader,
  Histogram,
  Meter,
  MiniLine,
  Pips,
  SEGMENT_FILL,
  SegmentStack,
  TONE_FILL,
  percentString,
} from "./StatusStripGlyphs.js";
import {
  buildStatusStrip,
  NOT_YET_MODELLED,
  type AllocationSegment,
  type BudgetAllocation,
  type StatusStripModel,
  type StripRow,
  type StripTone,
} from "./status-strip-state.js";

const CHIP =
  "inline-flex h-7 items-center gap-2 rounded-md border border-border/70 bg-muted/30 px-2.5 text-xs outline-none transition-colors hover:border-admiralty-accent/50 hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring data-[pinned=true]:border-admiralty-accent";

const TILE =
  "relative flex min-w-0 cursor-help flex-col gap-1 rounded-md border border-border/60 bg-muted/30 px-2.5 py-2 text-left outline-none transition-colors hover:border-admiralty-accent/50 hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring data-[pinned=true]:border-admiralty-accent";

const FIELD_LABEL = "text-xs leading-4 text-muted-foreground";

const MAX_PORT_BARS = 14;

const RUNWAY_PIPS = 12;

const DESCRIPTIONS: Record<string, string> = {
  treasury: "Cash on hand at the start of the month.",
  maintenance: "Fleet upkeep charged every month.",
  research: "Monthly research spending.",
  balance:
    "Projected monthly appropriation minus total expenses. A negative figure is a deficit, shown in words as well as colour.",
};

function descriptionFor(row: StripRow): string {
  return row.note !== "" ? row.note : (DESCRIPTIONS[row.id] ?? "");
}

function StatusBadge({ status, tone }: { readonly status: string; readonly tone: StripTone }) {
  const Icon = tone === "alert" ? CircleAlert : CircleCheck;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 px-1.5 py-0 text-xs font-semibold uppercase tracking-wide text-foreground",
        tone === "alert"
          ? "border-destructive/40 bg-destructive/10"
          : "border-success/40 bg-success/10",
      )}
    >
      <Icon
        className={cn("size-3", tone === "alert" ? "text-destructive" : "text-success")}
        aria-hidden="true"
      />
      {status}
    </Badge>
  );
}

function PinnableCard({
  trigger,
  triggerClassName,
  triggerProps,
  children,
  card,
  width = "w-72",
  align,
  delay = 150,
  onActive,
  labelled = false,
}: {
  readonly trigger: ReactElement;
  readonly triggerClassName?: string;
  readonly triggerProps?: Record<string, string | number | boolean | CSSProperties | undefined>;
  readonly children?: ReactNode;
  readonly card: ReactNode;
  readonly width?: string;
  readonly align?: "start" | "center" | "end";
  readonly delay?: number;
  readonly onActive?: (open: boolean) => void;
  readonly labelled?: boolean;
}) {
  const pin = usePinnableCard(onActive);
  return (
    <HoverCard {...pin.rootProps}>
      <HoverCardTrigger
        delay={delay}
        render={trigger}
        className={triggerClassName}
        {...pin.triggerProps}
        {...(labelled ? { onKeyDown: pin.onKeyDown, role: "button" } : {})}
        {...triggerProps}
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align={align}
        sideOffset={10}
        collisionPadding={12}
        {...pin.contentProps}
        className={cn("p-0 text-xs leading-snug", width, pin.contentProps.className)}
      >
        {card}
        <PinnedHint pinned={pin.pinned} />
      </HoverCardContent>
    </HoverCard>
  );
}

function NoteCard({ row }: { readonly row: StripRow }) {
  return (
    <>
      <CardHeader title={row.label} tone={row.tone} />
      <p className="px-3 py-3">{descriptionFor(row)}</p>
    </>
  );
}

function Instrument({
  row,
  card,
  width,
  className,
  children,
}: {
  readonly row: StripRow;
  readonly card?: ReactNode;
  readonly width?: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const data = {
    "data-row": row.id,
    "data-tone": row.tone,
    "data-deferred": row.deferred,
  };
  const resolved = card ?? (descriptionFor(row) === "" ? undefined : <NoteCard row={row} />);
  if (resolved === undefined) {
    return (
      <div {...data} className={cn(TILE, "cursor-default", className)}>
        {children}
      </div>
    );
  }
  return (
    <PinnableCard
      trigger={<div />}
      labelled
      card={resolved}
      {...(width === undefined ? {} : { width })}
      triggerClassName={cn(TILE, className)}
      triggerProps={{ ...data, tabIndex: 0, "aria-label": `${row.label}: ${row.value}` }}
    >
      {children}
    </PinnableCard>
  );
}

function rowById(rows: readonly StripRow[], id: string): StripRow | undefined {
  return rows.find((row) => row.id === id);
}

function Panel({
  name,
  aside,
  className,
  children,
}: {
  readonly name: string;
  readonly aside?: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={name}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card/50",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-1.5">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold leading-5 tracking-tight">
          <span aria-hidden="true" className="h-3.5 w-0.5 rounded-full bg-admiralty-accent" />
          {name}
        </h2>
        {aside !== undefined && (
          <span title={aside} className="truncate text-xs font-medium text-muted-foreground">
            {aside}
          </span>
        )}
      </div>
      <div className="flex-1 px-3 py-2.5">{children}</div>
    </div>
  );
}

function PrestigeTile({ model }: { readonly model: StatusStripModel }) {
  const row = rowById(model.nation, "prestige");
  if (row === undefined) return null;
  const { prestige } = model;
  return (
    <Instrument
      row={row}
      className="col-span-2"
      card={
        <PrestigeCard gauge={prestige} note={row.note} explanation={model.prestigeExplanation} />
      }
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className={FIELD_LABEL}>{row.label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          sacked at {prestige.threshold}
        </span>
      </span>
      <span
        className={cn(
          "font-display text-2xl leading-7 font-semibold tabular-nums",
          prestige.atRisk && "text-destructive",
        )}
      >
        {row.value}
      </span>
      <Meter
        fraction={prestige.fraction}
        mark={prestige.thresholdFraction}
        fill={prestige.atRisk ? "bg-destructive" : "bg-admiralty-accent"}
      />
    </Instrument>
  );
}

function StationsTile({
  row,
  model,
}: {
  readonly row: StripRow;
  readonly model: StatusStripModel;
}) {
  const { stations } = model;
  const share =
    stations.foreignTonsFraction ?? (stations.total === 0 ? 0 : stations.foreign / stations.total);
  return (
    <Instrument row={row} width="w-80" card={<StationsCard stations={stations} />}>
      <span className={FIELD_LABEL}>{row.label}</span>
      <span className="font-display text-base leading-6 font-semibold tabular-nums">
        {row.value}
      </span>
      <Meter fraction={stations.unknown ? 0 : share} fill="bg-admiralty-signal" />
    </Instrument>
  );
}

function ShipyardTile({
  row,
  model,
}: {
  readonly row: StripRow;
  readonly model: StatusStripModel;
}) {
  return (
    <Instrument
      row={row}
      width="w-80"
      card={<ShipyardCard ports={model.ports} total={row.value} />}
    >
      <span className={FIELD_LABEL}>{row.label}</span>
      <span className="font-display text-base leading-6 font-semibold tabular-nums">
        {row.value}
      </span>
      <Histogram fractions={model.ports.slice(0, MAX_PORT_BARS).map((port) => port.fraction)} />
    </Instrument>
  );
}

function NationPanel({ model }: { readonly model: StatusStripModel }) {
  const rows = model.nation.filter((row) => !row.deferred && row.id !== "prestige");
  return (
    <Panel name="Nation" aside={model.nationName}>
      <div className="grid grid-cols-2 content-start gap-1.5">
        <PrestigeTile model={model} />
        {rows.map((row) => {
          if (row.id === "foreign-stations") {
            return <StationsTile key={row.id} row={row} model={model} />;
          }
          if (row.id === "shipyard-capacity") {
            return <ShipyardTile key={row.id} row={row} model={model} />;
          }
          return (
            <Instrument key={row.id} row={row}>
              <span className={FIELD_LABEL}>{row.label}</span>
              <span
                className={cn(
                  "font-display text-base leading-6 font-semibold tabular-nums",
                  row.tone === "alert" && "text-destructive",
                )}
              >
                {row.value}
              </span>
            </Instrument>
          );
        })}
      </div>
    </Panel>
  );
}

function AllocationBar({
  allocation,
  active,
  onActive,
  noteFor,
}: {
  readonly allocation: BudgetAllocation;
  readonly active: AllocationSegment["id"] | null;
  readonly onActive: (id: AllocationSegment["id"] | null) => void;
  readonly noteFor: (id: AllocationSegment["id"]) => string;
}) {
  const limit = allocation.overCommitted ? allocation.limit : null;
  return (
    <div className="relative pb-3">
      <div
        role="img"
        aria-label={`${allocation.committed.value} committed, ${allocation.committed.percent} of the monthly appropriation of ${allocation.appropriation}${allocation.overCommitted ? ", over-committed" : ""}`}
        className={cn(
          "slate-grid flex h-4 w-full gap-px overflow-hidden rounded-sm border border-border/70 bg-muted/60",
          allocation.overCommitted && "border-destructive/60",
        )}
      >
        {allocation.segments
          .filter((segment) => segment.fraction > 0)
          .map((segment) => (
            <PinnableCard
              key={segment.id}
              trigger={<span />}
              delay={80}
              onActive={(open) => {
                onActive(open ? segment.id : null);
              }}
              triggerProps={{
                "data-segment": segment.id,
                "data-active": active === segment.id,
                style: { width: percentString(segment.fraction) },
              }}
              triggerClassName={cn(
                "h-full min-w-0.5 cursor-help transition-[opacity,filter] duration-150",
                SEGMENT_FILL[segment.id],
                active !== null && active !== segment.id && "opacity-30",
                active === segment.id && "brightness-125",
              )}
              card={
                <BudgetLineCard
                  segment={segment}
                  allocation={allocation}
                  note={noteFor(segment.id)}
                />
              }
            />
          ))}
      </div>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex h-2 justify-between">
        {Array.from({ length: 11 }, (_, index) => (
          <span key={index} className={cn("w-px bg-border", index % 5 === 0 ? "h-2" : "h-1")} />
        ))}
      </span>
      {limit !== null && (
        <span
          aria-hidden="true"
          className="absolute -top-1 bottom-1 w-0.5 bg-foreground"
          style={{ left: percentString(limit) }}
        />
      )}
    </div>
  );
}

function BudgetPanel({ model }: { readonly model: StatusStripModel }) {
  const { allocation } = model;
  const [active, setActive] = useState<AllocationSegment["id"] | null>(null);
  const appropriation = rowById(model.budget, "monthly-budget");
  const committedRow = rowById(model.budget, "total-expenses");
  const noteFor = (id: AllocationSegment["id"]) => rowById(model.budget, id)?.note ?? "";
  return (
    <Panel name="Budget" aside="Monthly" className="@container">
      <div className="space-y-2">
        <div data-row="monthly-budget" className="flex items-baseline justify-between gap-3">
          <span className={FIELD_LABEL}>{appropriation?.label ?? "Monthly appropriation"}</span>
          <span className="font-display text-xl leading-6 font-semibold tabular-nums">
            {allocation.appropriation}
          </span>
        </div>
        <AllocationBar
          allocation={allocation}
          active={active}
          onActive={setActive}
          noteFor={noteFor}
        />
        <div className="grid gap-x-3 gap-y-0.5 @lg:grid-cols-2">
          {allocation.segments.map((segment) => (
            <div
              key={segment.id}
              onMouseEnter={() => {
                setActive(segment.id);
              }}
              onMouseLeave={() => {
                setActive(null);
              }}
            >
              <PinnableCard
                trigger={<div />}
                labelled
                delay={200}
                onActive={(open) => {
                  setActive(open ? segment.id : null);
                }}
                triggerProps={{
                  "data-row": segment.id,
                  "data-active": active === segment.id,
                  tabIndex: 0,
                  "aria-label": `${segment.label}: ${segment.value}, ${segment.percent}`,
                }}
                triggerClassName={cn(
                  "grid cursor-help grid-cols-[auto_minmax(0,1fr)_auto_2.5rem] items-center gap-x-2 rounded-sm px-1.5 py-1 text-xs outline-none transition-[opacity,background-color] hover:bg-muted/60 focus-visible:ring-1 focus-visible:ring-ring data-[pinned=true]:bg-muted/60",
                  active !== null && active !== segment.id && "opacity-50",
                )}
                card={
                  <BudgetLineCard
                    segment={segment}
                    allocation={allocation}
                    note={noteFor(segment.id)}
                  />
                }
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2.5 rounded-[2px]", SEGMENT_FILL[segment.id])}
                />
                <span className="min-w-0 break-words text-muted-foreground">{segment.label}</span>
                <span className="font-medium tabular-nums">{segment.value}</span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {segment.percent}
                </span>
              </PinnableCard>
            </div>
          ))}
        </div>
        <PinnableCard
          trigger={<div />}
          labelled
          delay={200}
          triggerProps={{
            "data-row": "total-expenses",
            tabIndex: 0,
            "aria-label": `Committed expenses: ${allocation.committed.value}`,
          }}
          triggerClassName="flex cursor-help items-center justify-between gap-3 rounded-sm border-t border-border/60 px-1.5 pt-2 text-xs outline-none hover:bg-muted/40 focus-visible:ring-1 focus-visible:ring-ring"
          card={committedRow === undefined ? <></> : <NoteCard row={committedRow} />}
        >
          <span className="text-muted-foreground">
            {committedRow?.label ?? "Committed expenses"}
          </span>
          <span className="flex items-center gap-1.5">
            {allocation.overCommitted && (
              <Badge
                variant="outline"
                className="gap-1 border-destructive/40 bg-destructive/10 px-1.5 py-0 text-xs font-semibold uppercase tracking-wide text-foreground"
              >
                <CircleAlert className="size-3 text-destructive" aria-hidden="true" />
                Over-committed
              </Badge>
            )}
            <span className="font-display text-sm font-semibold tabular-nums">
              {allocation.committed.value}
            </span>
            <span className="w-10 text-right tabular-nums text-muted-foreground">
              {allocation.committed.percent}
            </span>
          </span>
        </PinnableCard>
      </div>
    </Panel>
  );
}

function OutlookPanel({
  model,
  trend,
}: {
  readonly model: StatusStripModel;
  readonly trend: TrendDetail | null;
}) {
  const balance = rowById(model.budget, "balance");
  const treasury = rowById(model.budget, "treasury");
  const runway = rowById(model.budget, "runway");
  const shortfall = rowById(model.budget, "shortfall");
  const alert = balance?.tone === "alert";
  const runwayMonths = model.outlook.runwayMonths;
  return (
    <Panel name="Outlook">
      <div className="space-y-2">
        {balance !== undefined && (
          <Instrument
            row={balance}
            card={<BalanceCard outlook={model.outlook} trend={trend} />}
            width="w-96"
            className={cn(
              "gap-0.5 py-2",
              alert ? "border-destructive/40 bg-destructive/10" : "border-success/30 bg-success/10",
            )}
          >
            <span className={cn(FIELD_LABEL, "text-foreground/80")}>{balance.label}</span>
            <span className="flex items-center justify-between gap-2">
              <span className="font-display text-2xl leading-8 font-semibold tabular-nums">
                {balance.value}
              </span>
              <span className="flex flex-col items-end gap-1">
                {balance.status !== undefined && (
                  <StatusBadge status={balance.status} tone={balance.tone} />
                )}
                {trend !== null && trend.net.values.length > 1 && (
                  <MiniLine values={trend.net.values} tone={balance.tone} />
                )}
              </span>
            </span>
          </Instrument>
        )}
        <div className="space-y-1">
          {treasury !== undefined && (
            <Instrument
              row={treasury}
              card={<TreasuryCard outlook={model.outlook} trend={trend} />}
              width="w-80"
              className="flex-row items-center justify-between gap-3 py-1.5"
            >
              <span className={FIELD_LABEL}>{treasury.label}</span>
              <span className="flex items-baseline gap-1.5">
                {trend !== null && <TrendDelta series={trend.treasury} className="text-xs" />}
                <span className="font-display text-sm font-semibold tabular-nums">
                  {treasury.value}
                </span>
              </span>
            </Instrument>
          )}
          {runway !== undefined && (
            <Instrument row={runway} className="gap-1 py-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className={FIELD_LABEL}>{runway.label}</span>
                <span className="text-xs font-medium tabular-nums">{runway.value}</span>
              </span>
              <Pips
                filled={Math.min(runwayMonths ?? 0, RUNWAY_PIPS)}
                total={RUNWAY_PIPS}
                fill={(runwayMonths ?? 0) <= 3 ? TONE_FILL.alert : "bg-admiralty-signal"}
              />
            </Instrument>
          )}
          {shortfall !== undefined && (
            <Instrument
              row={shortfall}
              className="flex-row items-center justify-between gap-3 border-destructive/40 bg-destructive/10 py-1.5"
            >
              <span className={FIELD_LABEL}>{shortfall.label}</span>
              <span className="text-xs font-semibold tabular-nums text-destructive">
                {shortfall.value}
              </span>
            </Instrument>
          )}
        </div>
      </div>
    </Panel>
  );
}

function DeferredPopover({ model }: { readonly model: StatusStripModel }) {
  const { deferredRows: rows } = model;
  if (rows.length === 0) return null;
  const groups = [
    { name: "Nation", rows: model.nation.filter((row) => row.deferred) },
    { name: "Budget", rows: model.budget.filter((row) => row.deferred) },
  ].filter((group) => group.rows.length > 0);
  return (
    <Popover>
      <PopoverTrigger
        render={<button type="button" />}
        className="inline-flex h-5 items-center gap-1 rounded-md border bg-transparent px-1.5 text-xs font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring data-popup-open:bg-accent"
      >
        <Eye className="size-3.5" aria-hidden="true" />
        <span>
          {NOT_YET_MODELLED} ({rows.length})
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" aria-label={NOT_YET_MODELLED} className="w-96 p-0">
        <div className="border-b px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
            {NOT_YET_MODELLED}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Named in RTW3 but not modelled by the campaign yet. These are never shown as numbers.
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {groups.map((group) => (
            <section key={group.name} aria-label={`${group.name} readouts`}>
              <p className="sticky top-0 flex items-center justify-between bg-popover/95 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground backdrop-blur-sm">
                {group.name}
                <span className="tabular-nums">{group.rows.length}</span>
              </p>
              <ul className="divide-y divide-border/60">
                {group.rows.map((row) => (
                  <li
                    key={row.id}
                    data-row={row.id}
                    data-tone={row.tone}
                    data-deferred={row.deferred}
                    className="px-3 py-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium">{row.label}</span>
                      <Badge
                        variant="outline"
                        className="shrink-0 px-1.5 py-0 text-xs text-muted-foreground"
                      >
                        {NOT_YET_MODELLED}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{row.note}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BalanceChip({
  model,
  trend,
}: {
  readonly model: StatusStripModel;
  readonly trend: TrendDetail | null;
}) {
  const { summary } = model;
  const alert = summary.balance.tone === "alert";
  return (
    <PinnableCard
      trigger={<button type="button" />}
      align="start"
      triggerProps={{
        "aria-label": `Monthly balance ${summary.balance.value}, ${summary.balance.status}`,
      }}
      triggerClassName={cn(CHIP, "cursor-help", alert && "border-destructive/40 bg-destructive/10")}
      card={<BalanceCard outlook={model.outlook} trend={trend} />}
      width="w-96"
    >
      {alert ? (
        <TrendingDown className="size-3.5 text-destructive" aria-hidden="true" />
      ) : (
        <TrendingUp className="size-3.5 text-success" aria-hidden="true" />
      )}
      <span className="text-muted-foreground">Balance</span>
      <span className={cn("font-display tabular-nums font-semibold", alert && "text-destructive")}>
        {summary.balance.value}
      </span>
      {trend !== null && trend.net.values.length > 1 && (
        <MiniLine values={trend.net.values} tone={summary.balance.tone} className="h-4 w-12" />
      )}
      <StatusBadge status={summary.balance.status} tone={summary.balance.tone} />
    </PinnableCard>
  );
}

function TreasuryChip({
  model,
  trend,
}: {
  readonly model: StatusStripModel;
  readonly trend: TrendDetail | null;
}) {
  return (
    <PinnableCard
      trigger={<button type="button" />}
      triggerProps={{
        "aria-label":
          trend?.treasury.delta == null
            ? `Treasury ${model.summary.treasury}`
            : `Treasury ${model.summary.treasury}, ${trend.treasury.delta} on ${trend.treasury.labels.at(-2) ?? "the previous month"}`,
      }}
      triggerClassName={CHIP}
      card={<TreasuryCard outlook={model.outlook} trend={trend} />}
      width="w-80"
    >
      <Landmark className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">Treasury</span>
      <span className="font-display tabular-nums font-semibold">{model.summary.treasury}</span>
      {trend !== null && <TrendDelta series={trend.treasury} />}
    </PinnableCard>
  );
}

function PrestigeChip({ model }: { readonly model: StatusStripModel }) {
  const row = rowById(model.nation, "prestige");
  if (row === undefined) return null;
  const { prestige } = model;
  return (
    <PinnableCard
      trigger={<button type="button" />}
      triggerProps={{ "aria-label": `Prestige ${row.value}` }}
      triggerClassName={cn(
        CHIP,
        "cursor-help",
        prestige.atRisk && "border-destructive/40 bg-destructive/10",
      )}
      card={
        <PrestigeCard gauge={prestige} note={row.note} explanation={model.prestigeExplanation} />
      }
    >
      <Crown
        className={cn("size-3.5", prestige.atRisk ? "text-destructive" : "text-admiralty-accent")}
        aria-hidden="true"
      />
      <span className="text-muted-foreground">Prestige</span>
      <span className="font-display tabular-nums font-semibold">{row.value}</span>
    </PinnableCard>
  );
}

function BudgetChip({ model }: { readonly model: StatusStripModel }) {
  const { allocation } = model;
  return (
    <PinnableCard
      trigger={<button type="button" />}
      width="w-80"
      triggerProps={{
        "aria-label": `Budget: ${allocation.committed.value} committed, ${allocation.committed.percent} of ${allocation.appropriation}`,
      }}
      triggerClassName={cn(
        CHIP,
        "cursor-help",
        allocation.overCommitted && "border-destructive/40 bg-destructive/10",
      )}
      card={<BudgetSummaryCard allocation={allocation} />}
    >
      <Scale className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <SegmentStack segments={allocation.segments} className="h-2 w-20" />
      <span className="tabular-nums font-semibold">{allocation.committed.percent}</span>
    </PinnableCard>
  );
}

function AlertsChip({ alerts }: { readonly alerts: string }) {
  const unavailable = alerts.toLowerCase().includes("unavailable");
  return (
    <PinnableCard
      trigger={<button type="button" />}
      width="w-64"
      triggerProps={{ "aria-label": `Priorities: ${alerts}` }}
      triggerClassName={cn(CHIP, unavailable && "text-muted-foreground")}
      card={
        <>
          <CardHeader title="Priorities" icon={<Bell className="size-3.5" aria-hidden="true" />} />
          <p className="px-3 py-2.5 text-sm font-semibold">{alerts}</p>
          <CardFoot>
            {unavailable
              ? "The priorities projection could not be read, so no count is shown."
              : "Strategic priorities the campaign has raised for attention. Open Overview to act on them."}
          </CardFoot>
        </>
      }
    >
      {unavailable ? (
        <CircleAlert className="size-3.5" aria-hidden="true" />
      ) : (
        <Bell className="size-3.5 text-muted-foreground" aria-hidden="true" />
      )}
      <span>{alerts}</span>
    </PinnableCard>
  );
}

export function StatusStripView({
  model,
  trend = null,
}: {
  readonly model: StatusStripModel;
  readonly trend?: TrendDetail | null;
}) {
  const { density } = useDensity();
  const [chosen, setChosen] = useState<boolean | null>(null);
  const expanded = chosen ?? density !== "compact";
  const { summary } = model;

  return (
    <section
      aria-label="Status strip"
      data-testid="status-strip"
      data-expanded={expanded}
      className="relative shrink-0 border-t bg-background/70 px-3 py-0 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 group-data-[underlay=true]/chrome:border-transparent group-data-[underlay=true]/chrome:bg-linear-to-t group-data-[underlay=true]/chrome:from-background/75 group-data-[underlay=true]/chrome:to-background/10 group-data-[underlay=true]/chrome:backdrop-blur-sm group-data-[underlay=true]/chrome:supports-[backdrop-filter]:bg-transparent"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-admiralty-accent/60 to-transparent"
      />
      <div className="flex items-center gap-2 text-xs">
        {expanded ? (
          <span className="flex items-center gap-2 py-1 font-display text-sm font-semibold">
            <span className="relative grid size-2 place-items-center" aria-hidden="true">
              <span className="absolute size-2 animate-ping rounded-full bg-success/60 motion-reduce:animate-none" />
              <span className="size-1.5 rounded-full bg-success" />
            </span>
            Status
          </span>
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-1">
            <BalanceChip model={model} trend={trend} />
            <TreasuryChip model={model} trend={trend} />
            <BudgetChip model={model} />
            <PrestigeChip model={model} />
            <AlertsChip alerts={summary.alerts} />
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <DeferredPopover model={model} />
          <Toggle
            variant="outline"
            size="sm"
            pressed={expanded}
            onPressedChange={setChosen}
            className="h-5 min-w-0 gap-1 px-1.5 text-xs"
          >
            {expanded ? (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronUp className="size-3.5" aria-hidden="true" />
            )}
            <span>{expanded ? "Collapse" : "Expand"}</span>
          </Toggle>
        </div>
      </div>

      {expanded && (
        <div className="mt-1 grid gap-2 border-t border-border/60 py-2 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)]">
          <NationPanel model={model} />
          <BudgetPanel model={model} />
          <OutlookPanel model={model} trend={trend} />
        </div>
      )}
    </section>
  );
}

export interface StatusStripProps {
  readonly reads: CampaignReads;
}

export function StatusStrip({ reads }: StatusStripProps) {
  const { projection, areas, reports } = reads;
  const format = usePresentationFormat();
  if (projection.status !== "ready") return null;
  return (
    <StatusStripView
      trend={buildTrend(reports.status === "ready" ? reports.value : null, format)}
      model={buildStatusStrip({
        projection: projection.value,
        areas: areas.status === "ready" ? areas.value : null,
        alertsCount: activeAlertsCount(reads),
        format,
      })}
    />
  );
}
