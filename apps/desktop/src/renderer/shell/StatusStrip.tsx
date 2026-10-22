import { useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Eye,
  Info,
  Landmark,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "../components/ui/badge.js";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../components/ui/hover-card.js";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover.js";
import { Toggle } from "../components/ui/toggle.js";
import { PinnedHint, usePinnableCard } from "./pinnable-card.js";
import { buildTrend, type TrendDetail } from "./status-strip-trend.js";
import { cn } from "../lib/utils.js";
import { useBridgeQuery } from "../lib/use-bridge-query.js";
import { useDensity } from "./DensityContext.js";
import {
  BalanceCard,
  BudgetLineCard,
  CardFoot,
  CardHeader,
  SEGMENT_FILL,
  ShipyardCard,
  StationsCard,
  TreasuryCard,
  TrendDelta,
} from "./StatusStripCards.js";
import {
  buildStatusStrip,
  NOT_YET_MODELLED,
  type AllocationSegment,
  type BudgetAllocation,
  type StatusStripModel,
  type StripRow,
  type StripTone,
} from "./status-strip-state.js";

/** Shared pill shell for the compact summary row (collapsed strip). */
const CHIP =
  "inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring";

const LABEL_FIELD = "flex min-w-0 items-center gap-1 text-xs leading-4 text-muted-foreground";

/**
 * Plain-English explanation for readouts whose engine note is empty. The rest carry their own note
 * (a caveat) from the view model, and deferred rows carry their reason.
 */
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

/** A surplus/deficit stamp. The word is always present, so colour is never the only signal. */
function StatusBadge({ status, tone }: { readonly status: string; readonly tone: StripTone }) {
  // The text stays body-coloured: the red and green text tokens miss 4.5:1 on their own tints.
  // Colour rides on the border, tint and icon, and the word carries the meaning.
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

/**
 * A hover card that a click pins open (see `usePinnableCard`). It owns the trigger element and the
 * card; `triggerProps` carries the trigger's own attributes (aria-label, data-*, style).
 */
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
  /** A trigger that is not a real button needs Enter and Space to pin. */
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
        {...pin.contentProps}
        className={cn(
          "overflow-hidden p-0 text-xs leading-snug",
          width,
          pin.contentProps.className,
        )}
      >
        {card}
        <PinnedHint pinned={pin.pinned} />
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * A readout label that explains itself on hover or keyboard focus. `card` replaces the one-line
 * explanation with a full panel; `onOpenChange` lets a caller link the card to something else
 * on the band (the budget bar highlights the line being described).
 */
function ReadoutLabel({
  row,
  wrap = false,
  className,
  card,
  onOpenChange,
}: {
  readonly row: StripRow;
  readonly wrap?: boolean;
  readonly className?: string;
  readonly card?: ReactNode;
  readonly onOpenChange?: (open: boolean) => void;
}) {
  const description = descriptionFor(row);
  // Wrapped labels keep their full text; truncating "Shipyard capacity (port levels)" hid meaning.
  const fit = wrap ? "break-words" : "truncate";
  if (description === "" && card === undefined) {
    return <span className={cn(LABEL_FIELD, fit, className)}>{row.label}</span>;
  }
  return (
    <PinnableCard
      trigger={<span tabIndex={0} />}
      labelled
      delay={200}
      onActive={onOpenChange}
      triggerClassName={cn(
        LABEL_FIELD,
        fit,
        className,
        "cursor-help underline decoration-muted-foreground/30 decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:text-foreground",
      )}
      card={
        card ?? (
          <>
            <CardHeader title={row.label} />
            <p className="px-3 py-2.5">{description}</p>
          </>
        )
      }
    >
      {row.label}
    </PinnableCard>
  );
}

function rowById(rows: readonly StripRow[], id: string): StripRow | undefined {
  return rows.find((row) => row.id === id);
}

/** A titled card holding one group of readouts. */
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
      className={cn("flex min-w-0 flex-col rounded-lg border bg-card/40 px-3 py-2", className)}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase leading-4 tracking-widest text-muted-foreground">
          {name}
        </h2>
        {aside !== undefined && (
          <span title={aside} className="truncate text-xs font-medium text-foreground/80">
            {aside}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** One headline figure: a small label over a large tabular value. */
function StatTile({ row, card }: { readonly row: StripRow; readonly card?: ReactNode }) {
  return (
    <div
      data-row={row.id}
      data-tone={row.tone}
      data-deferred={row.deferred}
      className="min-w-0 rounded-md bg-muted/40 px-2.5 py-1.5"
    >
      <ReadoutLabel row={row} wrap card={card} />
      <div className="text-base leading-6 font-semibold tabular-nums">{row.value}</div>
    </div>
  );
}

/** A plain label-and-value line, for the small supporting figures. */
function LedgerLine({
  row,
  card,
  extra,
}: {
  readonly row: StripRow;
  readonly card?: ReactNode;
  readonly extra?: ReactNode;
}) {
  return (
    <div
      data-row={row.id}
      data-tone={row.tone}
      data-deferred={row.deferred}
      className="flex items-baseline justify-between gap-3"
    >
      <ReadoutLabel row={row} card={card} />
      <span className="flex items-baseline gap-1.5">
        {extra}
        <span
          className={cn(
            "text-xs font-medium tabular-nums",
            row.tone === "alert" && "font-semibold text-destructive",
          )}
        >
          {row.value}
        </span>
      </span>
    </div>
  );
}

/**
 * The appropriation as one bar; the empty track is what is left after the committed lines. Each
 * segment opens the same card as its legend row, and `active` dims the rest so the two read as one.
 */
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
  return (
    <div
      role="img"
      aria-label={`${allocation.committed.value} committed, ${allocation.committed.percent} of the monthly appropriation of ${allocation.appropriation}${allocation.overCommitted ? ", over-committed" : ""}`}
      className={cn(
        "flex h-2.5 w-full gap-px overflow-hidden rounded-full bg-muted",
        allocation.overCommitted && "ring-1 ring-destructive/50",
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
              // A tiny but real line keeps a visible sliver; the legend carries its exact share.
              style: { width: `${String(Math.round(segment.fraction * 1000) / 10)}%` },
            }}
            triggerClassName={cn(
              "h-full min-w-0.5 cursor-help transition-[opacity,filter] first:rounded-l-full last:rounded-r-full",
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
          {appropriation === undefined ? (
            <span className={LABEL_FIELD}>Monthly appropriation</span>
          ) : (
            <ReadoutLabel row={appropriation} />
          )}
          <span className="text-base leading-6 font-semibold tabular-nums">
            {allocation.appropriation}
          </span>
        </div>
        <AllocationBar
          allocation={allocation}
          active={active}
          onActive={setActive}
          noteFor={noteFor}
        />
        <div className="grid gap-x-6 gap-y-0.5 @lg:grid-cols-2">
          {allocation.segments.map((segment) => {
            const row = rowById(model.budget, segment.id);
            const card = (
              <BudgetLineCard
                segment={segment}
                allocation={allocation}
                note={noteFor(segment.id)}
              />
            );
            return (
              <div
                key={segment.id}
                data-row={segment.id}
                data-active={active === segment.id}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto_2.5rem] items-baseline gap-x-1.5 rounded-sm transition-opacity",
                  active !== null && active !== segment.id && "opacity-50",
                )}
                onMouseEnter={() => {
                  setActive(segment.id);
                }}
                onMouseLeave={() => {
                  setActive(null);
                }}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2 self-center rounded-sm", SEGMENT_FILL[segment.id])}
                />
                <ReadoutLabel
                  row={
                    row === undefined
                      ? {
                          id: segment.id,
                          label: segment.label,
                          value: segment.value,
                          deferred: false,
                          note: "",
                          tone: "normal",
                        }
                      : { ...row, label: segment.label }
                  }
                  wrap
                  card={card}
                  onOpenChange={(open) => {
                    setActive(open ? segment.id : null);
                  }}
                />
                <span className="text-xs font-medium tabular-nums">{segment.value}</span>
                <span className="text-right text-xs tabular-nums text-muted-foreground">
                  {segment.percent}
                </span>
              </div>
            );
          })}
        </div>
        <div
          data-row="total-expenses"
          className="flex items-center justify-between gap-3 border-t border-border/60 pt-1.5"
        >
          {committedRow === undefined ? null : <ReadoutLabel row={committedRow} />}
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
            <span className="text-xs font-semibold tabular-nums">{allocation.committed.value}</span>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
              {allocation.committed.percent}
            </span>
          </span>
        </div>
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
  const others = ["treasury", "runway", "shortfall"].flatMap((id) => {
    const row = rowById(model.budget, id);
    return row === undefined ? [] : [row];
  });
  const alert = balance?.tone === "alert";
  return (
    <Panel name="Outlook">
      <div className="space-y-2">
        {balance !== undefined && (
          <div
            data-row="balance"
            data-tone={balance.tone}
            data-deferred={balance.deferred}
            className={cn(
              "rounded-md px-2.5 py-1.5",
              alert ? "bg-destructive/10" : "bg-success/10",
            )}
          >
            <ReadoutLabel
              row={balance}
              className="text-foreground/80"
              card={<BalanceCard outlook={model.outlook} trend={trend} />}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-lg leading-7 font-semibold tabular-nums">{balance.value}</span>
              {balance.status !== undefined && (
                <StatusBadge status={balance.status} tone={balance.tone} />
              )}
            </div>
          </div>
        )}
        <div className="space-y-0.5">
          {others.map((row) => (
            <LedgerLine
              key={row.id}
              row={row}
              card={
                row.id === "treasury" ? (
                  <TreasuryCard outlook={model.outlook} trend={trend} />
                ) : undefined
              }
              extra={
                row.id === "treasury" && trend !== null ? (
                  <TrendDelta series={trend.treasury} className="text-xs" />
                ) : undefined
              }
            />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function NationPanel({ model }: { readonly model: StatusStripModel }) {
  const rows = model.nation.filter((row) => !row.deferred);
  const cardFor = (row: StripRow): ReactNode => {
    if (row.id === "foreign-stations") return <StationsCard stations={model.stations} />;
    if (row.id === "shipyard-capacity")
      return <ShipyardCard ports={model.ports} total={row.value} />;
    return undefined;
  };
  return (
    <Panel name="Nation" aside={model.nationName}>
      <div className="grid grid-cols-2 content-start gap-1.5">
        {rows.map((row) => (
          <StatTile key={row.id} row={row} card={cardFor(row)} />
        ))}
      </div>
    </Panel>
  );
}

/**
 * Every deferred readout, each with the reason the campaign does not model it yet, behind one
 * popover grouped by where the readout would sit. Kept off the band so the panel stays short and
 * the placeholder is never a number.
 */
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

/** Collapsed one-liner: balance, treasury and alerts as hoverable chips. */
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
      width="w-80"
      align="start"
      triggerProps={{
        "aria-label": `Monthly balance ${summary.balance.value}, ${summary.balance.status}`,
      }}
      triggerClassName={cn(CHIP, "cursor-help", alert && "border-destructive/40 bg-destructive/5")}
      card={<BalanceCard outlook={model.outlook} trend={trend} />}
    >
      {alert ? (
        <TrendingDown className="size-3.5 text-destructive" aria-hidden="true" />
      ) : (
        <TrendingUp className="size-3.5 text-success" aria-hidden="true" />
      )}
      <span className="text-muted-foreground">Balance</span>
      <span className={cn("tabular-nums font-semibold", alert && "text-destructive")}>
        {summary.balance.value}
      </span>
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
    >
      <Landmark className="size-3.5 text-muted-foreground" aria-hidden="true" />
      <span className="text-muted-foreground">Treasury</span>
      <span className="tabular-nums font-semibold">{model.summary.treasury}</span>
      {trend !== null && <TrendDelta series={trend.treasury} />}
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

/**
 * The collapsible bottom status strip. Collapsed (the default in compact density) it is one line
 * of hoverable summary chips: balance (with a budget hover card), treasury and alerts. Expanded it
 * shows three cards: Nation (headline figures), Budget (the appropriation as a stacked bar with each
 * line's share) and Outlook (balance, treasury, runway). Every label explains itself in a tooltip, and the deferred lines live in one
 * "Not yet modelled" popover, so the band stays short. Deficits are always spelled out in text,
 * never conveyed by colour alone.
 */
export function StatusStripView({
  model,
  trend = null,
}: {
  readonly model: StatusStripModel;
  /** Month-over-month history from the stored reports; null until a month has been advanced. */
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
      <div className="flex items-center gap-2 text-xs">
        {expanded ? (
          <span className="flex items-center gap-1.5 font-semibold">
            <Activity className="size-3.5 text-muted-foreground" aria-hidden="true" />
            Status
          </span>
        ) : (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <BalanceChip model={model} trend={trend} />
            <TreasuryChip model={model} trend={trend} />
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
  readonly sessionId: string;
  /** Changes whenever the campaign advances, so the strip re-reads the engine. */
  readonly revision: number;
  readonly alertsCount: number | null;
}

/** Reads the engine views the strip needs and renders it; renders nothing until they load. */
export function StatusStrip({ sessionId, revision, alertsCount }: StatusStripProps) {
  const campaign = useBridgeQuery(sessionId, revision, (bridge, id) =>
    bridge.campaign.execute("inspectCampaign", id),
  );
  const map = useBridgeQuery(sessionId, revision, (bridge, id) =>
    bridge.campaign.execute("inspectMap", id),
  );

  // History is a bonus: while it loads, or if it cannot be read, the strip simply has no trend.
  const reports = useBridgeQuery(sessionId, revision, (bridge, id) =>
    bridge.campaign.execute("readMonthlyReports", id),
  );

  if (campaign.status !== "ready") return null;
  return (
    <StatusStripView
      trend={buildTrend(reports.status === "ready" ? reports.value.reports : null)}
      model={buildStatusStrip({
        projection: campaign.value.projection,
        areas: map.status === "ready" ? map.value.strategic.world.areas : null,
        alertsCount,
      })}
    />
  );
}
