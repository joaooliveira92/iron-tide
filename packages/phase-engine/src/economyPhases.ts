import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import {
  monthlyRevenue,
  nationIsAtWar,
  nationMonthlyMaintenance,
  settleOutflow,
  transitionConstructionProject,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import {
  FOREIGN_PAYMENT_DEFAULT_DELAYED,
  preservationCostPerMonthMicro,
  treasuryCostUnits,
  type ConstructionBalance,
} from "@bluewave/ship-design";
import { fundConstructionProject } from "./constructionFunding.js";
import { constructionResumeTarget } from "./constructionHaltResume.js";
import {
  ACCELERATION_CAPACITY_PRESSURE_DELAY,
  constructionWorkStatus,
  projectConstructionDemand,
  resolveAccelerationCapacityPressure,
} from "./constructionAcceleration.js";
import { fundDesignStudies } from "./designStudies.js";
import { resolvePrivateDockExpansion } from "./dockExpansion.js";
import { runForeignContractPhase } from "./foreignContractPhase.js";
import { budgetChangedEvent, constructionDelayedEvent, makeLedgerEntry } from "./events.js";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";
import { applyPrestigeChange } from "./prestigeApplication.js";
import { reportOutflowShortfall } from "./outflowShortfall.js";
import { applyReadinessEvolution } from "./readinessEvolution.js";

export function splitLargestRemainder(total: number, weights: readonly number[]): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const totalBig = BigInt(total);
  const weightSumBig = BigInt(weightSum);
  const base: number[] = [];
  const remainders: { index: number; remainder: bigint }[] = [];
  let assigned = 0n;
  for (let index = 0; index < weights.length; index += 1) {
    const numerator = totalBig * BigInt(weights[index]!);
    const quotient = numerator / weightSumBig;
    base.push(Number(quotient));
    remainders.push({ index, remainder: numerator % weightSumBig });
    assigned += quotient;
  }
  const leftover = Number(totalBig - assigned);
  remainders.sort((a, b) =>
    b.remainder === a.remainder ? a.index - b.index : b.remainder > a.remainder ? 1 : -1,
  );
  for (let i = 0; i < leftover; i += 1) {
    const index = remainders[i]!.index;
    base[index] = base[index]! + 1;
  }
  return base;
}

export const ACCELERATION_POOL_UNDEFINED_UNITS = 0;

export function runMonthlyRevenuePhase(ctx: PhaseContext): PhaseRunOutcome {
  const { campaignMonth, eventLedger, financialLedger, nextSeq } = ctx;

  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;
    const baseResources = nation["baseResources"] ?? (0 as SafeInt);
    const rateBp = nation["navalAppropriationRateBp"] ?? (0 as SafeInt);
    const revenue = monthlyRevenue(baseResources, rateBp);
    if ((revenue as number) <= 0) continue;

    const previousBalance = nation["treasury"];
    const newBalance = SafeInt.add(previousBalance, revenue);

    const updatedNation: NationState = {
      ...nation,
      treasury: newBalance,
    };
    const updatedNations = new Map(ctx.snapshot.read("nations"));
    updatedNations.set(nationId, updatedNation);
    ctx.snapshot.write("nations", updatedNations);

    financialLedger.append(
      makeLedgerEntry(
        nationId,
        "monthly_revenue",
        "NAVAL_APPROPRIATION",
        revenue,
        revenue,
        previousBalance,
        newBalance,
        "Monthly naval appropriation revenue",
        campaignMonth,
      ),
    );

    eventLedger.append(
      budgetChangedEvent(
        nationId,
        previousBalance,
        newBalance,
        revenue,
        "Monthly naval appropriation revenue",
        nextSeq(),
        campaignMonth,
      ),
    );
  }
  return { status: "continue" };
}

export function capacityOf(
  designs: CampaignSnapshot["designs"],
  project: ConstructionProject,
): Record<string, number> | undefined {
  const capacity =
    project["capacityUnits"] ??
    designs.get(project["designVersionId"])?.constructionPlan?.capacityUnits;
  return capacity === undefined
    ? undefined
    : Object.fromEntries(Object.entries(capacity).map(([line, v]) => [line, v as number]));
}

export const PROJECT_DELAYED_ZERO_WORK = "PROJECT_DELAYED_ZERO_WORK" as const;

