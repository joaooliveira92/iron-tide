import type { ReactNode } from "react";

import { researchNote } from "../../../lib/economy-wording.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { buildBudgetBar, type BudgetSegmentId } from "../budget-bar.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";
import { segmentFacts } from "./FlowBar.js";
import { LedgerTable } from "./LedgerTable.js";
import { SegmentCard } from "./SegmentCard.js";

interface LedgerRowProps {
  readonly swatchClassName?: string;
  readonly label: string;
  readonly amount: string;
  readonly share: number | null;
  readonly shareLabel: string;
  readonly muted?: boolean;
  readonly dashed?: boolean;
  readonly highlighted?: boolean;
  readonly dimmed?: boolean;
  readonly onActive?: (active: boolean) => void;
  readonly onOpen?: () => void;
  readonly detail: ReactNode;
}

function LedgerRow({
  swatchClassName,
  label,
  amount,
  share,
  shareLabel,
  muted = false,
  dashed = false,
  highlighted = false,
  dimmed = false,
  onActive,
  onOpen,
  detail,
}: LedgerRowProps) {
  return (
    <LedgerTable.Row
      ariaLabel={`${label}: ${amount} — show detail`}
      className={cn(highlighted && "bg-muted/60", dimmed && "opacity-60")}
      detail={detail}
      onMouseEnter={() => onActive?.(true)}
      onMouseLeave={() => onActive?.(false)}
      onFocus={() => onActive?.(true)}
      onBlur={() => onActive?.(false)}
      {...(onOpen === undefined ? {} : { onClick: onOpen })}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2.5 rounded-sm",
          swatchClassName ?? "bg-foreground",
          dashed && "border border-dashed border-foreground/60 bg-transparent",
        )}
      />
      <span className={muted ? "text-muted-foreground" : undefined}>{label}</span>
      <LedgerTable.Bar
        share={share === null ? null : Math.min(1, share)}
        fillClassName={swatchClassName ?? "bg-foreground/70"}
        className={cn(
          "transition-[width] duration-500 ease-out motion-reduce:transition-none",
          dashed && "opacity-50",
        )}
      />
      <span className="text-right font-medium tabular-nums">{amount}</span>
      <span className="text-right text-xs tabular-nums text-muted-foreground">{shareLabel}</span>
    </LedgerTable.Row>
  );
}

export type LedgerDetail = "fleet" | "construction";

export interface LedgerProps {
  readonly onOpen: (detail: LedgerDetail) => void;
  readonly breakdown: TreasuryBreakdown;
  readonly previewResearch: number | null;
  readonly active: BudgetSegmentId | null;
  readonly onActive: (id: BudgetSegmentId | null) => void;
}

const SEGMENT_LABEL: Record<BudgetSegmentId, string> = {
  obligations: "Fixed obligations",
  maintenance: "Fleet maintenance",
  research: "Research",
};

export function Ledger({ breakdown, previewResearch, active, onActive, onOpen }: LedgerProps) {
  const format = usePresentationFormat();
  const bar = buildBudgetBar(breakdown, previewResearch);
  const income = Math.max(1, bar.income);
  const note = researchNote(breakdown);
  const pct = (value: number) =>
    `${format.number((value / income) * 100, { maximumFractionDigits: 0 })}%`;

  return (
    <div className="space-y-0.5" data-testid="treasury-ledger">
      <LedgerTable.Root layout="appropriation">
        <LedgerRow
          swatchClassName="bg-foreground"
          label="Monthly naval appropriation"
          amount={format.count(breakdown.income)}
          share={1}
          shareLabel="100%"
          detail={
            <SegmentCard
              swatchClassName="bg-foreground"
              title="Naval appropriation"
              amount={format.money(breakdown.income)}
              description="Voted to the navy each month. Raise or lower it with the appropriation rate in the allocation panel."
            />
          }
        />
        <LedgerTable.Divider />
        {bar.segments.map((segment) => {
          const delta = segment.previewDelta;
          return (
            <div key={segment.id}>
              <LedgerRow
                swatchClassName={segment.className}
                label={SEGMENT_LABEL[segment.id]}
                amount={format.count(segment.value)}
                share={segment.shareOfIncome}
                shareLabel={pct(segment.value)}
                highlighted={active === segment.id}
                dimmed={active !== null && active !== segment.id}
                onActive={(on) => onActive(on ? segment.id : null)}
                onOpen={segment.id === "maintenance" ? () => onOpen("fleet") : undefined}
                detail={
                  <SegmentCard
                    swatchClassName={segment.className}
                    title={segment.label}
                    amount={format.money(segment.value)}
                    description={segment.description}
                    facts={segmentFacts(segment, format)}
                    note={
                      segment.id === "research"
                        ? note
                        : segment.id === "maintenance"
                          ? "Select to see which ships cost the most."
                          : null
                    }
                  />
                }
              />
              {segment.id === "research" && delta !== 0 && (
                <p className="px-7 pb-1 text-xs text-muted-foreground">
                  Pending: {format.count(segment.value)} → {format.count(segment.value + delta)}{" "}
                  once you apply the allocation.
                </p>
              )}
              {segment.id === "research" && note !== null && (
                <p className="px-7 pb-1 text-xs text-muted-foreground">{note}</p>
              )}
            </div>
          );
        })}
        <LedgerTable.Divider />
        <LedgerRow
          label="Committed expenditure"
          amount={format.count(breakdown.totalExpenditure)}
          share={bar.totalExpenditure / income}
          shareLabel={pct(bar.totalExpenditure)}
          detail={
            <SegmentCard
              title="Committed expenditure"
              amount={format.money(breakdown.totalExpenditure)}
              description="Obligations, fleet maintenance and research. These are paid whatever you build."
              facts={[
                {
                  label: "Left of appropriation",
                  value: format.count(breakdown.projectedSurplusDeficit),
                },
              ]}
            />
          }
        />
        <LedgerRow
          dashed
          muted
          label="Construction (up to)"
          amount={format.count(breakdown.plannedConstruction)}
          share={breakdown.plannedConstruction / income}
          shareLabel={pct(breakdown.plannedConstruction)}
          onOpen={() => onOpen("construction")}
          detail={
            <SegmentCard
              title="Construction (up to)"
              amount={format.money(breakdown.plannedConstruction)}
              description="The most this month's ship orders could draw. Each order is charged to the treasury when it is placed, so this sits outside the committed figures above."
              note="Select to see the projects behind it."
            />
          }
        />
      </LedgerTable.Root>
    </div>
  );
}
