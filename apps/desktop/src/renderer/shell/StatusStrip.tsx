import { useState, type ReactNode } from "react";
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
import { cn } from "../lib/utils.js";
import { useBridgeQuery } from "../lib/use-bridge-query.js";
import { useDensity } from "./DensityContext.js";
import {
  buildStatusStrip,
  NOT_YET_MODELLED,
  type AllocationSegment,
  type BudgetAllocation,
  type StatusStripModel,
  type StatusStripSummary,
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

/** A readout label that explains itself on hover or keyboard focus. */
function ReadoutLabel({
  row,
  wrap = false,
  className,
}: {
  readonly row: StripRow;
  readonly wrap?: boolean;
  readonly className?: string;
}) {
  const description = descriptionFor(row);
  // Wrapped labels keep their full text; truncating "Shipyard capacity (port levels)" hid meaning.
  const fit = wrap ? "break-words" : "truncate";
  if (description === "") {
    return <span className={cn(LABEL_FIELD, fit, className)}>{row.label}</span>;
  }
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        render={<span tabIndex={0} />}
        className={cn(
          LABEL_FIELD,
          fit,
          className,
          "cursor-help underline decoration-muted-foreground/30 decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:text-foreground",
        )}
      >
        {row.label}
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-64 text-xs leading-snug">
        {description}
      </HoverCardContent>
    </HoverCard>
  );
}

/** Fill for each stacked-bar segment; the legend swatch reuses it so the two always agree. */
const SEGMENT_FILL: Record<AllocationSegment["id"], string> = {
  obligations: "bg-muted-foreground/60",
  maintenance: "bg-primary/70",
  research: "bg-warning/80",
  construction: "border border-dashed border-primary/60 bg-primary/10",
};

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
        <h3 className="text-xs font-semibold uppercase leading-4 tracking-widest text-muted-foreground">
          {name}
        </h3>
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
function StatTile({ row }: { readonly row: StripRow }) {
  return (
    <div
      data-row={row.id}
      data-tone={row.tone}
      data-deferred={row.deferred}
      className="min-w-0 rounded-md bg-muted/40 px-2.5 py-1.5"
    >
      <ReadoutLabel row={row} wrap />
      <div className="text-base leading-6 font-semibold tabular-nums">{row.value}</div>
    </div>
  );
}

/** A plain label-and-value line, for the small supporting figures. */
function LedgerLine({ row }: { readonly row: StripRow }) {
  return (
    <div
      data-row={row.id}
      data-tone={row.tone}
      data-deferred={row.deferred}
      className="flex items-baseline justify-between gap-3"
    >
      <ReadoutLabel row={row} />
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          row.tone === "alert" && "font-semibold text-destructive",
        )}
      >
        {row.value}
      </span>
    </div>
  );
}

/** The appropriation as one bar; the empty track is what is left after the committed lines. */
function AllocationBar({ allocation }: { readonly allocation: BudgetAllocation }) {
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
          <span
            key={segment.id}
            data-segment={segment.id}
            // A tiny but real line keeps a visible sliver; the legend carries its exact share.
            className={cn(
              "h-full min-w-0.5 first:rounded-l-full last:rounded-r-full",
              SEGMENT_FILL[segment.id],
            )}
            style={{ width: `${String(Math.round(segment.fraction * 1000) / 10)}%` }}
          />
        ))}
    </div>
  );
}