function withoutDelayReason(project: ConstructionProject): ConstructionProject {
  if (!("delayReasonCode" in project)) return project;
  const next = { ...project };
  delete next.delayReasonCode;
  return next;
}

export function preservationCostUnits(
  balance: ConstructionBalance,
  treasuryUnitMicro: number,
): number {
  if (!Number.isFinite(treasuryUnitMicro) || treasuryUnitMicro <= 0) return 0;
  const micro = preservationCostPerMonthMicro(balance);
  return micro <= 0 ? 0 : treasuryCostUnits(micro, treasuryUnitMicro);
}

export function runAppropriationPhase(ctx: PhaseContext): PhaseRunOutcome {
  fundDesignStudies(ctx);
  const accelerationRng = ctx.rng.engine();
  const foreign = runForeignContractPhase(ctx, accelerationRng);
  const { campaignMonth, eventLedger, financialLedger, nextSeq, collector } = ctx;
  const shipBuilding = ctx.engineOptions?.shipBuilding;

  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;

    const designs = ctx.snapshot.read("designs");
    const projects = nation["constructionProjects"];
    const foreignSkip = foreign.zeroWork.get(nationId);
    const haltedProjects = projects.filter((p) => p["status"] === "HALTED");
    const delayedAtStart = projects.filter((p) => p["status"] === "DELAYED");

    const acceleratedProjects = projects.filter((p) => p["status"] === "ACCELERATED");
    let delayedByPressure = new Set<string>();
    if (acceleratedProjects.length > 0) {
      let normalDemand = 0;
      let acceleratedDemand = 0;
      for (const project of projects) {
        if (
          project["status"] === "HALTED" ||
          project["status"] === "DELAYED" ||
          project["status"] === "COMPLETED"
        )
          continue;
        const demand = projectConstructionDemand(
          project,
          capacityOf(designs, project),
          campaignMonth,
        );
        if (project["status"] === "ACCELERATED") acceleratedDemand += demand;
        else normalDemand += demand;
      }
      const pressure = resolveAccelerationCapacityPressure({
        nationId,
        campaignMonth,
        normalDemand,
        acceleratedDemand,
        availableCapacity: ACCELERATION_POOL_UNDEFINED_UNITS,
        acceleratedProjects,
        randomEngine: accelerationRng,
        randomLedger: ctx.randomLedger,
      });
      delayedByPressure = new Set(pressure.delayedProjectIds);
    }

    const delayedAtStartIds = new Set(delayedAtStart.map((p) => p["id"]));
    const delayedProjects = projects.filter(
      (p) => p["status"] === "DELAYED" || delayedByPressure.has(p["id"]),
    );

    for (const project of delayedProjects)
      eventLedger.append(
        constructionDelayedEvent(
          project["id"],
          nationId,
          project["delayReasonCode"] ??
            (delayedByPressure.has(project["id"])
              ? ACCELERATION_CAPACITY_PRESSURE_DELAY
              : PROJECT_DELAYED_ZERO_WORK),
          nextSeq(),
          campaignMonth,
        ),
      );

    let preservationDelta = 0;
    if (haltedProjects.length > 0) {
      const balance = shipBuilding?.environmentFor(campaignMonth).constructionBalance;
      const unitMicro = shipBuilding?.treasuryUnitMicro;
      if (balance === undefined || unitMicro === undefined)
        collector.addWarning(
          "CONSTRUCTION_PRESERVATION_BALANCE_MISSING",
          `Nation ${nationId} has ${haltedProjects.length} halted project(s) but no ship-building balance; no preservation cost charged`,
          { stage: "appropriation" },
        );
      else preservationDelta = preservationCostUnits(balance, unitMicro) * haltedProjects.length;
    }

    const preservationSettlement = settleOutflow(SafeInt(preservationDelta), nation["treasury"]);
    reportOutflowShortfall(
      collector,
      nationId,
      "preservation",
      preservationSettlement,
      "appropriation",
    );
    preservationDelta = preservationSettlement.paid as number;

    let updatedProjects = projects;
    if (delayedByPressure.size > 0)
      updatedProjects = projects.map((p) =>
        delayedByPressure.has(p["id"]) ? transitionConstructionProject(p, "DELAYED") : p,
      );
    let totalDelta = SafeInt.ZERO;

    const expenseReserve = nation["expenses"];
    const available = SafeInt.sub(
      SafeInt.sub(nation["treasury"], SafeInt(preservationDelta)),
      expenseReserve,
    );
    const fundable =
      (available as number) > 0
        ? updatedProjects.filter(
            (p) =>
              (p["completedWork"] as number) < (p["totalWork"] as number) &&
              p["status"] !== "COMPLETED" &&
              p["status"] !== "CANCELLED" &&
              p["status"] !== "HALTED" &&
              p["status"] !== "DELAYED" &&
              !(foreignSkip?.has(p["id"]) ?? false),
          )
        : [];
    const constructionRequested = fundable.reduce((sum: number, p) => {
      const remaining = (p["totalWork"] as number) - (p["completedWork"] as number);
      if (p["packages"] === undefined) return sum + remaining;
      const absorbable = fundConstructionProject(
        p,
        capacityOf(ctx.snapshot.read("designs"), p),
        Number.MAX_SAFE_INTEGER,
        campaignMonth,
      ).applied;
      return sum + Math.min(remaining, absorbable);
    }, 0);
    if (fundable.length > 0) {
      const totalRemainingWork = fundable.reduce(
        (sum: SafeInt, p) => SafeInt.add(sum, SafeInt.sub(p["totalWork"], p["completedWork"])),
        SafeInt.ZERO,
      );
      if ((totalRemainingWork as number) > 0) {
        let remainingFunds = available;
        updatedProjects = [...updatedProjects];

        const remainingWorks = fundable.map((p) =>
          Number(SafeInt.sub(p["totalWork"], p["completedWork"])),
        );
        const allocations = splitLargestRemainder(available as number, remainingWorks);

        for (let fi = 0; fi < fundable.length; fi += 1) {
          const project = fundable[fi]!;
          if ((remainingFunds as number) <= 0) break;

          const remainingWork = SafeInt.sub(project["totalWork"], project["completedWork"]);
          const alloc = SafeInt(allocations[fi]!);
          const clampedAlloc = alloc > remainingWork ? remainingWork : alloc;
          if ((clampedAlloc as number) <= 0) continue;

          if (project["packages"] !== undefined) {
            const funded = fundConstructionProject(
              project,
              capacityOf(ctx.snapshot.read("designs"), project),
              clampedAlloc as number,
              campaignMonth,
            );
            if (funded.applied <= 0) continue;
            const applied = SafeInt(funded.applied);
            totalDelta = SafeInt.add(totalDelta, applied);
            remainingFunds = SafeInt.sub(remainingFunds, applied);
            updatedProjects = updatedProjects.map((p) =>
              p["id"] === project["id"] ? funded.project : p,
            );
            continue;
          }

          totalDelta = SafeInt.add(totalDelta, clampedAlloc);
          remainingFunds = SafeInt.sub(remainingFunds, clampedAlloc);

          updatedProjects = updatedProjects.map((p) =>
            p["id"] === project["id"]
              ? {
                  ...transitionConstructionProject(p, constructionWorkStatus(p["status"])),
                  completedWork: SafeInt.add(p["completedWork"], clampedAlloc),
                  paidWork: SafeInt.add(p["paidWork"], clampedAlloc),
                }
              : p,
          );
        }

        const leftover = applyLeftoverFunding(
          updatedProjects,
          remainingFunds,
          ctx.snapshot.read("designs"),
          campaignMonth,
          foreignSkip,
        );
        updatedProjects = leftover.projects;
        totalDelta = SafeInt.add(totalDelta, leftover.delta);
      }
    }

    if (delayedAtStart.length > 0) {
      updatedProjects = updatedProjects.map((p) =>
        p["status"] === "DELAYED" &&
        delayedAtStartIds.has(p["id"]) &&
        p["delayReasonCode"] !== FOREIGN_PAYMENT_DEFAULT_DELAYED &&
        !foreign.capabilityDelayed.has(p["id"])
          ? withoutDelayReason(
              transitionConstructionProject(
                p,
                constructionResumeTarget(designs.get(p["designVersionId"])).status,
              ),
            )
          : p,
      );
    }

    const totalCharge = SafeInt.add(totalDelta, SafeInt(preservationDelta));
    if ((totalCharge as number) > 0 || delayedProjects.length > 0) {
      const previousTreasury = nation["treasury"];
      const newTreasury = SafeInt.sub(previousTreasury, totalCharge);

      const updatedNation: NationState = {
        ...nation,
        treasury: newTreasury,
        constructionProjects: updatedProjects,
      };
      const updatedNations = new Map(ctx.snapshot.read("nations"));
      updatedNations.set(nationId, updatedNation);
      ctx.snapshot.write("nations", updatedNations);

      if ((totalDelta as number) > 0) {
        financialLedger.append(
          makeLedgerEntry(
            nationId,
            "appropriation",
            "APPROPRIATION",
            totalDelta,
            totalDelta,
            previousTreasury,
            newTreasury,
            "Proportional appropriation to construction projects",
            campaignMonth,
            {
              requested: SafeInt(Math.max(constructionRequested, totalDelta as number)),
              paid: totalDelta,
              shortfall: SafeInt(Math.max(constructionRequested - (totalDelta as number), 0)),
            },
          ),
        );
      }

      if (preservationDelta > 0) {
        financialLedger.append(
          makeLedgerEntry(
            nationId,
            "appropriation",
            "CONSTRUCTION_PRESERVATION",
            SafeInt(preservationDelta),
            SafeInt(preservationDelta),
            previousTreasury,
            newTreasury,
            `Preservation cost for ${haltedProjects.length} halted project(s)`,
            campaignMonth,
            preservationSettlement,
          ),
        );
      }

      if ((totalCharge as number) > 0) {
        eventLedger.append(
          budgetChangedEvent(
            nationId,
            previousTreasury,
            newTreasury,
            SafeInt.mul(totalCharge, SafeInt(-1)),
            preservationDelta > 0
              ? "Construction appropriation and preservation cost"
              : "Proportional appropriation to construction projects",
            nextSeq(),
            campaignMonth,
          ),
        );
      }
    }
  }

  const privateExpansion = resolvePrivateDockExpansion({
    snapshot: ctx.snapshot.view(),
    campaignMonth,
    randomEngine: accelerationRng,
    randomLedger: ctx.randomLedger,
  });
  ctx.snapshot.current = privateExpansion.snapshot;
  return { status: "continue" };
}

