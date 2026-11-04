import { researchNote } from "../../../lib/economy-wording.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { buildBudgetBar, type BudgetSegmentId } from "../budget-bar.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";
import { segmentFacts } from "./FlowBar.js";
import { GROWING_FILL, LedgerTable } from "./LedgerTable.js";
import { SegmentCard } from "./SegmentCard.js";

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
  const showDetail = (label: string, amount: string) => `${label}: ${amount} — show detail`;

  return (
    <LedgerTable.Root columns="flow" testId="treasury-ledger">
      <LedgerTable.Row
        ariaLabel={showDetail("Monthly naval appropriation", format.count(breakdown.income))}
        detail={
          <SegmentCard
            swatchClassName="bg-foreground"
            title="Naval appropriation"
            amount={format.money(breakdown.income)}
            description="Voted to the navy each month. Raise or lower it with the appropriation rate in the allocation panel."
          />
        }
      >
        <LedgerTable.Swatch className="bg-foreground" />
        <LedgerTable.Label>Monthly naval appropriation</LedgerTable.Label>
        <LedgerTable.Bar share={1} fillClassName={cn(GROWING_FILL, "bg-foreground")} />
        <LedgerTable.Amount>{format.count(breakdown.income)}</LedgerTable.Amount>
        <LedgerTable.Note>100%</LedgerTable.Note>
      </LedgerTable.Row>
      <LedgerTable.Divider />
      {bar.segments.map((segment) => {
        const delta = segment.previewDelta;
        return (
          <div key={segment.id}>
            <LedgerTable.Row
              ariaLabel={showDetail(SEGMENT_LABEL[segment.id], format.count(segment.value))}
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
            >
              <LedgerTable.Swatch className={segment.className} />
              <LedgerTable.Label>{SEGMENT_LABEL[segment.id]}</LedgerTable.Label>
              <LedgerTable.Bar
                share={segment.shareOfIncome}
                fillClassName={cn(GROWING_FILL, segment.className)}
              />
              <LedgerTable.Amount>{format.count(segment.value)}</LedgerTable.Amount>
              <LedgerTable.Note>{pct(segment.value)}</LedgerTable.Note>
            </LedgerTable.Row>
            {segment.id === "research" && delta !== 0 && (
              <p className="px-7 pb-1 text-xs text-muted-foreground">
                Pending: {format.count(segment.value)} → {format.count(segment.value + delta)} once
                you apply the allocation.
              </p>
            )}
            {segment.id === "research" && note !== null && (
              <p className="px-7 pb-1 text-xs text-muted-foreground">{note}</p>
            )}
          </div>
        );
      })}
      <LedgerTable.Divider />
      <LedgerTable.Row
        ariaLabel={showDetail("Committed expenditure", format.count(breakdown.totalExpenditure))}
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
      >
        <LedgerTable.Swatch />
        <LedgerTable.Label>Committed expenditure</LedgerTable.Label>
        <LedgerTable.Bar
          share={bar.totalExpenditure / income}
          fillClassName={cn(GROWING_FILL, "bg-foreground/70")}
        />
        <LedgerTable.Amount>{format.count(breakdown.totalExpenditure)}</LedgerTable.Amount>
        <LedgerTable.Note>{pct(bar.totalExpenditure)}</LedgerTable.Note>
      </LedgerTable.Row>
      <LedgerTable.Row
        ariaLabel={showDetail("Construction (up to)", format.count(breakdown.plannedConstruction))}
        onOpen={() => onOpen("construction")}
        detail={
          <SegmentCard
            title="Construction (up to)"
            amount={format.money(breakdown.plannedConstruction)}
            description="The most this month's ship orders could draw. Each order is charged to the treasury when it is placed, so this sits outside the committed figures above."
            note="Select to see the projects behind it."
          />
        }
      >
        <LedgerTable.Swatch variant="dashed" />
        <LedgerTable.Label className="text-muted-foreground">
          Construction (up to)
        </LedgerTable.Label>
        <LedgerTable.Bar
          share={breakdown.plannedConstruction / income}
          fillClassName={cn(GROWING_FILL, "bg-foreground/70 opacity-50")}
        />
        <LedgerTable.Amount>{format.count(breakdown.plannedConstruction)}</LedgerTable.Amount>
        <LedgerTable.Note>{pct(breakdown.plannedConstruction)}</LedgerTable.Note>
      </LedgerTable.Row>
    </LedgerTable.Root>
  );
}
