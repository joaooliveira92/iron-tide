// Compiled display readouts for a dockyard project (SB3-R31): the monthly instalment, remaining months, total cost and
// launch month. Pure derivations over the project, its compiled design and the campaign month — never authored in the
// engine state and never in the renderer, which consumes these values as display only.
//
// INC-3c: the readout is status-aware. A project that is not accruing ordinary schedule work (halted, delayed,
// awaiting capacity, impounded, or on a revision hold) reports `scheduleBasis: "UNAVAILABLE"` with the reason, so the UI
// can show the hold instead of a misleading instalment/launch. A foreign project is funded by its contract's
// instalment schedule (DESIGN-16 section 13.4), so its instalment and launch come from the contract, never from the
// design's yard capacity.

import {
  advanceMonth,
  monthId,
  monthlyAbsorbable,
  type CampaignSnapshot,
  type CompiledDesignVersion,
  type ConstructionProject,
  type ConstructionProjectStatus,
  type ForeignConstructionContract,
} from "@bluewave/campaign";
import {
  buildConstructionProjectQueue,
  type ConstructionProjectQueueEntry,
  type ConstructionScheduleBasis,
  type ConstructionScheduleUnavailableReason,
} from "@bluewave/campaign-engine";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import { preservationCostUnits } from "./economyPhases.js";

export interface ConstructionProjectReadout {
  /** The project's total cost in treasury/work units (its total work). */
  readonly totalCostUnits: number;
  /**
   * The most work (and so payment) the project can take in one month: the shared construction draw (`monthlyAbsorbable`)
   * over its remaining work, packages, month usage, build time and acceleration. For a foreign project it is the next
   * unpaid contract instalment (in the same cost units — a contract's `totalPriceUnits` equals the project's `totalWork`
   * by construction, `foreignTerms.ts`).
   */
  readonly monthlyInstalmentUnits: number;
  /** Whole months left at the monthly instalment, 0 for a finished project (unpaid contract instalments for a foreign one). */
  readonly remainingMonths: number;
  /** The `YYYY-MM` the project reaches full work at that rate, or null when it is already complete. */
  readonly launchMonth: string | null;
  /** Which funding path the figures describe. */
  readonly scheduleBasis: ConstructionScheduleBasis;
  /** Why no schedule runs (held/terminal status, revision hold, or a missing foreign contract); null when one runs. */
  readonly scheduleUnavailableReason: ConstructionScheduleUnavailableReason | null;
}

/** The foreign contract funding a project and the contract months already paid (for the contract-schedule readout). */
export interface ConstructionProjectForeignSchedule {
  readonly contract: ForeignConstructionContract;
  readonly paidDueMonths: readonly string[];
}

/**
 * The statuses that receive zero work and zero ordinary charge, so no build schedule runs for them: DESIGN-23 section 7
 * for `HALTED`/`DELAYED`, and the halt/delay/capacity/terminal machinery (DESIGN-23 section 2, DESIGN-16 section 13.7)
 * for the rest. A cancelled project is terminal with no schedule.
 */
const UNAVAILABLE_SCHEDULE_STATUSES: ReadonlySet<ConstructionProjectStatus> = new Set([
  "HALTED",
  "DELAYED",
  "AWAITING_CAPACITY",
  "IMPOUNDED",
  "CANCELLED",
] as const);

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** The campaign month `months` later, or the same month for `months <= 0`; `YYYY-MM` in and out. */
function addMonths(month: string, months: number): string {
  const match = MONTH_RE.exec(month);
  if (!match || months <= 0) return month;
  const advanced = advanceMonth(Number(match[1]), Number(match[2]), months);
  return monthId(advanced.year, advanced.month);
}

/**
 * The compiled readout for one project. `monthlyInstalmentUnits` is the month's shared construction draw
 * (`monthlyAbsorbable`): remaining work scheduled through the packages at the month's effective throughput (a
 * single-figure project absorbs its remaining work, having no package schedule to pace). When the project carries a
 * `foreign` schedule its instalment/launch come from the contract instead (INC-3c); when it is
 * halted/delayed/impounded/awaiting capacity/cancelled, on a revision hold, or a foreign order with no resolvable
 * contract, the schedule is reported unavailable rather than misstated. Pure, deterministic, integer arithmetic only;
 * the UI slice renders these values (humanising only the reason code) and authors no figure.
 */
