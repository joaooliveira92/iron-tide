import { memo } from "react";
import type { ConstructionScheduleUnavailableReason } from "@bluewave/campaign-engine";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ProjectRow } from "../project-progress.js";

export interface ProjectReadoutProps {
  readonly row: ProjectRow;
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

export const ProjectReadout = memo(function ProjectReadout({ row }: ProjectReadoutProps) {
  const format = usePresentationFormat();
  const readout = row.readout;
  const unavailableReason = readout?.scheduleUnavailableReason ?? null;
  const reasonLabel =
    unavailableReason === "DELAYED" && readout?.delayReasonCode === "PAYMENT_DEFAULT_DELAYED"
      ? "payment default"
      : unavailableReason === null
        ? "unavailable"
        : (SCHEDULE_UNAVAILABLE_LABEL[unavailableReason] ?? unavailableReason);
  return (
    <ul
      className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-4"
      aria-label={`${row.className} cost and schedule`}
    >
      {readout === null ? (
        <ReadoutItem label="Schedule" value="unavailable" />
      ) : readout.scheduleBasis === "UNAVAILABLE" ? (
        <>
          <ReadoutItem label="Schedule" value={`not building (${reasonLabel})`} />
          <ReadoutItem label="Total cost" value={format.money(readout.totalCostUnits)} />
          {readout.haltedCarryingCostUnits !== null && (
            <ReadoutItem
              label="Carrying cost"
              value={`${format.money(readout.haltedCarryingCostUnits)}/mo`}
            />
          )}
        </>
      ) : (
        <>
          <ReadoutItem
            label="Instalment"
            value={`${format.money(readout.monthlyInstalmentUnits)}/mo`}
          />
          <ReadoutItem label="Months left" value={format.count(readout.remainingMonths)} />
          <ReadoutItem label="Total cost" value={format.money(readout.totalCostUnits)} />
          <ReadoutItem label="Launch" value={readout.launchMonth ?? "complete"} />
          {readout.haltedCarryingCostUnits !== null && (
            <ReadoutItem
              label="Carrying cost"
              value={`${format.money(readout.haltedCarryingCostUnits)}/mo`}
            />
          )}
        </>
      )}
    </ul>
  );
});
