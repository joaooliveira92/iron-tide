import { groupedInteger } from "./numberText.js";
import { quantity, type ExplanationText } from "./explanation.js";
import type { FlattenedPart, PartInterface } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import { armourAvailabilityFindings, type ArmourRegion, type ArmourRegionId } from "./armour.js";
import type { ComponentCategory } from "./component.js";
import {
  compileDesign,
  type CompiledDesign,
  type DesignDraft,
  type PlacementSpec,
  type ShipContext,
} from "./compile.js";
import { computeCost, type CostBalance, type CostContext } from "./cost.js";
import type { Finding } from "./findings.js";
import { sortFindings } from "./findings.js";
import { standardGunPartId } from "./partCatalogue.js";
import {
  COMPATIBILITY_INTERFACES,
  compatibilitySlotId,
  platformSlots,
  type CompatibilityInterface,
  type CompatibilityModel,
} from "./partCompatibility.js";
import { evaluateConstraints, specAt } from "./partFitConstraints.js";
import { bp, kg, UM_PER_INCH } from "./units.js";

const ARMAMENT_MAIN_GUN_MAX_UM = 6 * UM_PER_INCH;

export interface GunChange {
  readonly role: "MAIN" | "SECONDARY";
  readonly caliberUm: number;
  readonly barrels: number;
  readonly casemate: boolean;
}

const gunFinding = (
  id: string,
  what: ExplanationText,
  why: ExplanationText,
  consequence: ExplanationText,
  remedies: readonly (readonly [string, ExplanationText])[],
  inputs: Record<string, number> = {},
  threshold = 0,
  value = 1,
): Finding => ({
  id,
  severity: "BLOCKING",
  what,
  why,
  consequence,
  remedies: remedies.map(([rid, description]) => ({ id: rid, description })),
  evidence: { formulaId: "DESIGN-23-21-armament", inputs, threshold, value },
});

const inchValue = (um: number) => quantity(um, UM_PER_INCH, 1, "inches");
const barrelsWord = (n: number) =>
  n === 1 ? "single" : n === 2 ? "double" : n === 3 ? "triple" : `${n}-barrel`;

