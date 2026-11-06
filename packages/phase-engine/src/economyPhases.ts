import type { CampaignSnapshot, ConstructionProject, NationState } from "@bluewave/campaign";
import {
  allocateConstructionFunds,
  capacityOf,
  isUnpacedNewConstruction,
  monthlyRevenue,
  splitLargestRemainder,
  nationIsAtWar,
  nationMonthlyMaintenance,
  nationMaintenanceAdders,
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
import { constructionResumeTarget } from "./constructionHaltResume.js";
import {
  ACCELERATION_CAPACITY_PRESSURE_DELAY,
  ACCELERATION_POOL_UNDEFINED_UNITS,
  accelerationDemandOf,
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

export { capacityOf, isUnpacedNewConstruction, splitLargestRemainder };

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

export const UNPACED_CONSTRUCTION_NOT_FUNDED = "UNPACED_CONSTRUCTION_NOT_FUNDED" as const;

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
      const { normalDemand, acceleratedDemand } = accelerationDemandOf(
        projects,
        (project) => capacityOf(designs, project),
        campaignMonth,
      );
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

    const expenseReserve = nation["expenses"];
    const available = SafeInt.sub(
      SafeInt.sub(nation["treasury"], SafeInt(preservationDelta)),
      expenseReserve,
    );
    for (const unpaced of updatedProjects.filter(isUnpacedNewConstruction))
      if (unpaced["status"] !== "COMPLETED" && unpaced["status"] !== "CANCELLED")
        collector.addWarning(
          UNPACED_CONSTRUCTION_NOT_FUNDED,
          `Project ${unpaced["id"]} of nation ${nationId} has no work packages, so it is not funded`,
          { stage: "appropriation", entityId: unpaced["id"] },
        );
    const allocation = allocateConstructionFunds({
      projects: updatedProjects,
      available,
      designs: ctx.snapshot.read("designs"),
      month: campaignMonth,
      foreignSkip,
    });
    updatedProjects = allocation.projects;
    const totalDelta = allocation.delta;
    const constructionRequested = allocation.requested;

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

export function runMaintenancePhase(ctx: PhaseContext): PhaseRunOutcome {
  const { campaignMonth, eventLedger, financialLedger, nextSeq } = ctx;

  for (const [nationId, nation] of ctx.snapshot.read("nations")) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;

    const atWar = nationIsAtWar(ctx.snapshot.read("wars")["wars"], nationId);

    const totalMaintenance = nationMonthlyMaintenance(
      nation["fleets"],
      atWar,
      nationMaintenanceAdders(nation, campaignMonth),
    );

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
