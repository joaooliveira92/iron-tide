import type { ConstructionProject, EconomyOutlookOptions } from "@bluewave/campaign";
import {
  campaignMonthId,
  economyOutlook,
  monthlyAbsorbable,
  type CampaignSnapshot,
} from "@bluewave/campaign";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { ExplanationBuilder, type ExplanationTree } from "@bluewave/events";
import {
  preservationCostPerMonthMicro,
  type AccelerationTerms,
  type ConstructionBalance,
  type ShipBuildingContent,
} from "@bluewave/ship-design";
import { applySetAcceleration } from "./commands.js";
import {
  accelerationDelayEligible,
  accelerationExcessPressureBp,
  accelerationTermsFor,
  nationAccelerationPressureOf,
  type NationAccelerationPressure,
} from "./constructionAcceleration.js";
import { constructionResumeTarget } from "./constructionHaltResume.js";
import { constructionProjectQueueWithReadouts as queueWithReadouts } from "./constructionReadout.js";
import { capacityOf, preservationCostUnits } from "./economyPhases.js";

const FORMULA_VERSION = "construction_steering_v1";
const SOURCE = {
  kind: "code",
  ref: "packages/phase-engine/src/constructionSteeringPreview.ts",
} as const;
const BP = 10_000;

export type AccelerationDelayRisk = "NONE" | "POSSIBLE";

export interface AccelerationPreview {
  readonly monthsNow: number;
  readonly monthsAccelerated: number;
  readonly monthsSaved: number;
  readonly launchMonthNow: string | null;
  readonly launchMonthAccelerated: string | null;
  readonly premiumUnits: number;
  readonly premiumRateBp: number;
  readonly delayRisk: AccelerationDelayRisk;
  readonly delayChanceBp: number;
  readonly fundsLimited: boolean;
  readonly monthsExplanation: ExplanationTree;
  readonly premiumExplanation: ExplanationTree;
  readonly delayExplanation: ExplanationTree;
}

export interface HaltPreview {
  readonly carryingCostUnits: number;
  readonly resumeStatus: "ACTIVE" | "AWAITING_CAPACITY";
  readonly losesAcceleration: boolean;
  readonly carryingExplanation: ExplanationTree;
}

export interface ConstructionSteeringPreview {
  readonly accelerate: AccelerationPreview | null;
  readonly halt: HaltPreview | null;
}

function leaf(formulaId: string, amount: number, unit: string): ExplanationTree {
  return new ExplanationBuilder(formulaId, FORMULA_VERSION)
    .withInput("amount", amount)
    .withResult(amount)
    .withUnit(unit)
    .withSource(SOURCE)
    .build();
}

function monthsTree(now: number, accelerated: number): ExplanationTree {
  return new ExplanationBuilder("construction_acceleration_months", FORMULA_VERSION)
    .withInput("monthsNow", now)
    .withInput("monthsAccelerated", accelerated)
    .withResult(now - accelerated)
    .withUnit("months")
    .withOperation("subtract")
    .withSource(SOURCE)
    .addChild(leaf("construction_acceleration_months.now", now, "months"))
    .addChild(leaf("construction_acceleration_months.accelerated", accelerated, "months"))
    .build();
}

function premiumTree(remainingWork: number, rateBp: number, premiumUnits: number): ExplanationTree {
  return new ExplanationBuilder("construction_acceleration_premium", FORMULA_VERSION)
    .withInput("remainingWork", remainingWork)
    .withInput("premiumRateBp", rateBp)
    .withInput("divisorBp", BP)
    .withInput("rounding", "ceil")
    .withIntermediate("acceleratedRemainingWork", remainingWork + premiumUnits)
    .withResult(premiumUnits)
    .withUnit("nc")
    .withOperation("multiply")
    .withSource(SOURCE)
    .addChild(leaf("construction_acceleration_premium.remainingWork", remainingWork, "nc"))
    .addChild(leaf("construction_acceleration_premium.rate", rateBp, "bp"))
    .build();
}

function delayTree(
  pressure: NationAccelerationPressure,
  terms: AccelerationTerms,
  chanceBp: number,
): ExplanationTree {
  const pressureBp = pressure.capacityPressureBp;
  const thresholdBp = terms.delayThresholdBp;
  const ceilingBp = terms.delayProbabilityCapBp;
  return new ExplanationBuilder("construction_acceleration_delay", FORMULA_VERSION)
    .withInput("weightedDemand", pressure.weightedDemand)
    .withInput("poolUnits", pressure.poolUnits)
    .withInput("capacityPressureBp", pressureBp)
    .withInput("delayThresholdBp", thresholdBp)
    .withInput("delayProbabilityCapBp", ceilingBp)
    .withInput("divisorBp", BP)
    .withInput("rounding", "floor")
    .withIntermediate("excessPressureBp", accelerationExcessPressureBp(pressureBp, terms))
    .withResult(chanceBp)
    .withUnit("bp")
    .withOperation("multiply")
    .withSource(SOURCE)
    .addChild(leaf("construction_acceleration_delay.pressure", pressureBp, "bp"))
    .addChild(leaf("construction_acceleration_delay.threshold", thresholdBp, "bp"))
    .addChild(leaf("construction_acceleration_delay.ceiling", ceilingBp, "bp"))
    .build();
}

