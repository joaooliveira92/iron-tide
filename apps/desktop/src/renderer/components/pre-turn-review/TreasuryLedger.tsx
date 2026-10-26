import { Landmark, Scale, TrendingDown, TrendingUp } from "lucide-react";

import type { PlayerProjectionEconomy } from "@bluewave/campaign-engine";

import { cn } from "../../lib/utils.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import { Skeleton } from "../ui/skeleton.js";
import { SlateFacts, SlateHeader } from "../ui/slate.js";
import {
  buildLedger,
  shareOf,
  barSpan,
  type Ledger,
  type LedgerKind,
  type LedgerLine,
  type LedgerLineId,
} from "../preTurnReviewModel.js";
import { Dossier } from "../ui/dossier.js";

const BAR_FILL: Readonly<Record<LedgerKind, string>> = {
  opening: "bg-admiralty-ink-faint",
  income: "bg-admiralty-signal",
  outgo: "bg-admiralty-accent",
  closing: "bg-foreground",
};

const EXPLANATION: Readonly<Record<LedgerLineId, string>> = {
  opening: "What the treasury holds right now, before the month is settled.",
  appropriation: "The naval appropriation paid in when the month turns.",
  construction:
    "Work the slipways can absorb this month, drawn from the treasury ahead of everything else.",
  maintenance: "Upkeep for the fleet as it stands, higher while at war.",
  obligations: "Standing commitments that fall due whatever else you decide.",
  research: "Research you have funded and can actually spend this month.",
  closing: "What the treasury will hold once every line above is settled.",
};

function signedMoney(format: PresentationFormat, value: number): string {
  if (value === 0) return format.money(0);
  return `${value > 0 ? "+" : "−"}${format.money(Math.abs(value))}`;
}

function lineAmount(format: PresentationFormat, line: LedgerLine): string {
  if (line.kind === "income") return signedMoney(format, line.amount);
  if (line.kind === "outgo") return signedMoney(format, -line.amount);
  return format.money(line.amount);
}

