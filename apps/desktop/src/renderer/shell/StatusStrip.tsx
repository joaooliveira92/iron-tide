import { useState } from "react";
import {
  Activity,
  Bell,
  ChevronDown,
  ChevronUp,
  CircleAlert,
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
  type StatusStripModel,
  type StatusStripSummary,
  type StripRow,
  type StripTone,
} from "./status-strip-state.js";

/** Shared pill shell for the compact summary row (collapsed strip). */
const CHIP =
  "inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-0.5 text-xs outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring";

/** The right-aligned boxed value field, RTW3 style. */
const VALUE_FIELD =
  "ml-auto inline-flex min-w-16 items-center justify-end rounded-sm border bg-background/70 px-1.5 py-0 text-right text-xs leading-4 font-medium tabular-nums";

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
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-1.5 py-0 text-xs font-semibold uppercase tracking-wide",
        tone === "alert"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-success/40 bg-success/10 text-success",
      )}
    >
      {status}
    </Badge>
  );
}

/** A readout label that explains itself on hover or keyboard focus. */
function ReadoutLabel({ row }: { readonly row: StripRow }) {
  const description = descriptionFor(row);
  if (description === "") {
    return <span className={cn(LABEL_FIELD, "truncate")}>{row.label}</span>;
  }
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        render={<span tabIndex={0} />}
        className={cn(
          LABEL_FIELD,
          "cursor-help truncate underline decoration-muted-foreground/30 decoration-dotted underline-offset-2 outline-none hover:text-foreground focus-visible:text-foreground",
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

/** One RTW3-style readout line: a label on the left and a boxed value on the right. */
function ReadoutField({ row }: { readonly row: StripRow }) {
  const alert = row.tone === "alert";
  return (
    <div data-row={row.id} data-tone={row.tone} data-deferred={row.deferred} className="min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
        <ReadoutLabel row={row} />
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              VALUE_FIELD,
              alert && "border-destructive/40 font-semibold text-destructive",
            )}
          >
            {row.value}
          </span>
          {row.status !== undefined && <StatusBadge status={row.status} tone={row.tone} />}
        </div>
      </div>
    </div>
  );
}

/** One titled column of readout fields (Nation or Budget), optionally split into sub-columns. */
function ReadoutColumn({
  name,
  rows,
  multiColumn = false,
}: {
  readonly name: string;
  readonly rows: readonly StripRow[];
  readonly multiColumn?: boolean;
}) {
  return (
    <div role="group" aria-label={name} className="min-w-0">
      <h3 className="text-xs font-semibold uppercase leading-4 tracking-widest text-muted-foreground/60">
        {name}
      </h3>
      <div className={cn("gap-x-6", multiColumn ? "columns-1 sm:columns-2" : "columns-1")}>
        {rows.map((row) => (
          <ReadoutField key={row.id} row={row} />
        ))}
      </div>
    </div>
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
      <PopoverContent side="top" align="end" className="w-96 p-0">
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
 * mirrors the RTW3 status panel: the Nation and Budget readouts as two dense columns of label and
 * boxed value fields. Every label explains itself in a tooltip, and the deferred lines live in one
 * "Not yet modelled" popover, so the band stays short. Deficits are always spelled out in text,
 * never conveyed by colour alone.
 */
export function StatusStripView({ model }: { readonly model: StatusStripModel }) {
  const { density } = useDensity();
  const [chosen, setChosen] = useState<boolean | null>(null);
  const expanded = chosen ?? density !== "compact";
  const { summary } = model;

  const real = (rows: readonly StripRow[]) => rows.filter((row) => !row.deferred);

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
        <div className="mt-0.5 grid gap-x-8 gap-y-0.5 border-t border-border/60 pt-0.5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <ReadoutColumn name="Nation" rows={real(model.nation)} />
          <ReadoutColumn name="Budget" rows={real(model.budget)} multiColumn />
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
