import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ConstructionCommitments } from "../../../../shared/budget-contract.js";
import { projectRows, shareOf, type ProjectRow } from "../commitments-view.js";
import { SegmentCard } from "./SegmentCard.js";

const ROW =
  "grid w-full grid-cols-[minmax(0,1fr)_minmax(3rem,7rem)_4.5rem_6rem] items-center gap-x-3 rounded-md px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring";

const TONE = {
  neutral: "text-muted-foreground",
  good: "text-success",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-destructive",
} as const;

function costNote(row: ProjectRow): string | null {
  if (row.foreign)
    return "Built under a foreign contract, so it is not drawn from your appropriation.";
  if (row.status === "HALTED")
    return "Halted, but the hull still has to be kept safe. That carrying cost is charged every month until the project resumes or is cancelled.";
  if (row.status === "DELAYED") return "Delayed this month, so it draws nothing.";
  return null;
}

function ProjectLine({ row, peak }: { readonly row: ProjectRow; readonly peak: number }) {
  const format = usePresentationFormat();
  const amount = row.foreign ? "Contract" : format.count(row.monthlyCost);
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        render={<button type="button" />}
        aria-label={`${row.className}: ${row.style.label}, ${amount} this month — show detail`}
        className={ROW}
      >
        <span className="truncate">
          {row.className} <span className="text-xs text-muted-foreground">{row.shipType}</span>
        </span>
        <span aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className={cn(
              "block h-full rounded-full",
              row.carryingCost > 0 ? "bg-destructive/70" : "bg-primary",
            )}
            style={{ width: `${shareOf(row.monthlyCost, peak) * 100}%` }}
          />
        </span>
        <span className={cn("text-right text-xs", TONE[row.style.tone])}>{row.style.label}</span>
        <span className="text-right font-medium tabular-nums">{amount}</span>
      </HoverCardTrigger>
      <HoverCardContent side="left" align="center" className="w-72">
        <SegmentCard
          title={row.className}
          amount={row.foreign ? "Contract" : format.money(row.monthlyCost)}
          description={`${row.shipType}, ${format.number(row.percentComplete, { maximumFractionDigits: 0 })}% complete.`}
          facts={
            row.foreign
              ? []
              : [
                  { label: "Construction draw", value: format.count(row.draw) },
                  { label: "Carrying cost", value: format.count(row.carryingCost) },
                ]
          }
          note={costNote(row)}
        />
      </HoverCardContent>
    </HoverCard>
  );
}

export function ConstructionTab({
  construction,
  income,
}: {
  readonly construction: ConstructionCommitments;
  readonly income: number;
}) {
  const format = usePresentationFormat();
  const rows = projectRows(construction.projects);
  const peak = rows[0]?.monthlyCost ?? 0;
  const total = construction.drawTotal + construction.carryingTotal;

  if (rows.length === 0)
    return (
      <p data-testid="construction-commitments" className="text-base font-medium tracking-tight">
        Nothing is under construction, so shipbuilding takes no money this month.
      </p>
    );

  return (
    <div className="space-y-4" data-testid="construction-commitments">
      <p className="text-base font-medium tracking-tight">
        Shipbuilding can take up to {format.count(total)} this month,{" "}
        {format.number(shareOf(total, income) * 100, { maximumFractionDigits: 0 })}% of income.
      </p>
      {construction.haltedCount > 0 && (
        <p className="text-sm text-destructive">
          {construction.haltedCount} halted{" "}
          {construction.haltedCount === 1 ? "project costs" : "projects cost"}{" "}
          {format.count(construction.carryingTotal)} a month to keep, and builds nothing.
        </p>
      )}
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.projectId}>
            <ProjectLine row={row} peak={peak} />
          </li>
        ))}
      </ul>
      <p className="px-2 text-xs text-muted-foreground">
        These are ceilings. Each project draws only what its yard can absorb this month.
      </p>
    </div>
  );
}