function applyLeftoverFunding(
  projects: ConstructionProject[],
  remainingFunds: SafeInt,
  designs: CampaignSnapshot["designs"],
  campaignMonth: string,
  foreignSkip: ReadonlySet<string> | undefined,
): { projects: ConstructionProject[]; delta: SafeInt } {
  if ((remainingFunds as number) <= 0) {
    return { projects, delta: SafeInt.ZERO };
  }
  const skipped = (p: ConstructionProject): boolean => foreignSkip?.has(p["id"]) ?? false;
  for (const candidate of projects) {
    if (
      candidate["packages"] === undefined ||
      candidate["status"] === "COMPLETED" ||
      candidate["status"] === "CANCELLED"
    )
      continue;
    if (candidate["status"] === "HALTED" || candidate["status"] === "DELAYED") continue;
    if (skipped(candidate)) continue;
    if ((candidate["completedWork"] as number) >= (candidate["totalWork"] as number)) continue;
    const funded = fundConstructionProject(
      candidate,
      capacityOf(designs, candidate),
      remainingFunds as number,
      campaignMonth,
    );
    if (funded.applied <= 0) continue;
    return {
      projects: projects.map((p) => (p["id"] === candidate["id"] ? funded.project : p)),
      delta: SafeInt(funded.applied),
    };
  }
  const firstIncomplete = projects.find(
    (p) =>
      p["packages"] === undefined &&
      (p["completedWork"] as number) < (p["totalWork"] as number) &&
      p["status"] !== "COMPLETED" &&
      p["status"] !== "CANCELLED" &&
      p["status"] !== "HALTED" &&
      p["status"] !== "DELAYED" &&
      !skipped(p),
  );
  if (!firstIncomplete) return { projects, delta: SafeInt.ZERO };

  const remainingWork = SafeInt.sub(firstIncomplete["totalWork"], firstIncomplete["completedWork"]);
  const extra = remainingFunds > remainingWork ? remainingWork : remainingFunds;
  if ((extra as number) <= 0) return { projects, delta: SafeInt.ZERO };

  return {
    projects: projects.map((p) =>
      p["id"] === firstIncomplete["id"]
        ? {
            ...transitionConstructionProject(p, constructionWorkStatus(p["status"])),
            completedWork: SafeInt.add(p["completedWork"], extra),
            paidWork: SafeInt.add(p["paidWork"], extra),
          }
        : p,
    ),
    delta: extra,
  };
}