export function armamentChangeFindings(
  removed: readonly GunChange[],
  added: readonly GunChange[],
  mainGunMaxUm: number = ARMAMENT_MAIN_GUN_MAX_UM,
): Finding[] {
  const findings: Finding[] = [];
  const mains = (g: GunChange) => g.role === "MAIN";

  for (const g of removed.filter((x) => !mains(x)))
    if (!(g.casemate || g.caliberUm <= mainGunMaxUm))
      findings.push(
        gunFinding(
          "ARMAMENT_SECONDARY_CHANGE_NOT_ALLOWED",
          "The secondary battery cannot be changed.",
          [
            `The existing ${barrelsWord(g.barrels)} `,
            inchValue(g.caliberUm),
            " in turret is neither a casemate nor a 6-inch-or-under mounting.",
          ],
          "Only casemates and turrets of 6 inches or smaller may be re-battered.",
          [
            ["keep_battery", "Keep the existing secondary guns."],
            ["reconstruct", "Plan a major reconstruction instead."],
            ["casemate_only", "Change only the casemate or small-turret guns."],
          ],
          { caliberUm: g.caliberUm },
          mainGunMaxUm,
          g.caliberUm,
        ),
      );
  for (const g of added.filter((x) => !mains(x)))
    if (g.caliberUm > mainGunMaxUm)
      findings.push(
        gunFinding(
          "ARMAMENT_SECONDARY_TOO_LARGE",
          "A secondary gun would be too large.",
          [
            "A ",
            inchValue(g.caliberUm),
            " in gun cannot be fitted as a secondary; the limit is 6 inches.",
          ],
          "Secondary and tertiary batteries are limited to 6-inch guns.",
          [
            ["smaller_gun", "Choose a gun of 6 inches or less."],
            ["main_battery", "Make it part of the main battery instead."],
            ["drop", "Drop the change."],
          ],
          { caliberUm: g.caliberUm },
          mainGunMaxUm,
          g.caliberUm,
        ),
      );

  const remMains = removed.filter(mains);
  const addMains = added.filter(mains);
  const used = new Set<number>();
  const byCaliber = (cal: number, excl: Set<number>) =>
    addMains.findIndex((a, i) => !excl.has(i) && a.caliberUm === cal);
  for (const r of remMains) {
    const refresh = byCaliber(r.caliberUm, used);
    if (refresh >= 0) {
      used.add(refresh);
      continue;
    }
    const tradeIndex = addMains.findIndex((a, i) => !used.has(i));
    if (tradeIndex < 0) {
      if (r.caliberUm > mainGunMaxUm)
        findings.push(
          gunFinding(
            "ARMAMENT_MAIN_GUN_UNCHANGEABLE",
            "A main gun above 6 inches cannot be removed.",
            [
              "A ",
              inchValue(r.caliberUm),
              " in main gun may only be refreshed with a modern gun of the same calibre.",
            ],
            "The main battery above 6 inches is fixed for the ship's life.",
            [
              ["refresh", "Fit a modern gun of the same calibre."],
              ["keep", "Keep the existing main guns."],
              ["new_build", "Build a new ship with the armament you want."],
            ],
            { caliberUm: r.caliberUm },
            mainGunMaxUm,
            r.caliberUm,
          ),
        );
      continue;
    }
    const a = addMains[tradeIndex]!;
    used.add(tradeIndex);
    const broadsideOk =
      a.barrels < r.barrels
        ? a.caliberUm * a.barrels <= r.caliberUm * r.barrels
        : a.caliberUm <= r.caliberUm;
    if (!broadsideOk)
      findings.push(
        gunFinding(
          "ARMAMENT_INCOMPATIBLE_CALIBRE",
          "The main-battery change is not a compatible swap.",
          [
            `${barrelsWord(r.barrels)} `,
            inchValue(r.caliberUm),
            ` in to ${barrelsWord(a.barrels)} `,
            inchValue(a.caliberUm),
            " in raises the weight of broadside beyond the guns replaced.",
          ],
          "A refit may trade barrel count against calibre only within a compatible limit.",
          [
            ["fewer_barrels", "Reduce the number of barrels further."],
            ["smaller_calibre", "Choose a smaller calibre."],
            ["keep", "Keep the existing main guns."],
          ],
          { removedBroadside: r.caliberUm * r.barrels, addedBroadside: a.caliberUm * a.barrels },
          r.caliberUm * r.barrels,
          a.caliberUm * a.barrels,
        ),
      );
  }
  return findings;
}

export type RefitKind =
  | "MAINTENANCE_REFIT"
  | "SENSOR_FC_UPDATE"
  | "AA_UPGRADE"
  | "MACHINERY_REFIT"
  | "REARMAMENT"
  | "ARMOUR_MODIFICATION"
  | "BULGE"
  | "AVIATION_CONVERSION"
  | "MAJOR_RECONSTRUCTION"
  | "ROLE_CONVERSION";

export type RefitProjectType = "REPAIR" | "EQUIPMENT_INSTALLATION" | "REBUILD" | "CONVERSION";

export interface RefitKindRule {
  readonly projectType: RefitProjectType;
  readonly allowedInterfaces: readonly PartInterface[];
  readonly minRemainingLifeMonths: number;
  readonly maxHullFatigueBp: number;
  readonly fatigueGainBp: number;
  readonly costMultiplierBp: number;
  readonly minMonths: number;
  readonly lifeExtensionMonths: number;
}

export interface RefitBalance {
  readonly rules: Readonly<Record<RefitKind, RefitKindRule>>;
  readonly removalCostBp: number;
  readonly holeGrowthBp: number;
  readonly uneconomicalBp: number;
  readonly uneconomicalHardBp: number;
  readonly costPerWorkMicro: number;
  readonly bulgeProtectionGainBp: number;
  readonly bulgeSpeedPenaltyBp: number;
}

export interface ShipState {
  readonly design: DesignDraft;
  readonly growthBudgetKg: number;
  readonly hullFatigueBp: number;
  readonly remainingServiceMonths: number;
  readonly refitCount: number;
}

export interface RefitPlan {
  readonly kind: RefitKind;
  readonly removeInstanceIds: readonly string[];
  readonly add: readonly PlacementSpec[];
  readonly armourSet?: readonly ArmourRegion[];
  readonly armourRemove?: readonly ArmourRegionId[];
  readonly bulge?: { readonly massKg: number };
}

