import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  classFacts,
  classificationFindings,
  DESIGN_22_EARLY,
  isClassifiedShipType,
  naturalClass,
  typeAdvisories,
} from "./classification.js";
import { availabilityFindings, evaluateShipTypeAvailability } from "./shipTypeAvailability.js";
import { shipTypeRegistryFromRecords } from "./shipTypeRegistry.js";
import { aluminiumFitting, aluminiumFindings } from "./aluminium.js";
import { antiAircraftFindings, antiAircraftResult, expandAntiAircraft } from "./antiAircraft.js";
import {
  colonialFitting,
  colonialFittingFindings,
  colonialServiceAdvisory,
  colonialServiceEligibility,
} from "./colonialService.js";
import type { Finding } from "./findings.js";
import { hasBlocking, sortFindings, withoutSubjects } from "./findings.js";
import { withRuleSubject } from "./findingSubjects.js";
import { compileStability, type StabilityResult } from "./stability.js";
import type { PropulsionPlant } from "./machinery.js";
import {
  type CompiledDesign,
  type ComponentSummary,
  type DesignDraft,
  type DesignIntent,
  type Resolved,
  type ShipBalance,
  type ShipContext,
} from "./compileShared.js";
import {
  buildPlacementsAndArrangement,
  compileStructure,
  compileSystemsAndMachinery,
  compileWeaponSet,
  resolveDesignComponents,
} from "./compileStages.js";
import { buildStabilityLumps, collectDockTreatyModernizationFindings } from "./compileRules.js";

export type {
  PlacementSpec,
  MachineryPlan,
  DesignRequirement,
  DesignDraft,
  DesignIntent,
  HullFormData,
  Facility,
  TreatyLimits,
  ShipBalance,
  ShipContext,
  CompiledDesign,
  ComponentSummary,
  Resolved,
  ResolvedTorpedoMount,
} from "./compileShared.js";

export interface CompileResolvedOptions {
  readonly balance?: ShipBalance;
}

export function compileDesign(draft: DesignDraft, ctx: ShipContext): CompiledDesign {
  const findings: Finding[] = [];
  if (ctx.hullForms[draft.hull.hullFormId] === undefined)
    throw new Error(`unknown hull form '${draft.hull.hullFormId}'`);
  const plant = ctx.plants.find((p) => p.id === draft.machinery.plantId);
  if (!plant) throw new Error(`unknown plant '${draft.machinery.plantId}'`);
  const catalogue = new Map(ctx.catalogue.map((c) => [c.id, c]));

  const resolved = resolveDesignComponents(draft, ctx, catalogue, plant, findings);
  return compileResolved(draft, plant, resolved, ctx, findings);
}