export function runMaintenancePhase(ctx: PhaseContext): PhaseRunOutcome {
  const { campaignMonth, eventLedger, financialLedger, nextSeq } = ctx;

  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;

    const atWar = nationIsAtWar(ctx.snapshot.read("wars")["wars"], nationId);

    const totalMaintenance = nationMonthlyMaintenance(nation["fleets"], atWar);

    if ((totalMaintenance as number) <= 0) continue;

    const previousTreasury = nation["treasury"];
    const settlement = settleOutflow(totalMaintenance, previousTreasury);
    const actualNew = SafeInt.sub(previousTreasury, settlement.paid);
    reportOutflowShortfall(ctx.collector, nationId, "maintenance", settlement, "maintenance");

    const updatedNation: NationState = {
      ...nation,
      treasury: actualNew,
      maintenanceCost: totalMaintenance,
    };
    const updatedNations = new Map(ctx.snapshot.read("nations"));
    updatedNations.set(nationId, updatedNation);
    ctx.snapshot.write("nations", updatedNations);

    financialLedger.append(
      makeLedgerEntry(
        nationId,
        "maintenance",
        "MAINTENANCE_EXPENDITURE",
        settlement.paid,
        settlement.paid,
        previousTreasury,
        actualNew,
        "Monthly ship maintenance costs",
        campaignMonth,
        settlement,
      ),
    );

    eventLedger.append(
      budgetChangedEvent(
        nationId,
        previousTreasury,
        actualNew,
        SafeInt.mul(settlement.paid, SafeInt(-1)),
        "Monthly ship maintenance costs",
        nextSeq(),
        campaignMonth,
      ),
    );
  }

  applyReadinessEvolution(ctx);
  return { status: "continue" };
}