export interface RefitEvaluation {
  readonly legal: boolean;
  readonly findings: readonly Finding[];
  readonly newDesign: DesignDraft;
  readonly before: CompiledDesign;
  readonly after: CompiledDesign;
  readonly netAddedKg: number;
  readonly costMicro: number;
  readonly replacementCostMicro: number;
  readonly costRatioBp: number;
  readonly monthsOutOfService: number;
  readonly projectType: RefitProjectType;
  readonly bulgeProtectionGainBp: number;
  readonly nextState: ShipState;
}

const f = (
  id: string,
  severity: Finding["severity"],
  what: string,
  why: string,
  consequence: string,
  remedies: [string, string][],
  threshold = 0,
  value = 1,
): Finding => ({
  id,
  severity,
  what,
  why,
  consequence,
  remedies: remedies.map(([rid, description]) => ({ id: rid, description })),
  evidence: { formulaId: "REFIT", inputs: {}, threshold, value },
});
const ARMOUR_GATE_IDS: ReadonlySet<string> = new Set([
  "ARMOUR_TECH_UNAVAILABLE",
  "ARMOUR_THICKNESS_UNAVAILABLE",
]);
const fmt = (n: number) => groupedInteger(n);

const LEGACY_INTERFACE_BY_CATEGORY: Readonly<Partial<Record<ComponentCategory, PartInterface>>> = {
  MAIN_GUN: "gun",
  SECONDARY_GUN: "gun",
  DUAL_PURPOSE_GUN: "gun",
  AA_WEAPON: "gun",
  MOUNT: "gun_mount",
  MAGAZINE: "magazine",
  DIRECTOR: "sensor",
  RANGEFINDER: "sensor",
  RADAR: "sensor",
  COMMS: "sensor",
  GENERATOR: "electrical_plant",
  ENGINE: "propulsion_plant",
  BOILER: "propulsion_plant",
  ARMOUR_SCHEME: "armour_material",
};

const COMPATIBILITY_INTERFACE_LIST: readonly PartInterface[] = COMPATIBILITY_INTERFACES;
function isCompatibilityInterface(value: PartInterface): value is CompatibilityInterface {
  return COMPATIBILITY_INTERFACE_LIST.includes(value);
}

function buildPartIndex(ctx: ShipContext): ReadonlyMap<string, FlattenedPart> {
  const model = ctx.partModel;
  if (model === undefined) return EMPTY_PART_INDEX;
  const parts = Object.values(model.partIndex.byId).sort((a, b) => compareCodePoints(a.id, b.id));
  const index = new Map<string, FlattenedPart>();
  const put = (key: string, part: FlattenedPart): void => {
    if (!index.has(key)) index.set(key, part);
  };
  for (const part of parts) put(part.id, part);
  for (const part of parts) {
    if (part.family !== "gun") continue;
    const family = part.spec.gunFamily;
    if (family === undefined) continue;
    const current = index.get(family);
    const currentIsFamilyGun =
      current !== undefined && current.family === "gun" && current.spec.gunFamily === family;
    if (current === undefined || (currentIsFamilyGun && part.id === standardGunPartId(family))) {
      index.set(family, part);
    }
  }
  for (const part of parts) {
    const prototype = part.origin.prototype?.id;
    if (prototype !== undefined) put(prototype, part);
  }
  return index;
}

const EMPTY_PART_INDEX: ReadonlyMap<string, FlattenedPart> = new Map();

