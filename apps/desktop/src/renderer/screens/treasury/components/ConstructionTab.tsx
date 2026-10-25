import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { Zap } from "lucide-react";
import type {
  ConstructionAcceleration,
  ConstructionCommitments,
} from "../../../../shared/budget-contract.js";
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

function AccelerationNotice({ acceleration }: { readonly acceleration: ConstructionAcceleration }) {
  const format = usePresentationFormat();
  const premium = format.percent(acceleration.premiumBp, 0);
  const chance = format.percent(acceleration.delayChanceBp, 0);
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={0}
        closeDelay={0}
        render={<button type="button" />}
        aria-label="Acceleration cost and risk — show detail"
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-left text-sm outline-none hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Zap aria-hidden="true" className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="font-medium">
          {acceleration.acceleratedCount} accelerated{" "}
          {acceleration.acceleratedCount === 1 ? "project" : "projects"}
        </span>
        <span className="text-muted-foreground">
          {acceleration.premiumPending > 0
            ? `${format.count(acceleration.premiumPending)} of extra work still to be added`
            : "premium already paid"}
          {acceleration.delayChanceBp > 0 && `, ${chance} chance of delay each month`}
        </span>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" className="w-80">
        <SegmentCard
          title="Acceleration"
          amount={format.count(acceleration.premiumPending)}
          description={`Accelerating a project builds it faster at a price: ${premium} more work is added to what remains, once. While it is accelerated, each project risks being delayed in any month, which stops all progress that month.`}
          facts={[
            { label: "Accelerated projects", value: format.count(acceleration.acceleratedCount) },
            { label: "Extra work still to add", value: format.count(acceleration.premiumPending) },
            { label: "Delay chance per project, per month", value: chance },
          ]}
        />
      </HoverCardContent>
    </HoverCard>
  );
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
                  ...(row.acceleration === null
                    ? []
                    : [
                        {
                          label: "Acceleration premium",
                          value: row.acceleration.premiumApplied
                            ? "Paid"
                            : format.count(row.acceleration.premiumWork),
                        },
                      ]),
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
      {construction.acceleration.acceleratedCount > 0 && (
        <AccelerationNotice acceleration={construction.acceleration} />
      )}
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