export function compileResolved(
  intent: DesignIntent,
  plant: PropulsionPlant,
  resolved: readonly Resolved[],
  ctx: ShipContext,
  findings: Finding[],
  options: CompileResolvedOptions = {},
): CompiledDesign {
  const b = options.balance ?? ctx.balance;
  const formData = ctx.hullForms[intent.hull.hullFormId];
  if (!formData) throw new Error(`unknown hull form '${intent.hull.hullFormId}'`);
  const intended = intent.requirement.category;
  const shipTypes =
    ctx.shipTypes === undefined ? undefined : shipTypeRegistryFromRecords(ctx.shipTypes);
  const availability = evaluateShipTypeAvailability(intended, {
    month: ctx.month,
    unlockedTechs: ctx.unlockedTechs,
    capabilities: ctx.capabilities,
    restrictedTypes: ctx.restrictedShipTypes,
    ...(shipTypes === undefined ? {} : { definitions: shipTypes.byId }),
  });

  const byId = new Map(resolved.map((r) => [r.spec.instanceId, r]));
  const hull = intent.hull;

  const { weapons, ammoById, gunRes, armaments } = compileWeaponSet({
    draft: intent,
    ctx,
    resolved,
    byId,
    b,
    findings,
  });
  const { systems, machineryRaw } = compileSystemsAndMachinery({
    draft: intent,
    ctx,
    resolved,
    gunRes,
    plant,
    b,
    findings,
  });

  const aa = expandAntiAircraft(intent.antiAircraft, b.antiAircraft, ctx.month);

  const { hullRes, armour } = compileStructure({
    draft: intent,
    ctx,
    aa,
    resolved,
    plant,
    formData,
    b,
    weapons,
    systems,
    machineryRaw,
    findings,
  });

  const { arrangement, rooms, roomPart } = buildPlacementsAndArrangement({
    draft: intent,
    aa,
    resolved,
    plant,
    machineryRaw,
    formData,
    b,
    findings,
    ammoById,
  });

  const lumps = buildStabilityLumps({
    draft: intent,
    aa,
    resolved,
    hull,
    formData,
    b,
    hullRes,
    machineryRaw,
    ammoById,
    byId,
    rooms,
    roomPart,
    armour,
  });
  const window = b.stabilityWindowByCategory[intent.requirement.category];
  if (!window && availability.available)
    throw new Error(`no stability window for category '${intent.requirement.category}'`);
  let stability: StabilityResult | null = null;
  if (window && !hasBlocking(hullRes.findings) && lumps.reduce((a, l) => a + l.kg, 0) > 0) {
    stability = compileStability(
      {
        items: lumps,
        lengthMm: hull.lengthWl,
        beamMm: hull.beam,
        draughtMm: hull.draught,
        depthMm: hull.depthToMainDeck,
        blockCoeffBp: hull.blockCoeffBp,
        lcbPermille: formData.lcbPermille,
        buoyancyByZoneBp: formData.buoyancyByZoneBp,
        hullWeightKg: hullRes.ledger.hull,
        window,
      },
      formData.zones,
      b.stability,
    );
    findings.push(...stability.findings);
  }

  const components: ComponentSummary[] = resolved.map((r) => ({
    instanceId: r.spec.instanceId,
    componentId: r.componentId,
    category: r.category,
    weightKg: r.weightKg,
    costMicro: r.costMicro,
    maintenanceMonthlyBp: r.maintenanceMonthlyBp,
    buildWorkMicro: r.buildWorkMicro,
    productionLine: r.productionLine,
    requires: r.requires,
    params: r.params,
    attr: r.attr,
    torpedoMount: r.torpedoMount,
    ...(armaments.has(r.spec.instanceId) ? { armament: armaments.get(r.spec.instanceId)! } : {}),
  }));

  let naturalClassId: string | null = null;
  const rules = b.classification ?? DESIGN_22_EARLY;
  const facts = classFacts(
    { totalKg: hullRes.totalKg, machinery: machineryRaw, components },
    intent,
    rules,
    formData.traits?.includes("merchant_derived") ?? false,
  );
  if (!availability.available) {
    findings.push(...availabilityFindings(availability));
    naturalClassId = naturalClass(facts, rules, shipTypes?.classified);
  } else if (isClassifiedShipType(intended)) {
    const cls = classificationFindings(facts, intended, rules, shipTypes?.classified);
    naturalClassId = cls.natural;
    findings.push(...cls.findings);
    if (cls.findings.length === 0) findings.push(...typeAdvisories(intended, facts));
    if (intended === "KE" && cls.findings.length === 0)
      findings.push(
        ...colonialServiceAdvisory(
          colonialServiceEligibility({
            displacementKg: hullRes.totalKg,
            cruiseRangeNm: machineryRaw?.rangeNmAtCruise ?? 0,
            accommodation: intent.requirement.accommodationStandard,
            campaignAllows: ctx.colonialServiceAllowed ?? true,
          }),
        ),
      );
  }

  const colonialService = colonialFitting(intent, ctx);
  findings.push(...colonialFittingFindings(colonialService));
  const aluminium = aluminiumFitting(intent, ctx.balance.aluminiumSuperstructure, ctx.month);
  findings.push(...aluminiumFindings(aluminium));
  const antiAircraft = antiAircraftResult(intent.antiAircraft, b.antiAircraft, ctx.month);
  findings.push(...antiAircraftFindings(antiAircraft));

  const total = hullRes.totalKg;
  collectDockTreatyModernizationFindings({
    draft: intent,
    ctx,
    b,
    resolved,
    total,
    reserveKg: hullRes.ledger.reserve,
    findings,
  });

  const protectionIds = new Set([
    "MAGAZINE_UNPROTECTED",
    "ARMOUR_INEFFECTIVE_VS_ADVERSARY",
    "CITADEL_INCOMPLETE",
  ]);
  const adjusted =
    intent.requirement.protectionGoal === "NONE"
      ? findings.map((x) => (protectionIds.has(x.id) ? { ...x, severity: "ADVISORY" as const } : x))
      : findings;
  const sorted = sortFindings(adjusted.map(withRuleSubject));
  const costMicro = resolved.reduce((a, r) => a + r.costMicro, 0);
  const body = {
    ledger: hullRes.ledger,
    totalKg: total,
    hull: hullRes,
    machinery: machineryRaw,
    arrangement,
    weapons,
    armour,
    stability,
    systems,
    naturalClass: naturalClassId,
    componentCostMicro: costMicro,
    components,
    findings: sorted,
    ...(colonialService === null ? {} : { colonialService }),
    ...(aluminium === null ? {} : { aluminium }),
    ...(antiAircraft === null ? {} : { antiAircraft }),
    valid: !hasBlocking(sorted),
  };
  return { ...body, hash: sha256Hex(canonicalSerialize(withoutSubjects(body))) };
}
