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
  readonly totalCostUnits: number;
  readonly monthlyInstalmentUnits: number;
  readonly remainingMonths: number;
  readonly launchMonth: string | null;
  readonly scheduleBasis: ConstructionScheduleBasis;
  readonly scheduleUnavailableReason: ConstructionScheduleUnavailableReason | null;
}

export interface ConstructionProjectForeignSchedule {
  readonly contract: ForeignConstructionContract;
  readonly paidDueMonths: readonly string[];
}

const UNAVAILABLE_SCHEDULE_STATUSES: ReadonlySet<ConstructionProjectStatus> = new Set([
  "HALTED",
  "DELAYED",
  "AWAITING_CAPACITY",
  "IMPOUNDED",
  "CANCELLED",
] as const);

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

function addMonths(month: string, months: number): string {
  const match = MONTH_RE.exec(month);
  if (!match || months <= 0) return month;
  const advanced = advanceMonth(Number(match[1]), Number(match[2]), months);
  return monthId(advanced.year, advanced.month);
}

export function constructionProjectReadout(
  project: ConstructionProject,
  design: CompiledDesignVersion | undefined,
  campaignMonth: string,
  foreign?: ConstructionProjectForeignSchedule,
): ConstructionProjectReadout {
  const totalCostUnits = Number(project.totalWork);
  const remainingWork = Math.max(0, totalCostUnits - Number(project.completedWork));

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
