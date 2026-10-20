// Full design-compile pipeline (DESIGN-22). Never throws on design errors: they
// become findings. Throws only on corrupt context.
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
import {
  num,
  type CompiledDesign,
  type ComponentSummary,
  type DesignDraft,
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
  HullFormData,
  Facility,
  TreatyLimits,
  ShipBalance,
  ShipContext,
  CompiledDesign,
  ComponentSummary,
} from "./compileShared.js";

export function compileDesign(draft: DesignDraft, ctx: ShipContext): CompiledDesign {
  const b = ctx.balance;
  const findings: Finding[] = [];
  const formData = ctx.hullForms[draft.hull.hullFormId];
  if (!formData) throw new Error(`unknown hull form '${draft.hull.hullFormId}'`);
  const plant = ctx.plants.find((p) => p.id === draft.machinery.plantId);
  if (!plant) throw new Error(`unknown plant '${draft.machinery.plantId}'`);
  const catalogue = new Map(ctx.catalogue.map((c) => [c.id, c]));
  const intended = draft.requirement.category;
  // The compiled ship-type registry when the context carries content (ADR-0156, ticket 12b); absent
  // falls back to the code registry inside each consumer. Classification outcomes are identical
  // because the 12a regression pins the content records to the code values.
  const shipTypes =
    ctx.shipTypes === undefined ? undefined : shipTypeRegistryFromRecords(ctx.shipTypes);
  // Whether the type may be designed at all is decided first: a locked or unknown type is a finding, never a throw.
  const availability = evaluateShipTypeAvailability(intended, {
    month: ctx.month,
    unlockedTechs: ctx.unlockedTechs,
    capabilities: ctx.capabilities,
    restrictedTypes: ctx.restrictedShipTypes,
    ...(shipTypes === undefined ? {} : { definitions: shipTypes.byId }),
  });

  // 1. Technology availability and parameter validity (stage VALIDATE_TECHNOLOGY)
  const resolved = resolveDesignComponents(draft, ctx, catalogue, plant, findings);
  const byId = new Map(resolved.map((r) => [r.spec.instanceId, r]));
  const hull = draft.hull;

  // 2-3. Weapons, then machinery/systems.
  const { weapons, ammoById, gunRes, armaments } = compileWeaponSet({
    draft,
    ctx,
    resolved,
    byId,
    b,
    findings,
  });
  const { systems, machineryRaw } = compileSystemsAndMachinery({
    draft,
    ctx,
    resolved,
    gunRes,
    plant,
    b,
    findings,
  });

  // 4-5. Armour + hull + displacement ledger.
  const { hullRes, armour } = compileStructure({
    draft,
    ctx,
    resolved,
    plant,
    formData,
    b,
    weapons,
    systems,
    machineryRaw,
    findings,
  });

  // 6. Arrangement
  const { arrangement, rooms, roomPart } = buildPlacementsAndArrangement({
    draft,
    resolved,
    plant,
    machineryRaw,
    formData,
    b,
    findings,
    ammoById,
  });

  // 7. Stability: every ledger kilogram becomes a weight lump
  const lumps = buildStabilityLumps({
    draft,
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
  const window = b.stabilityWindowByCategory[draft.requirement.category];
  // A type that is not available has no window by definition and is rejected by a finding below, not by a throw. An
  // available type without one is a content error.
  if (!window && availability.available)
    throw new Error(`no stability window for category '${draft.requirement.category}'`);
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
    componentId: r.def.id,
    category: r.def.category,
    weightKg: r.weightKg,
    costMicro: r.costMicro,
    maintenanceMonthlyBp: r.def.maintenanceMonthlyBp ?? 0,
    buildWorkMicro:
      r.def.buildWorkMicro === undefined
        ? null
        : num(r.def.buildWorkMicro, { ...r.def.constants, ...r.params }),
    productionLine: r.def.productionLine ?? null,
    requires: r.def.requires,
    params: r.params,
    attr: r.attr,
    torpedoMount: r.def.torpedoMount ?? null,
    ...(armaments.has(r.spec.instanceId) ? { armament: armaments.get(r.spec.instanceId)! } : {}),
  }));

  // 7b. Ship-type availability, then intended classification (DESIGN-22 section 5). A type the ruleset does not
  // register, or does not yet allow, is a blocking finding here: this is the authoritative gate (ADR-0088), so a
  // stale UI, an imported file or a hand-built command cannot reach construction with a locked type.
  let naturalClassId: string | null = null;
  const rules = b.classification ?? DESIGN_22_EARLY;
  const facts = classFacts(
    { totalKg: hullRes.totalKg, machinery: machineryRaw, components },
    draft,
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
            accommodation: draft.requirement.accommodationStandard,
            campaignAllows: ctx.colonialServiceAllowed ?? true,
          }),
        ),
      );
  }

  const colonialService = colonialFitting(draft, ctx);
  findings.push(...colonialFittingFindings(colonialService));
  const aluminium = aluminiumFitting(draft, ctx.balance.aluminiumSuperstructure, ctx.month);
  findings.push(...aluminiumFindings(aluminium));

  // 8. Dock, treaty, modernization
  const total = hullRes.totalKg;
  collectDockTreatyModernizationFindings({
    draft,
    ctx,
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
    draft.requirement.protectionGoal === "NONE"
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
    valid: !hasBlocking(sorted),
  };
  return { ...body, hash: sha256Hex(canonicalSerialize(withoutSubjects(body))) };
}
