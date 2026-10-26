import { memo } from "react";
import type { ConstructionScheduleUnavailableReason } from "@bluewave/campaign-engine";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import type { PresentationFormat } from "../../../lib/presentation-format/index.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ProjectRow } from "../project-progress.js";

export interface ProjectReadoutProps {
  readonly row: ProjectRow;
  readonly className?: string;
}

function ReadoutItem({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </li>
  );
}

const SCHEDULE_UNAVAILABLE_LABEL: Readonly<
  Partial<Record<ConstructionScheduleUnavailableReason, string>>
> = {
  HALTED: "halted",
  DELAYED: "delayed",
  AWAITING_CAPACITY: "awaiting capacity",
  IMPOUNDED: "impounded",
  CANCELLED: "cancelled",
  REVISION_HOLD: "on hold",
  FOREIGN_CONTRACT_MISSING: "contract missing",
};

export interface ReadoutLine {
  readonly label: string;
  readonly value: string;
}

export function readoutLines(row: ProjectRow, format: PresentationFormat): readonly ReadoutLine[] {
  const readout = row.readout;
  if (readout === null) return [{ label: "Schedule", value: "unavailable" }];
  const carrying: readonly ReadoutLine[] =
    readout.haltedCarryingCostUnits === null
      ? []
      : [
          {
            label: "Carrying cost",
            value: `${format.money(readout.haltedCarryingCostUnits)}/mo`,
          },
        ];
  if (readout.scheduleBasis === "UNAVAILABLE") {
    const unavailableReason = readout.scheduleUnavailableReason;
    const reasonLabel =
      unavailableReason === "DELAYED" && readout.delayReasonCode === "PAYMENT_DEFAULT_DELAYED"
        ? "payment default"
        : unavailableReason === null
          ? "unavailable"
          : (SCHEDULE_UNAVAILABLE_LABEL[unavailableReason] ?? unavailableReason);
    return [
      { label: "Schedule", value: `not building (${reasonLabel})` },
      { label: "Total cost", value: format.money(readout.totalCostUnits) },
      ...carrying,
    ];
  }
  return [
    { label: "Instalment", value: `${format.money(readout.monthlyInstalmentUnits)}/mo` },
    { label: "Months left", value: format.count(readout.remainingMonths) },
    { label: "Total cost", value: format.money(readout.totalCostUnits) },
    { label: "Launch", value: readout.launchMonth ?? "complete" },
    ...carrying,
  ];
}

export const ProjectReadout = memo(function ProjectReadout({
  row,
  className = "grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-4",
}: ProjectReadoutProps) {
  const format = usePresentationFormat();
  const schedule = row.readout?.scheduleExplanation;
  const instalment = row.readout?.instalmentExplanation;
  const cost = row.readout?.costExplanation;
  return (
    <div>
      <ul className={className} aria-label={`${row.className} cost and schedule`}>
        {readoutLines(row, format).map((line) => (
          <ReadoutItem key={line.label} label={line.label} value={line.value} />
        ))}
      </ul>
      {instalment !== undefined && (
        <ExplanationDisclosure
          tree={instalment}
          area="construction"
          summaryKey="construction.construction_instalment.summary"
          format={format}
          testId={`construction-instalment-explanation-${row.projectId}`}
        />
      )}
      {cost !== undefined && (
        <ExplanationDisclosure
          tree={cost}
          area="construction"
          summaryKey="construction.construction_cost.summary"
          format={format}
          testId={`construction-cost-explanation-${row.projectId}`}
        />
      )}
      {schedule !== undefined && (
        <ExplanationDisclosure
          tree={schedule}
          area="construction"
          summaryKey="construction.construction_schedule.summary"
          format={format}
        />
      )}
    </div>
  );
});
