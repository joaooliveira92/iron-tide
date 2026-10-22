import { memo } from "react";
import type { ConstructionScheduleUnavailableReason } from "@bluewave/campaign-engine";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { ProjectRow } from "../project-progress.js";

export interface ProjectReadoutProps {
  readonly row: ProjectRow;
}

/** One label/value pair of a project's compiled cost and schedule readout. */
function ReadoutItem({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </li>
  );
}

/** Humanised labels for the engine's schedule-unavailable reason codes; an unmapped code falls back to itself. */
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

/**
 * The compiled cost and schedule figures for one construction row (SB3-R31): the monthly instalment, remaining months,
 * total cost and launch month, plus the half-mothball carrying cost on a halted project (DESIGN-23 section 7). Every
 * figure is a compiled engine value rendered verbatim; the only thing this component authors is the humanised label for
 * the engine's schedule-unavailable reason code.
 *
 * A project with no running schedule (halted/delayed/awaiting capacity/impounded/cancelled/on hold, INC-3c) shows the
 * hold instead of a fabricated instalment or a completion; when the projection carried no readout it says so. It never
 * invents a zero, a launch or a completion.
 */
export const ProjectReadout = memo(function ProjectReadout({ row }: ProjectReadoutProps) {
  const format = usePresentationFormat();
  const readout = row.readout;
  const unavailableReason = readout?.scheduleUnavailableReason ?? null;
  // DESIGN-16 section 13.4 (INC-9b): a foreign contract in payment default holds the same `DELAYED` status, but the
  // reason code says why — show it instead of a generic "delayed" so the player knows the hold is a payment default.
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