export function runObligationPhase(ctx: PhaseContext): PhaseRunOutcome {
  const { campaignMonth, collector, eventLedger, financialLedger, nextSeq } = ctx;

  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;
    const previousTreasury = nation["treasury"];
    const settlement = settleOutflow(nation["expenses"], previousTreasury);
    const expense = settlement.paid;
    const actualNew = SafeInt.sub(previousTreasury, expense);
    reportOutflowShortfall(collector, nationId, "obligation", settlement, "obligation");

    const updatedNation: NationState = {
      ...nation,
      treasury: actualNew,
    };
    const updatedNations = new Map(ctx.snapshot.read("nations"));
    updatedNations.set(nationId, updatedNation);
    ctx.snapshot.write("nations", updatedNations);

    financialLedger.append(
      makeLedgerEntry(
        nationId,
        "obligation",
        "OBLIGATION",
        expense,
        expense,
        previousTreasury,
        actualNew,
        "Mandatory fixed expenses",
        campaignMonth,
        settlement,
      ),
    );

    eventLedger.append(
      budgetChangedEvent(
        nationId,
        previousTreasury,
        actualNew,
        SafeInt.mul(expense, SafeInt(-1)),
        "Mandatory fixed expenses",
        nextSeq(),
        campaignMonth,
      ),
    );

    if (ctx.playerNationId === nationId && (settlement.shortfall as number) > 0) {
      applyPrestigeChange(ctx, nationId, "UNPAID_FUNDS");
    }
  }
  return { status: "continue" };
}

export const monthlyRevenuePhase: MonthPhase = {
  id: "monthly_revenue",
  name: "Monthly Revenue",
  permissions: { reads: ["nations"], writes: ["nations"], rng: false },
  run: runMonthlyRevenuePhase,
};

export const appropriationPhase: MonthPhase = {
  id: "appropriation",
  name: "Appropriation",
  permissions: {
    reads: ["nations", "designs", "designFamilies", "world", "politics"],
    writes: ["nations", "designs", "designFamilies"],
    rng: true,
  },
  run: runAppropriationPhase,
};

export const maintenancePhase: MonthPhase = {
  id: "maintenance",
  name: "Maintenance",
  permissions: { reads: ["nations", "wars"], writes: ["nations"], rng: false },
  run: runMaintenancePhase,
};

export const obligationPhase: MonthPhase = {
  id: "obligation",
  name: "Obligation",
  permissions: {
    reads: ["nations", "prestigeRules", "rulesetVersion"],
    writes: ["nations"],
    rng: false,
  },
  run: runObligationPhase,
};
