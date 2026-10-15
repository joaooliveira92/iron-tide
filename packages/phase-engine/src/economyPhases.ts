// Economy phases: monthly_revenue, appropriation, maintenance, obligation.
import type { CampaignSnapshot, ConstructionProject, NationState, Ship } from "@bluewave/campaign";
import { transitionConstructionProject } from "@bluewave/campaign";
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
import type { MonthContext } from "./monthContext.js";

function computeMaintenanceCost(ship: Ship): SafeInt {
  return SafeInt.div(SafeInt.mul(ship["hitPoints"], SafeInt(10)), SafeInt(100), "floor");
}

function computeConstructionCap(nation: NationState): SafeInt {
  const base = nation["baseResources"] ?? (0 as SafeInt);
  return SafeInt.div(SafeInt.div(base, SafeInt(12)), SafeInt(100), "floor");
}

// Phase 2: monthly_revenue — naval appropriation into each active nation's treasury.
export function runMonthlyRevenuePhase(ctx: MonthContext): void {
  const { campaignMonth, eventLedger, financialLedger, nextSeq } = ctx;

  for (const [nationId, nation] of ctx.currentSnapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;
    const baseResources = nation["baseResources"] ?? (0 as SafeInt);
    const rateBp = nation["navalAppropriationRateBp"] ?? (0 as SafeInt);
    const revenue = SafeInt.div(
      SafeInt.div(SafeInt.mul(baseResources, rateBp), SafeInt(10000)),
      SafeInt(12),
      "floor",
    );
    if ((revenue as number) <= 0) continue;

    const previousBalance = nation["treasury"];
    const newBalance = SafeInt.add(previousBalance, revenue);

    const updatedNation: NationState = {
      ...nation,
      treasury: newBalance,
    };
    const updatedNations = new Map(ctx.currentSnapshot["nations"]);
    updatedNations.set(nationId, updatedNation);
    ctx.currentSnapshot = { ...ctx.currentSnapshot, nations: updatedNations };

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
}

/** The monthly yard capacity (treasury units per line) recorded on a project's design, or undefined when it has none. */
function capacityOf(
  designs: CampaignSnapshot["designs"],
  project: ConstructionProject,
): Record<string, number> | undefined {
  const capacity = designs.get(project["designVersionId"])?.constructionPlan?.capacityUnits;
  return capacity === undefined
    ? undefined
    : Object.fromEntries(Object.entries(capacity).map(([line, v]) => [line, v as number]));
}

/** The stable reason a delayed month carries (DESIGN-23 section 32). */
export const PROJECT_DELAYED_ZERO_WORK = "PROJECT_DELAYED_ZERO_WORK" as const;

/**
 * Remove a project's delay reason. The reason describes why the project was held; once the ordinary auto-resume
 * returns it to work, keeping it would violate the "reason only on a delayed month" invariant.
 */
function withoutDelayReason(project: ConstructionProject): ConstructionProject {
  if (!("delayReasonCode" in project)) return project;
  const next = { ...project };
  delete next.delayReasonCode;
  return next;
}

/**
 * The preservation cost one `HALTED` project pays for a month, in treasury units: half the mothballed maintenance,
 * rounded up to a whole treasury unit (RTW3 manual pp. 30-31; DESIGN-23 section 7). Pure; zero when no base is authored.
 */
export function preservationCostUnits(
  balance: ConstructionBalance,
  treasuryUnitMicro: number,
): number {
  if (!Number.isFinite(treasuryUnitMicro) || treasuryUnitMicro <= 0) return 0;
  const micro = preservationCostPerMonthMicro(balance);
  return micro <= 0 ? 0 : treasuryCostUnits(micro, treasuryUnitMicro);
}

// Phase 4: appropriation — proportional funding of construction projects within
// the nation's construction cap. Halted projects take no ordinary charge and pay
// the preservation cost instead; delayed projects take no charge at all and
// resume the following month (DESIGN-23 section 7).
export function runAppropriationPhase(ctx: MonthContext): void {
  // Design studies are paid first: design-office work is small and gates every new class (ADR-0085).
  fundDesignStudies(ctx);
  // ADR-0036/INC-4: the appropriation phase draws the keyed acceleration-pressure delay decisions; obtain the
  // phase-scoped engine through the guard. With no accelerated project nothing is drawn, so a run without
  // acceleration consumes no randomness and its hashes are unchanged. The same engine also serves the foreign
  // discretionary-impoundment draw (INC-10), which draws only for a hostile contract.
  const accelerationRng = ctx.phaseGuard.rng("appropriation", ctx.randomSeed);
  // DESIGN-16 section 13.4 (INC-9): resolve every foreign contract's month before domestic funding. Payments debit the
  // ordering treasury and credit the builder; work is unlocked solely by the paid instalments (INC-9d), so a foreign
  // project is always skipped by ordinary appropriation. The returned capability-delayed set keeps a builder-capability
  // `DELAYED` from being unwound by the same-month auto-resume (MAJOR-1). War effects (INC-10) resolve inside it.
  const foreign = runForeignContractPhase(ctx, accelerationRng);
  const { campaignMonth, eventLedger, financialLedger, nextSeq, collector } = ctx;
  const shipBuilding = ctx.engineOptions?.shipBuilding;

  for (const [nationId, nation] of ctx.currentSnapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;

    const designs = ctx.currentSnapshot["designs"];
    const projects = nation["constructionProjects"];
    const foreignSkip = foreign.zeroWork.get(nationId);
    const haltedProjects = projects.filter((p) => p["status"] === "HALTED");
    const delayedAtStart = projects.filter((p) => p["status"] === "DELAYED");

    // SB3-R9: acceleration capacity pressure (DESIGN-13 section 11.3.3; DESIGN-23 section 9). The pool is the
    // nation's monthly construction cap (the same cap the appropriation allocates within); demand is each live
    // project's monthly construction-plan capacity. An accelerated project's demand is weighted 12_500 bp; once the
    // pool's pressure exceeds 9_000 bp, each eligible accelerated project is checked, in ascending project id order,
    // on the keyed stream and delayed exactly one month on a successful check.
    const acceleratedProjects = projects.filter((p) => p["status"] === "ACCELERATED");
    let delayedByPressure = new Set<string>();
    if (acceleratedProjects.length > 0 && accelerationRng !== null) {
      let normalDemand = 0;
      let acceleratedDemand = 0;
      for (const project of projects) {
        if (
          project["status"] === "HALTED" ||
          project["status"] === "DELAYED" ||
          project["status"] === "COMPLETED"
        )
          continue;
        const demand = projectConstructionDemand(project, capacityOf(designs, project));
        if (project["status"] === "ACCELERATED") acceleratedDemand += demand;
        else normalDemand += demand;
      }
      const pressure = resolveAccelerationCapacityPressure({
        nationId,
        campaignMonth,
        normalDemand,
        acceleratedDemand,
        availableCapacity: Number(computeConstructionCap(nation)),
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

    // One explicit delay record per delayed project, whatever funds are available (DESIGN-23 section 7). A
    // capacity-pressure delay additionally carries the `ACCELERATION_CAPACITY_PRESSURE_DELAY` reason.
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

    // Preservation cost: half the mothballed maintenance, taking the place of a halted hull's ordinary work charge.
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

    let updatedProjects = projects;
    if (delayedByPressure.size > 0)
      updatedProjects = projects.map((p) =>
        delayedByPressure.has(p["id"]) ? transitionConstructionProject(p, "DELAYED") : p,
      );
    let totalDelta = SafeInt.ZERO;

    const expenseReserve = nation["expenses"];
    const available = SafeInt.sub(nation["treasury"], expenseReserve);
    const fundable =
      (available as number) > 0
        ? updatedProjects.filter(
            (p) =>
              (p["completedWork"] as number) < (p["totalWork"] as number) &&
              p["status"] !== "COMPLETED" &&
              p["status"] !== "HALTED" &&
              p["status"] !== "DELAYED" &&
              !(foreignSkip?.has(p["id"]) ?? false),
          )
        : [];
    if (fundable.length > 0) {
      const totalRemainingWork = fundable.reduce(
        (sum: SafeInt, p) => SafeInt.add(sum, SafeInt.sub(p["totalWork"], p["completedWork"])),
        SafeInt.ZERO,
      );
      if ((totalRemainingWork as number) > 0) {
        const constructionCap = computeConstructionCap(nation);
        let remainingFunds = available;
        let remainingCap = constructionCap;
        updatedProjects = [...updatedProjects];

        for (const project of fundable) {
          if ((remainingCap as number) <= 0) break;

          const remainingWork = SafeInt.sub(project["totalWork"], project["completedWork"]);
          const proportion = (remainingWork as number) / (totalRemainingWork as number);
          const alloc = SafeInt(Math.floor(proportion * (available as number)));
          const cappedAlloc =
            (remainingCap as number) > 0 && alloc > remainingCap ? remainingCap : alloc;
          const clampedAlloc = cappedAlloc > remainingWork ? remainingWork : cappedAlloc;
          if ((clampedAlloc as number) <= 0) continue;

          if (project["packages"] !== undefined) {
            // Per-package construction (ADR-0077): only what the yard can do this month is applied and charged.
            const funded = fundConstructionProject(
              project,
              capacityOf(ctx.currentSnapshot["designs"], project),
              clampedAlloc as number,
              campaignMonth,
            );
            if (funded.applied <= 0) continue;
            const applied = SafeInt(funded.applied);
            totalDelta = SafeInt.add(totalDelta, applied);
            remainingFunds = SafeInt.sub(remainingFunds, applied);
            remainingCap = SafeInt.sub(remainingCap, applied);
            updatedProjects = updatedProjects.map((p) =>
              p["id"] === project["id"] ? funded.project : p,
            );
            continue;
          }

          totalDelta = SafeInt.add(totalDelta, clampedAlloc);
          remainingFunds = SafeInt.sub(remainingFunds, clampedAlloc);
          remainingCap = SafeInt.sub(remainingCap, clampedAlloc);

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

        // Apply leftover funds to first incomplete project if within cap
        const leftover = applyLeftoverFunding(
          updatedProjects,
          remainingFunds,
          remainingCap,
          ctx.currentSnapshot["designs"],
          campaignMonth,
          foreignSkip,
        );
        updatedProjects = leftover.projects;
        totalDelta = SafeInt.add(totalDelta, leftover.delta);
      }
    }

    // A project delayed at the start of the month resumes now: the delay lasts exactly one month (DESIGN-23
    // section 9). A project delayed this month by acceleration capacity pressure is NOT resumed here — it stays
    // DELAYED for the month (zero work, zero charge) and resumes at the start of the next one, so a pressure delay
    // is exactly one month and its premium is preserved.
    if (delayedAtStart.length > 0) {
      updatedProjects = updatedProjects.map((p) =>
        p["status"] === "DELAYED" &&
        delayedAtStartIds.has(p["id"]) &&
        // A foreign payment default (DESIGN-16 section 13.4) is held until payment or termination; it is not the
        // ordinary one-month capacity delay, so it must not auto-resume here.
        p["delayReasonCode"] !== FOREIGN_PAYMENT_DEFAULT_DELAYED &&
        // A builder-capability delay set this month (MAJOR-1) is held the same way. The foreign step ran before this
        // set was computed, so an explicit exclusion is required or the same month would resume it.
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
      const updatedNations = new Map(ctx.currentSnapshot["nations"]);
      updatedNations.set(nationId, updatedNation);
      ctx.currentSnapshot = { ...ctx.currentSnapshot, nations: updatedNations };

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

  // DESIGN-16 section 6 (SB3-R17): resolve the private dock-expansion opportunity after funding, so a new project is
  // funded from the next month. It draws only for a nation with explicit eligibility whose trailing utilisation clears
  // the `7_500` bp threshold and whose cooldown/one-active rules allow it, so a run with no dock-expansion content
  // consumes no randomness and records no decision (the reference golden run stays byte-identical).
  if (accelerationRng !== null) {
    const privateExpansion = resolvePrivateDockExpansion({
      snapshot: ctx.currentSnapshot,
      campaignMonth,
      randomEngine: accelerationRng,
      randomLedger: ctx.randomLedger,
    });
    ctx.currentSnapshot = privateExpansion.snapshot;
  }
}

// Spend any funds left after proportional allocation on the first incomplete
// project, still bounded by the remaining construction cap.
function applyLeftoverFunding(
  projects: ConstructionProject[],
  remainingFunds: SafeInt,
  remainingCap: SafeInt,
  designs: CampaignSnapshot["designs"],
  campaignMonth: string,
  foreignSkip: ReadonlySet<string> | undefined,
): { projects: ConstructionProject[]; delta: SafeInt } {
  if ((remainingFunds as number) <= 0 || (remainingCap as number) <= 0) {
    return { projects, delta: SafeInt.ZERO };
  }
  const skipped = (p: ConstructionProject): boolean => foreignSkip?.has(p["id"]) ?? false;
  // Projects with work packages take leftover funds in order, skipping one the yard cannot work on this month (ADR-0077).
  const offered =
    (remainingFunds as number) > (remainingCap as number) ? remainingCap : remainingFunds;
  for (const candidate of projects) {
    if (candidate["packages"] === undefined || candidate["status"] === "COMPLETED") continue;
    if (candidate["status"] === "HALTED" || candidate["status"] === "DELAYED") continue;
    if (skipped(candidate)) continue;
    if ((candidate["completedWork"] as number) >= (candidate["totalWork"] as number)) continue;
    const funded = fundConstructionProject(
      candidate,
      capacityOf(designs, candidate),
      offered as number,
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
      p["status"] !== "HALTED" &&
      p["status"] !== "DELAYED" &&
      !skipped(p),
  );
  if (!firstIncomplete) return { projects, delta: SafeInt.ZERO };

  const remainingWork = SafeInt.sub(firstIncomplete["totalWork"], firstIncomplete["completedWork"]);
  const extra = remainingFunds > remainingWork ? remainingWork : remainingFunds;
  const cappedExtra = extra > remainingCap ? remainingCap : extra;
  if ((cappedExtra as number) <= 0) return { projects, delta: SafeInt.ZERO };

  return {
    projects: projects.map((p) =>
      p["id"] === firstIncomplete["id"]
        ? {
            ...transitionConstructionProject(p, constructionWorkStatus(p["status"])),
            completedWork: SafeInt.add(p["completedWork"], cappedExtra),
            paidWork: SafeInt.add(p["paidWork"], cappedExtra),
          }
        : p,
    ),
    delta: cappedExtra,
  };
}

// Phase 5: maintenance — monthly ship maintenance, floored at zero treasury.
export function runMaintenancePhase(ctx: MonthContext): void {
  const { campaignMonth, eventLedger, financialLedger, nextSeq } = ctx;

  for (const [nationId, nation] of ctx.currentSnapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;

    let totalMaintenance = SafeInt.ZERO;
    for (const fleet of nation["fleets"]) {
      for (const ship of fleet["ships"]) {
        totalMaintenance = SafeInt.add(totalMaintenance, computeMaintenanceCost(ship));
      }
    }

    if ((totalMaintenance as number) <= 0) continue;

    const previousTreasury = nation["treasury"];
    const newTreasury = SafeInt.sub(previousTreasury, totalMaintenance);
    const actualNew = newTreasury < (0 as SafeInt) ? (0 as SafeInt) : newTreasury;

    const updatedNation: NationState = {
      ...nation,
      treasury: actualNew,
      maintenanceCost: totalMaintenance,
    };
    const updatedNations = new Map(ctx.currentSnapshot["nations"]);
    updatedNations.set(nationId, updatedNation);
    ctx.currentSnapshot = { ...ctx.currentSnapshot, nations: updatedNations };

    financialLedger.append(
      makeLedgerEntry(
        nationId,
        "maintenance",
        "MAINTENANCE_EXPENDITURE",
        totalMaintenance,
        totalMaintenance,
        previousTreasury,
        actualNew,
        "Monthly ship maintenance costs",
        campaignMonth,
      ),
    );

    eventLedger.append(
      budgetChangedEvent(
        nationId,
        previousTreasury,
        actualNew,
        SafeInt.mul(totalMaintenance, SafeInt(-1)),
        "Monthly ship maintenance costs",
        nextSeq(),
        campaignMonth,
      ),
    );
  }
}

// Phase 6: obligation — mandatory fixed expenses, floored at zero treasury.
export function runObligationPhase(ctx: MonthContext): void {
  const { campaignMonth, collector, eventLedger, financialLedger, nextSeq } = ctx;

  for (const [nationId, nation] of ctx.currentSnapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) continue;
    const expense = nation["expenses"];
    const previousTreasury = nation["treasury"];
    const newTreasury = SafeInt.sub(previousTreasury, expense);
    const actualNew = newTreasury < (0 as SafeInt) ? (0 as SafeInt) : newTreasury;

    if ((newTreasury as number) < 0) {
      collector.addError(
        "NEGATIVE_TREASURY_OBLIGATION",
        `Nation ${nationId} would have negative treasury after obligation`,
        { stage: "obligation" },
      );
    }

    const updatedNation: NationState = {
      ...nation,
      treasury: actualNew,
    };
    const updatedNations = new Map(ctx.currentSnapshot["nations"]);
    updatedNations.set(nationId, updatedNation);
    ctx.currentSnapshot = { ...ctx.currentSnapshot, nations: updatedNations };

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
  }
}