function carryingTree(
  balance: ConstructionBalance,
  treasuryUnitMicro: number,
  carryingCostUnits: number,
): ExplanationTree {
  const baseMicro = balance.mothballedMaintenancePerMonthMicro;
  const rateBp = balance.preservationCostBp;
  return new ExplanationBuilder("construction_halt_carrying", FORMULA_VERSION)
    .withInput("mothballedMaintenancePerMonthMicro", baseMicro)
    .withInput("preservationCostBp", rateBp)
    .withInput("divisorBp", BP)
    .withInput("treasuryUnitMicro", treasuryUnitMicro)
    .withInput("rounding", "ceil")
    .withIntermediate("preservationCostPerMonthMicro", preservationCostPerMonthMicro(balance))
    .withResult(carryingCostUnits)
    .withUnit("nc")
    .withOperation("multiply")
    .withSource(SOURCE)
    .addChild(leaf("construction_halt_carrying.base", baseMicro, "micro"))
    .addChild(leaf("construction_halt_carrying.rate", rateBp, "bp"))
    .addChild(leaf("construction_halt_carrying.unit", treasuryUnitMicro, "micro"))
    .build();
}

function replaceProject(
  snapshot: CampaignSnapshot,
  nationId: string,
  projectId: string,
): ConstructionProject | undefined {
  return snapshot.nations.get(nationId)?.constructionProjects.find((p) => p.id === projectId);
}

function acceleratePreview(
  snapshot: CampaignSnapshot,
  nationId: string,
  project: ConstructionProject,
  content: ShipBuildingContent,
  month: string,
  outlookOptions: EconomyOutlookOptions,
): AccelerationPreview | null {
  const terms = accelerationTermsFor(content, month);
  if (terms === undefined || project.status !== "ACTIVE") return null;
  const collector = new DiagnosticCollector();
  const hypothetical = applySetAcceleration(
    snapshot,
    { type: "SetAcceleration", nationId, projectId: project.id, accelerated: true },
    collector,
    terms,
    month,
  );
  const hypotheticalProject = replaceProject(hypothetical, nationId, project.id);
  if (hypothetical === snapshot || hypotheticalProject === undefined) return null;

  const readoutOf = (from: CampaignSnapshot) =>
    queueWithReadouts(from, nationId, content, month).find((e) => e.projectId === project.id)
      ?.readout;
  const now = readoutOf(snapshot);
  const accelerated = readoutOf(hypothetical);
  if (now === undefined || accelerated === undefined) return null;

  const designs = hypothetical.designs;
  const pressure = nationAccelerationPressureOf(
    hypothetical.nations.get(nationId)?.constructionProjects ?? [],
    (candidate) => capacityOf(designs, candidate),
    month,
    terms,
  );
  const eligible = accelerationDelayEligible(pressure.capacityPressureBp, terms);
  const delayChanceBp = eligible ? pressure.delayProbabilityBp : 0;

  const premiumUnits = Number(hypotheticalProject.totalWork) - Number(project.totalWork);
  const remainingWork = Math.max(0, Number(project.totalWork) - Number(project.completedWork));
  const premiumRateBp = terms.workMultiplierBp - BP;

  const outlook = economyOutlook(hypothetical, nationId, outlookOptions);
  const funded = outlook?.constructionDraws.find((d) => d.projectId === project.id)?.draw ?? 0;
  const absorbable = monthlyAbsorbable(
    hypotheticalProject,
    capacityOf(designs, hypotheticalProject),
    month,
    terms,
  );

  const monthsNow = now.remainingMonths;
  const monthsAccelerated = accelerated.remainingMonths;
  return {
    monthsNow,
    monthsAccelerated,
    monthsSaved: monthsNow - monthsAccelerated,
    launchMonthNow: now.launchMonth,
    launchMonthAccelerated: accelerated.launchMonth,
    premiumUnits,
    premiumRateBp,
    delayRisk: delayChanceBp > 0 ? "POSSIBLE" : "NONE",
    delayChanceBp,
    fundsLimited: funded < absorbable,
    monthsExplanation: monthsTree(monthsNow, monthsAccelerated),
    premiumExplanation: premiumTree(remainingWork, premiumRateBp, premiumUnits),
    delayExplanation: delayTree(pressure, terms, delayChanceBp),
  };
}

function haltPreview(
  snapshot: CampaignSnapshot,
  project: ConstructionProject,
  content: ShipBuildingContent,
  month: string,
): HaltPreview | null {
  if (project.status !== "ACTIVE" && project.status !== "ACCELERATED") return null;
  const balance = content.environmentFor(month).constructionBalance;
  const carryingCostUnits = preservationCostUnits(balance, content.treasuryUnitMicro);
  const target = constructionResumeTarget(snapshot.designs.get(project.designVersionId));
  return {
    carryingCostUnits,
    resumeStatus: target.status,
    losesAcceleration: project.status === "ACCELERATED",
    carryingExplanation: carryingTree(balance, content.treasuryUnitMicro, carryingCostUnits),
  };
}

export function constructionSteeringPreviews(
  snapshot: CampaignSnapshot,
  nationId: string,
  content: ShipBuildingContent,
  outlookOptions: EconomyOutlookOptions,
): ReadonlyMap<string, ConstructionSteeringPreview> {
  const month = campaignMonthId(snapshot.startYear, snapshot.startMonth, snapshot.turnNumber);
  const previews = new Map<string, ConstructionSteeringPreview>();
  for (const project of snapshot.nations.get(nationId)?.constructionProjects ?? []) {
    if (project.foreignContractId !== undefined) continue;
    const accelerate = acceleratePreview(
      snapshot,
      nationId,
      project,
      content,
      month,
      outlookOptions,
    );
    const halt = haltPreview(snapshot, project, content, month);
    if (accelerate !== null || halt !== null) previews.set(project.id, { accelerate, halt });
  }
  return previews;
}