function BudgetPanel({ model }: { readonly model: StatusStripModel }) {
  const { allocation } = model;
  const appropriation = rowById(model.budget, "monthly-budget");
  const committedRow = rowById(model.budget, "total-expenses");
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
        <AllocationBar allocation={allocation} />
        <div className="grid gap-x-6 gap-y-0.5 @lg:grid-cols-2">
          {allocation.segments.map((segment) => {
            const row = rowById(model.budget, segment.id);
            return (
              <div
                key={segment.id}
                data-row={segment.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto_2.5rem] items-baseline gap-x-1.5"
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2 self-center rounded-sm", SEGMENT_FILL[segment.id])}
                />
                {row === undefined ? (
                  <span className={cn(LABEL_FIELD, "break-words")}>{segment.label}</span>
                ) : (
                  <ReadoutLabel row={{ ...row, label: segment.label }} wrap />
                )}
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

function OutlookPanel({ model }: { readonly model: StatusStripModel }) {
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
            <ReadoutLabel row={balance} className="text-foreground/80" />
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
            <LedgerLine key={row.id} row={row} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function NationPanel({ model }: { readonly model: StatusStripModel }) {
  const rows = model.nation.filter((row) => !row.deferred);
  return (
    <Panel name="Nation" aside={model.nationName}>
      <div className="grid grid-cols-2 content-start gap-1.5">
        {rows.map((row) => (
          <StatTile key={row.id} row={row} />
        ))}
      </div>
    </Panel>
  );
}

/**
 * Every deferred readout, each with the reason the campaign does not model it yet, behind one
 * popover. Kept off the band so the panel stays short and the placeholder is never a number.
 */
function DeferredPopover({ rows }: { readonly rows: readonly StripRow[] }) {
  if (rows.length === 0) return null;
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
          <ul className="divide-y divide-border/60">
            {rows.map((row) => (
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Collapsed one-liner: balance, treasury and alerts as hoverable chips. */
function BalanceChip({
  summary,
  budgetRows,
}: {
  readonly summary: StatusStripSummary;
  readonly budgetRows: readonly StripRow[];
}) {
  const alert = summary.balance.tone === "alert";
  const ledger = budgetRows.filter((row) => !row.deferred);
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        closeDelay={100}
        render={<button type="button" />}
        aria-label={`Monthly balance ${summary.balance.value}, ${summary.balance.status}`}
        className={cn(CHIP, "cursor-help", alert && "border-destructive/40 bg-destructive/5")}
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
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-80 space-y-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Monthly budget
          </p>
          <StatusBadge status={summary.balance.status} tone={summary.balance.tone} />
        </div>
        <dl className="space-y-1 text-xs">
          {ledger.map((row) => (
            <div key={row.id} className="flex items-baseline justify-between gap-4">
              <dt
                className={cn(
                  "text-muted-foreground",
                  row.id === "balance" && "font-semibold text-foreground",
                )}
              >
                {row.label}
              </dt>
              <dd
                className={cn(
                  "tabular-nums font-medium",
                  row.tone === "alert" && "font-semibold text-destructive",
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="border-t pt-2 text-xs text-muted-foreground">
          &ldquo;{NOT_YET_MODELLED}&rdquo; lines are omitted, not zeroed.
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

function TreasuryChip({ treasury }: { readonly treasury: string }) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        render={<button type="button" />}
        aria-label={`Treasury ${treasury}`}
        className={CHIP}
      >
        <Landmark className="size-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-muted-foreground">Treasury</span>
        <span className="tabular-nums font-semibold">{treasury}</span>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-auto max-w-64 px-3 py-1.5 text-xs">
        Cash on hand at the start of the month.
      </HoverCardContent>
    </HoverCard>
  );
}

function AlertsChip({ alerts }: { readonly alerts: string }) {
  const unavailable = alerts.toLowerCase().includes("unavailable");
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={150}
        render={<button type="button" />}
        aria-label={`Priorities: ${alerts}`}
        className={cn(CHIP, unavailable && "text-muted-foreground")}
      >
        {unavailable ? (
          <CircleAlert className="size-3.5" aria-hidden="true" />
        ) : (
          <Bell className="size-3.5 text-muted-foreground" aria-hidden="true" />
        )}
        <span>{alerts}</span>
      </HoverCardTrigger>
      <HoverCardContent side="top" className="w-auto max-w-64 px-3 py-1.5 text-xs">
        Strategic priorities the campaign has raised for attention.
      </HoverCardContent>
    </HoverCard>
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
export function StatusStripView({ model }: { readonly model: StatusStripModel }) {
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
            <BalanceChip summary={summary} budgetRows={model.budget} />
            <TreasuryChip treasury={summary.treasury} />
            <AlertsChip alerts={summary.alerts} />
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <DeferredPopover rows={model.deferredRows} />
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
          <OutlookPanel model={model} />
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

  if (campaign.status !== "ready") return null;
  return (
    <StatusStripView
      model={buildStatusStrip({
        projection: campaign.value.projection,
        areas: map.status === "ready" ? map.value.world.areas : null,
        alertsCount,
      })}
    />
  );
}