function BalanceTrace({
  lines,
  active,
}: {
  readonly lines: readonly LedgerLine[];
  readonly active: number;
}) {
  const width = 272;
  const height = 72;
  const inset = 8;
  const balances = lines.slice(0, -1).map((line) => line.to);
  const top = Math.max(...balances);
  const bottom = Math.min(...balances);
  const range = Math.max(1, top - bottom);
  const points = lines.slice(0, -1).map((line, index, all) => ({
    x: inset + (index / (all.length - 1)) * (width - inset * 2),
    y: height - inset - ((line.to - bottom) / range) * (height - inset * 2),
  }));
  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${String(Math.round(p.x * 10) / 10)} ${String(Math.round(p.y * 10) / 10)}`,
    )
    .join(" ");
  const area = `${path} L${points[points.length - 1]?.x ?? 0} ${height} L${points[0]?.x ?? 0} ${height} Z`;
  const current = points[Math.min(active, points.length - 1)];
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className="slate-grid h-[4.5rem] w-full rounded-md border border-border/60"
    >
      <path d={area} className="fill-admiralty-accent/10" />
      <path
        d={path}
        pathLength={1}
        className="line-draw fill-none stroke-admiralty-accent"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === active ? 0 : 2}
          className="fill-popover stroke-admiralty-accent"
          strokeWidth={1}
        />
      ))}
      {current !== undefined && (
        <>
          <line
            x1={current.x}
            x2={current.x}
            y1={current.y}
            y2={height}
            className="stroke-admiralty-accent/50"
            strokeDasharray="2 3"
          />
          <circle cx={current.x} cy={current.y} r={4.5} className="fill-admiralty-accent" />
          <circle cx={current.x} cy={current.y} r={8} className="fill-admiralty-accent/20" />
        </>
      )}
    </svg>
  );
}

function LedgerRow({
  line,
  index,
  ledger,
  format,
}: {
  readonly line: LedgerLine;
  readonly index: number;
  readonly ledger: Ledger;
  readonly format: PresentationFormat;
}) {
  const span = barSpan(line);
  const bookend = line.kind === "opening" || line.kind === "closing";
  const income = ledger.lines.find((l) => l.kind === "income")?.amount ?? 0;
  const after = Math.min(index, ledger.lines.length - 2);
  const facts = [
    { label: "Treasury after this line", value: format.money(line.to) },
    ...(line.kind === "outgo"
      ? [
          {
            label: "Share of outgoings",
            value: `${String(Math.round(shareOf(line.amount, ledger.totalOutgoings) * 100))}%`,
          },
          {
            label: "Share of appropriation",
            value: `${String(Math.round(shareOf(line.amount, income) * 100))}%`,
          },
        ]
      : []),
  ];
  return (
    <li>
      <Dossier
        side="left"
        icon={<Scale className="size-3" />}
        title={line.label}
        foot={EXPLANATION[line.id]}
        triggerProps={{
          className: cn(
            "group grid w-full grid-cols-[7.5rem_minmax(0,1fr)_6.5rem] items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none",
            "hover:bg-admiralty-accent/8 focus-visible:ring-2 focus-visible:ring-ring",
            bookend && "font-medium",
          ),
          "aria-label": `${line.label}: ${lineAmount(format, line)}`,
        }}
        trigger={
          <>
            <span className="truncate text-xs text-muted-foreground group-hover:text-foreground">
              {line.label}
            </span>
            <span
              aria-hidden="true"
              className="relative block h-3 rounded-sm bg-muted/50 [background-image:repeating-linear-gradient(90deg,transparent_0_calc(10%-1px),var(--color-border)_calc(10%-1px)_10%)]"
            >
              <span
                className={cn(
                  "absolute inset-y-0.5 rounded-[3px] transition-[filter] group-hover:brightness-125",
                  BAR_FILL[line.kind],
                )}
                style={{ left: `${String(span.left)}%`, width: `${String(span.width)}%` }}
              />
            </span>
            <span
              className={cn(
                "text-right text-xs tabular-nums",
                line.kind === "income" && "text-admiralty-signal",
              )}
            >
              {lineAmount(format, line)}
            </span>
          </>
        }
      >
        <BalanceTrace lines={ledger.lines} active={after} />
        <SlateFacts rows={facts} />
      </Dossier>
    </li>
  );
}

export function TreasuryLedger({
  economy,
  loading,
  fallbackTreasury,
  fallbackNet,
  format,
}: {
  readonly economy: PlayerProjectionEconomy | null;
  readonly loading: boolean;
  readonly fallbackTreasury: number;
  readonly fallbackNet: number;
  readonly format: PresentationFormat;
}) {
  const ledger = economy === null ? null : buildLedger(economy);
  const net = economy === null ? fallbackNet : economy.projectedNet;
  const closing = economy === null ? null : economy.monthEndTreasury;
  const rising = net >= 0;
  const Trend = rising ? TrendingUp : TrendingDown;

  return (
    <section aria-label="Treasury forecast" className="flex min-w-0 flex-col">
      <SlateHeader icon={<Landmark className="size-3" />} title="Treasury forecast" />
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs text-muted-foreground">Treasury when the month closes</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">
            {closing === null ? format.money(fallbackTreasury) : format.money(closing)}
          </p>
          <p
            className={cn(
              "mb-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
              rising
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            <Trend aria-hidden="true" className="size-3.5" />
            {signedMoney(format, net)} <span className="font-normal opacity-80">a month</span>
          </p>
        </div>
        {economy?.runwayMonths !== undefined && (
          <p className="mt-1 text-xs text-muted-foreground">
            At this rate the treasury lasts {format.count(economy.runwayMonths)}{" "}
            {economy.runwayMonths === 1 ? "month" : "months"}.
          </p>
        )}
        {ledger !== null && ledger.shortfall > 0 && (
          <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
            {format.money(ledger.shortfall)} of this month&apos;s bills cannot be paid.
          </p>
        )}
      </div>
      <div className="px-2 pb-3">
        {ledger === null ? (
          loading ? (
            <div className="space-y-2 px-2 py-2" aria-busy="true">
              {[0, 1, 2, 3, 4, 5, 6].map((row) => (
                <Skeleton key={row} className="h-5 w-full" />
              ))}
            </div>
          ) : (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              The ledgers could not be read for this month.
            </p>
          )
        ) : (
          <ul className="space-y-0.5">
            {ledger.lines.map((line, index) => (
              <LedgerRow key={line.id} line={line} index={index} ledger={ledger} format={format} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