export function constructionProjectReadout(
  project: ConstructionProject,
  design: CompiledDesignVersion | undefined,
  campaignMonth: string,
  foreign?: ConstructionProjectForeignSchedule,
): ConstructionProjectReadout {
  const totalCostUnits = Number(project.totalWork);
  const remainingWork = Math.max(0, totalCostUnits - Number(project.completedWork));

  // A completed project is complete, whatever its status or funding path: no instalment, no remaining months, no launch.
  if (remainingWork <= 0) {
    return {
      totalCostUnits,
      monthlyInstalmentUnits: 0,
      remainingMonths: 0,
      launchMonth: null,
      scheduleBasis: foreign === undefined ? "YARD_CAPACITY" : "FOREIGN_CONTRACT",
      scheduleUnavailableReason: null,
    };
  }

  // A foreign order whose contract the snapshot cannot resolve has no schedule at all: never fall back to the design's
  // yard capacity (that is exactly the misleading instalment the readout must not emit).
  if (project.foreignContractId !== undefined && foreign === undefined) {
    return {
      totalCostUnits,
      monthlyInstalmentUnits: 0,
      remainingMonths: 0,
      launchMonth: null,
      scheduleBasis: "UNAVAILABLE",
      scheduleUnavailableReason: "FOREIGN_CONTRACT_MISSING",
    };
  }

  // A foreign project is funded by its contract instalment schedule, not its yard capacity (DESIGN-16 section 13.4). The
  // contract schedules the money owed regardless of the project's current status, so this outranks the held-status gate:
  // a delayed foreign row still honestly shows what is left to pay.
  if (foreign !== undefined) {
    const paid = new Set(foreign.paidDueMonths);
    const unpaid = foreign.contract.paymentSchedule
      .filter((i) => !paid.has(i.dueMonth))
      .sort((a, b) => (a.dueMonth < b.dueMonth ? -1 : a.dueMonth > b.dueMonth ? 1 : 0));
    const next = unpaid[0];
    return {
      totalCostUnits,
      monthlyInstalmentUnits:
        next !== undefined && Number.isSafeInteger(next.amountUnits) && next.amountUnits > 0
          ? next.amountUnits
          : 0,
      remainingMonths: unpaid.length,
      launchMonth: MONTH_RE.test(foreign.contract.plannedDeliveryMonth)
        ? foreign.contract.plannedDeliveryMonth
        : null,
      scheduleBasis: "FOREIGN_CONTRACT",
      scheduleUnavailableReason: null,
    };
  }

  // A held project receives zero work and zero ordinary charge (DESIGN-23 section 7), so it runs no instalment schedule:
  // report the reason instead of a misleading instalment/launch. A revision hold (`holdUntilMonth` in the future,
  // ADR-0070) holds the same way.
  const holdUntilMonth = project.holdUntilMonth;
  const onHold = holdUntilMonth !== undefined && holdUntilMonth > campaignMonth;
  if (UNAVAILABLE_SCHEDULE_STATUSES.has(project.status) || onHold) {
    return {
      totalCostUnits,
      monthlyInstalmentUnits: 0,
      remainingMonths: 0,
      launchMonth: null,
      scheduleBasis: "UNAVAILABLE",
      scheduleUnavailableReason: UNAVAILABLE_SCHEDULE_STATUSES.has(project.status)
        ? project.status
        : "REVISION_HOLD",
    };
  }

  const capacityUnits = project.capacityUnits ?? design?.constructionPlan?.capacityUnits;
  const monthlyInstalmentUnits = monthlyAbsorbable(project, capacityUnits, campaignMonth);
  const remainingMonths =
    remainingWork <= 0 || monthlyInstalmentUnits <= 0
      ? 0
      : Math.ceil(remainingWork / monthlyInstalmentUnits);
  return {
    totalCostUnits,
    monthlyInstalmentUnits,
    remainingMonths,
    launchMonth: remainingMonths <= 0 ? null : addMonths(campaignMonth, remainingMonths),
    scheduleBasis: "YARD_CAPACITY",
    scheduleUnavailableReason: null,
  };
}

/**
 * `buildConstructionProjectQueue` with each entry's compiled readout attached (SB3-R31): the instalment, remaining
 * months, total cost and launch month from `constructionProjectReadout`, plus the half-mothball carrying cost a
 * `HALTED` project pays each month (DESIGN-23 section 7). A foreign project's readout is derived from its contract's
 * instalment schedule (INC-3c). Pure and deterministic.
 *
 * The carrying cost needs the campaign month's ship-building balance and the treasury unit; when `content` is
 * undefined the readout reports `haltedCarryingCostUnits: null` — honestly unknown, never a fabricated zero. Non-halted
 * projects always report `null`.
 */
export function constructionProjectQueueWithReadouts(
  snapshot: CampaignSnapshot,
  nationId: string,
  content: ShipBuildingContent | undefined,
  campaignMonth: string,
): ConstructionProjectQueueEntry[] {
  const entries = buildConstructionProjectQueue(snapshot, nationId);
  const nation = snapshot.nations.get(nationId);
  const projects = new Map(
    (nation?.constructionProjects ?? []).map((p): [string, ConstructionProject] => [p.id, p]),
  );
  const contracts = new Map(
    (nation?.foreignContracts ?? []).map((c): [string, ForeignConstructionContract] => [
      c.contractId,
      c,
    ]),
  );
  const paidByContract = new Map(
    (nation?.foreignContractPayments ?? []).map((r): [string, readonly string[]] => [
      r.contractId,
      r.paidDueMonths,
    ]),
  );
  const haltedCarryingCostUnits =
    content === undefined
      ? null
      : preservationCostUnits(
          content.environmentFor(campaignMonth).constructionBalance,
          content.treasuryUnitMicro,
        );
  return entries.map((entry) => {
    const project = projects.get(entry.projectId);
    if (project === undefined) return entry;
    const contract =
      project.foreignContractId === undefined
        ? undefined
        : contracts.get(project.foreignContractId);
    const foreign =
      contract === undefined
        ? undefined
        : { contract, paidDueMonths: paidByContract.get(contract.contractId) ?? [] };
    const readout = constructionProjectReadout(
      project,
      snapshot.designs.get(entry.designVersionId),
      campaignMonth,
      foreign,
    );
    return {
      ...entry,
      readout: {
        ...readout,
        ...(project.delayReasonCode === undefined
          ? {}
          : { delayReasonCode: project.delayReasonCode }),
        haltedCarryingCostUnits: project.status === "HALTED" ? haltedCarryingCostUnits : null,
      },
    };
  });
}