export function evaluateRefit(
  ship: ShipState,
  plan: RefitPlan,
  ctx: ShipContext,
  balance: RefitBalance,
  costBalance: CostBalance,
  costCtx: CostContext,
  quayCapacityWorkPerMonth: number,
): RefitEvaluation {
  const rule = balance.rules[plan.kind];
  const findings: Finding[] = [];

  const bulgeMassKg =
    plan.bulge !== undefined && plan.kind === "BULGE"
      ? Math.max(0, Math.floor(plan.bulge.massKg))
      : 0;
  if (plan.kind === "BULGE" && plan.bulge === undefined)
    findings.push(
      f(
        "REFIT_BULGE_REQUIRED",
        "BLOCKING",
        "A bulge refit needs a blister.",
        "No bulge mass was given, so there is nothing to build.",
        "The plan cannot be carried out.",
        [
          ["add_bulge", "Specify the blister's added mass."],
          ["use_kind", "Choose a different refit kind."],
          ["drop", "Drop the bulge from the plan."],
        ],
      ),
    );
  if (plan.bulge !== undefined && plan.kind !== "BULGE")
    findings.push(
      f(
        "REFIT_BULGE_KIND_MISMATCH",
        "BLOCKING",
        `A bulge cannot be added in a ${plan.kind} refit.`,
        "Only a BULGE refit adds a torpedo blister.",
        "A refit of this kind cannot bulge the hull.",
        [
          ["use_kind", "Plan a BULGE refit instead."],
          ["drop", "Remove the bulge from the plan."],
          ["reconstruct", "Plan a major reconstruction instead."],
        ],
      ),
    );

  const existing = new Map(ship.design.placements.map((p) => [p.instanceId, p]));
  for (const id of plan.removeInstanceIds) {
    if (!existing.has(id))
      findings.push(
        f(
          "REFIT_UNKNOWN_TARGET",
          "BLOCKING",
          `Nothing to remove: ${id}.`,
          "The ship has no such fitting.",
          "The plan cannot be carried out.",
          [
            ["fix_plan", "Remove the entry from the plan."],
            ["pick_other", "Choose an installed fitting."],
            ["resurvey", "Re-survey the ship design."],
          ],
        ),
      );
  }
  for (const p of plan.add) {
    if (existing.has(p.instanceId) && !plan.removeInstanceIds.includes(p.instanceId)) {
      findings.push(
        f(
          "REFIT_DUPLICATE_INSTANCE",
          "BLOCKING",
          `${p.instanceId} already exists.`,
          "Added fittings need new ids.",
          "Ambiguous design.",
          [
            ["rename", "Rename the new fitting."],
            ["remove_old", "Remove the old one in the same refit."],
            ["drop", "Drop the addition."],
          ],
        ),
      );
    }
  }
  const touched: readonly PlacementSpec[] = [
    ...plan.removeInstanceIds
      .map((id) => existing.get(id))
      .filter((p): p is PlacementSpec => p !== undefined),
    ...plan.add,
  ];
  const partIndex = buildPartIndex(ctx);
  const interfaceOfComponent = (componentId: string): PartInterface | undefined => {
    const part = partIndex.get(componentId);
    if (part !== undefined) return part.provides;
    const category = ctx.catalogue.find((c) => c.id === componentId)?.category;
    return category === undefined ? undefined : LEGACY_INTERFACE_BY_CATEGORY[category];
  };
  for (const placement of touched) {
    const iface = interfaceOfComponent(placement.componentId);
    if (iface === undefined || !rule.allowedInterfaces.includes(iface)) {
      findings.push(
        f(
          "REFIT_KIND_MISMATCH",
          "BLOCKING",
          `${placement.componentId} is not part of a ${plan.kind} refit.`,
          `Interface ${iface ?? "unknown"} is outside this refit kind.`,
          "A refit of this kind cannot touch that equipment.",
          [
            ["use_kind", "Choose the refit kind that covers this equipment."],
            ["drop", "Remove it from the plan."],
            ["reconstruct", "Plan a major reconstruction instead."],
          ],
        ),
      );
    }
  }
  const partModel = ctx.partModel;
  if (partModel !== undefined) {
    const compatibility: CompatibilityModel = {
      slotTemplates: partModel.slotTemplates,
      platforms: partModel.platforms,
    };
    const slots = platformSlots(compatibility, ship.design.hull.hullFormId);
    if (slots !== null) {
      const slot = (iface: CompatibilityInterface, zoneId: PlacementSpec["zoneId"]) =>
        slots.find((s) => s.id === compatibilitySlotId(zoneId, iface));
      for (const placement of plan.add) {
        const part = partIndex.get(placement.componentId);
        if (part === undefined || !isCompatibilityInterface(part.provides)) continue;
        const target = slot(part.provides, placement.zoneId);
        if (target === undefined) {
          findings.push(
            f(
              "REFIT_SLOT_REJECTED",
              "BLOCKING",
              `${part.id} has no slot in ${placement.zoneId}.`,
              `Platform '${ship.design.hull.hullFormId}' has no slot '${compatibilitySlotId(placement.zoneId, part.provides)}'.`,
              "A refit may only swap a part for one a slot of the same hull accepts.",
              [
                ["pick_other", "Choose a part the hull can carry."],
                ["use_kind", "Choose the refit kind that covers this equipment."],
                ["reconstruct", "Plan a major reconstruction instead."],
              ],
            ),
          );
          continue;
        }
        if (!(target.accepts ?? []).includes(part.provides)) {
          findings.push(
            f(
              "REFIT_SLOT_REJECTED",
              "BLOCKING",
              `${part.id} does not fit ${target.id}.`,
              `Slot '${target.id}' accepts ${(target.accepts ?? []).join(", ") || "nothing"}, not '${part.provides}'.`,
              "A refit may only swap a part for one the same slot accepts, with its constraints met.",
              [
                ["pick_other", "Choose a part the slot accepts."],
                ["use_kind", "Choose the refit kind that covers this equipment."],
                ["reconstruct", "Plan a major reconstruction instead."],
              ],
            ),
          );
          continue;
        }
        const violated = evaluateConstraints({
          slot: target,
          subject: { part, spec: specAt(part, ctx.month) },
          mountCount: 1,
          parent: null,
          nestedGuns: [],
        }).find((o) => o.kind === "VIOLATED");
        if (violated !== undefined) {
          findings.push(
            f(
              "REFIT_SLOT_REJECTED",
              "BLOCKING",
              `${part.id} does not fit ${target.id}.`,
              `Part '${part.id}' violates constraint '${violated.constraint}' of slot '${target.id}'.`,
              "A refit may only swap a part for one the same slot accepts, with its constraints met.",
              [
                ["pick_other", "Choose a part the slot accepts."],
                ["use_kind", "Choose the refit kind that covers this equipment."],
                ["reconstruct", "Plan a major reconstruction instead."],
              ],
            ),
          );
        }
      }
    }
  }
  if (plan.kind === "REARMAMENT") {
    const gunChangeOf = (p: PlacementSpec): GunChange | null => {
      const def = ctx.catalogue.find((c) => c.id === p.componentId);
      if (def === undefined) return null;
      if (!["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN"].includes(def.category)) return null;
      const barrels = p.params?.["barrels"] ?? 1;
      const mountType = ctx.armamentContent?.gunFamilies.find(
        (f) => f.id === def.id,
      )?.defaultMountType;
      return {
        role: def.category === "MAIN_GUN" ? "MAIN" : "SECONDARY",
        caliberUm: Number(def.attributes?.["caliberUm"] ?? 0),
        barrels,
        casemate: mountType !== undefined ? mountType !== "TURRET" : barrels <= 1,
      };
    };
    const removedGuns = ship.design.placements
      .filter((p) => plan.removeInstanceIds.includes(p.instanceId))
      .map(gunChangeOf)
      .filter((g): g is GunChange => g !== null);
    const addedGuns = plan.add.map(gunChangeOf).filter((g): g is GunChange => g !== null);
    findings.push(...armamentChangeFindings(removedGuns, addedGuns));
  }
  const stripped = ship.design.placements.filter(
    (p) =>
      !plan.removeInstanceIds.includes(p.instanceId) &&
      !plan.removeInstanceIds.includes(p.magazineRef ?? ""),
  );
  const armourSet = plan.armourSet ?? [];
  const armourRemove = plan.armourRemove ?? [];
  if ((armourSet.length > 0 || armourRemove.length > 0) && plan.kind !== "ARMOUR_MODIFICATION") {
    findings.push(
      f(
        "REFIT_ARMOUR_KIND_MISMATCH",
        "BLOCKING",
        `Armour cannot be changed in a ${plan.kind} refit.`,
        "Only an armour modification may add, remove or alter armour regions.",
        "A refit of this kind cannot touch the armour.",
        [
          ["use_kind", "Plan an armour modification instead."],
          ["drop", "Remove the armour changes from the plan."],
          ["reconstruct", "Plan a major reconstruction instead."],
        ],
      ),
    );
  }
  findings.push(
    ...armourAvailabilityFindings(armourSet, ctx.balance.armour, ctx.month, ctx.unlockedTechs).map(
      (x) => ({ ...x, id: `REFIT_${x.id}` }),
    ),
  );
  const haveRegions = new Set(ship.design.armour.regions.map((r) => r.region));
  for (const region of armourRemove) {
    if (!haveRegions.has(region))
      findings.push(
        f(
          "REFIT_UNKNOWN_TARGET",
          "BLOCKING",
          `Nothing to remove: armour region ${region}.`,
          "The ship has no such armour region.",
          "The plan cannot be carried out.",
          [
            ["fix_plan", "Remove the entry from the plan."],
            ["pick_other", "Choose an armoured region."],
            ["resurvey", "Re-survey the ship design."],
          ],
        ),
      );
  }
  const replaced = new Map(armourSet.map((a) => [a.region, a]));
  const kept = ship.design.armour.regions
    .filter((r) => !armourRemove.includes(r.region))
    .map((r) => replaced.get(r.region) ?? r);
  const armourRegions = [
    ...kept,
    ...[...replaced.values()].filter((a) => !haveRegions.has(a.region)),
  ];
  const newDesign: DesignDraft = {
    ...ship.design,
    placements: [...stripped, ...plan.add],
    armour:
      armourSet.length > 0 || armourRemove.length > 0
        ? { ...ship.design.armour, regions: armourRegions }
        : ship.design.armour,
  };

  const before = compileDesign(ship.design, ctx);
  const shaped: DesignDraft =
    bulgeMassKg > 0
      ? {
          ...newDesign,
          hull: {
            ...newDesign.hull,
            targetDisplacementKg: kg(newDesign.hull.targetDisplacementKg + bulgeMassKg),
          },
        }
      : newDesign;
  const rawAfter = compileDesign(shaped, ctx);
  const netAddedKg =
    rawAfter.ledger.armament +
    rawAfter.ledger.ammunition +
    rawAfter.ledger.sensors +
    rawAfter.ledger.mission +
    rawAfter.ledger.auxiliary +
    rawAfter.ledger.machinery +
    rawAfter.ledger.crew +
    rawAfter.ledger.armour -
    (before.ledger.armament +
      before.ledger.ammunition +
      before.ledger.sensors +
      before.ledger.mission +
      before.ledger.auxiliary +
      before.ledger.machinery +
      before.ledger.crew +
      before.ledger.armour) +
    bulgeMassKg;
  const subtotalAfter = rawAfter.totalKg - rawAfter.ledger.margin - rawAfter.ledger.reserve;
  const marginBp =
    subtotalAfter <= 0 ? 0 : Math.ceil((before.ledger.margin * 10_000) / subtotalAfter);
  const reserveAfter = Math.max(0, before.ledger.reserve - Math.max(0, netAddedKg));
  const reserveBp = Math.ceil(
    (reserveAfter * 10_000) / Math.max(1, ship.design.hull.targetDisplacementKg),
  );
  const adjusted: DesignDraft = {
    ...shaped,
    hull: { ...shaped.hull, designMarginBp: bp(marginBp), growthReserveBp: bp(reserveBp) },
  };
  const after = compileDesign(adjusted, ctx);

  if (netAddedKg > ship.growthBudgetKg) {
    findings.push(
      f(
        "REFIT_GROWTH_EXCEEDED",
        "BLOCKING",
        "The hull cannot take this much extra weight.",
        `Net addition ${fmt(netAddedKg)} kg exceeds the remaining growth budget ${fmt(ship.growthBudgetKg)} kg.`,
        "The ship would sit too low and lose stability and structural margin.",
        [
          ["remove_equipment", "Remove older equipment of similar weight in the same refit."],
          ["lighter_option", "Choose lighter equipment."],
          ["scrap_replace", "Replace the ship instead."],
        ],
        ship.growthBudgetKg,
        netAddedKg,
      ),
    );
  }
  if (ship.hullFatigueBp > rule.maxHullFatigueBp) {
    findings.push(
      f(
        "HULL_WORN_OUT",
        "BLOCKING",
        "The hull is too worn for this refit.",
        `Hull fatigue ${ship.hullFatigueBp} bp exceeds ${rule.maxHullFatigueBp} bp.`,
        "Further work would shorten a hull that has little life left.",
        [
          ["cheaper_refit", "Limit the work to a maintenance refit."],
          ["role_conversion", "Convert to a harbour or training role."],
          ["scrap", "Scrap and replace."],
        ],
        rule.maxHullFatigueBp,
        ship.hullFatigueBp,
      ),
    );
  }
  if (ship.remainingServiceMonths < rule.minRemainingLifeMonths) {
    findings.push(
      f(
        "REFIT_SERVICE_LIFE_TOO_SHORT",
        "BLOCKING",
        "Too little service life remains to justify this refit.",
        `${ship.remainingServiceMonths} months left; ${plan.kind} needs ${rule.minRemainingLifeMonths}.`,
        "The investment would not be recovered.",
        [
          ["lesser_refit", "Do a lighter refit."],
          ["extend_life", "Do a maintenance refit first to extend life."],
          ["retire", "Retire the ship."],
        ],
        rule.minRemainingLifeMonths,
        ship.remainingServiceMonths,
      ),
    );
  }

  const baseline = new Set(before.findings.map((x) => `${x.severity}:${x.id}`));
  for (const x of after.findings) {
    if (
      (x.severity === "BLOCKING" || x.severity === "CRITICAL") &&
      !baseline.has(`${x.severity}:${x.id}`) &&
      !ARMOUR_GATE_IDS.has(x.id)
    ) {
      findings.push({
        ...x,
        id: `REFIT_${x.id}`,
        what:
          typeof x.what === "string"
            ? `Refit would cause: ${x.what}`
            : ["Refit would cause: ", ...x.what],
      });
    }
  }

  const costOf = (d: DesignDraft, c: CompiledDesign) => computeCost(c, d, costBalance, costCtx);
  const oldCost = costOf(ship.design, before).total;
  const newCost = costOf(adjusted, after).total;
  const addedCost = Math.max(0, newCost - oldCost);
  const removedFitted = before.components
    .filter((k) => plan.removeInstanceIds.includes(k.instanceId))
    .reduce((a, k) => a + k.costMicro, 0);
  const base = addedCost + Math.floor((removedFitted * balance.removalCostBp) / 10_000);
  const costMicro = Math.floor((base * rule.costMultiplierBp) / 10_000);
  const replacementCostMicro = newCost;
  const costRatioBp =
    replacementCostMicro <= 0 ? 0 : Math.floor((costMicro * 10_000) / replacementCostMicro);
  if (costRatioBp >= balance.uneconomicalHardBp) {
    findings.push(
      f(
        "REFIT_UNECONOMICAL_HARD",
        "BLOCKING",
        "This refit costs nearly as much as a new ship.",
        `Refit ${fmt(costMicro)} vs replacement ${fmt(replacementCostMicro)} (${costRatioBp} bp).`,
        "Money is better spent on a modern hull.",
        [
          ["smaller_scope", "Reduce the scope of the refit."],
          ["new_build", "Order a replacement."],
          ["retire", "Retire the ship."],
        ],
        balance.uneconomicalHardBp,
        costRatioBp,
      ),
    );
  } else if (costRatioBp >= balance.uneconomicalBp) {
    findings.push(
      f(
        "REFIT_UNECONOMICAL",
        "WARNING",
        "This refit is poor value against replacement.",
        `${costRatioBp} bp of replacement cost.`,
        "You pay most of a new ship for an old hull.",
        [
          ["smaller_scope", "Reduce the scope."],
          ["new_build", "Order a replacement."],
        ],
        balance.uneconomicalBp,
        costRatioBp,
      ),
    );
  }
  const monthsOutOfService = Math.max(
    rule.minMonths,
    Math.ceil(
      costMicro / Math.max(1, balance.costPerWorkMicro) / Math.max(1, quayCapacityWorkPerMonth),
    ),
  );

  const removedKg = before.components
    .filter((k) => plan.removeInstanceIds.includes(k.instanceId))
    .reduce((a, k) => a + k.weightKg, 0);
  const legal = !findings.some((x) => x.severity === "BLOCKING" || x.severity === "CRITICAL");
  const nextState: ShipState = legal
    ? {
        design: adjusted,
        growthBudgetKg: Math.max(
          0,
          ship.growthBudgetKg -
            Math.max(0, netAddedKg) -
            Math.floor((removedKg * balance.holeGrowthBp) / 10_000),
        ),
        hullFatigueBp: ship.hullFatigueBp + rule.fatigueGainBp,
        remainingServiceMonths: ship.remainingServiceMonths + rule.lifeExtensionMonths,
        refitCount: ship.refitCount + 1,
      }
    : ship;
  return {
    legal,
    findings: sortFindings(findings),
    newDesign: adjusted,
    before,
    after,
    netAddedKg,
    costMicro,
    replacementCostMicro,
    costRatioBp,
    monthsOutOfService,
    projectType: rule.projectType,
    bulgeProtectionGainBp:
      plan.kind === "BULGE" && plan.bulge !== undefined ? balance.bulgeProtectionGainBp : 0,
    nextState,
  };
}
