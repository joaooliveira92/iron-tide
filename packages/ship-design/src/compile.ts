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

/** Facts the caller resolves from parts instead of the shared balance. */
export interface CompileResolvedOptions {
  /** The balance to compile against; defaults to the context's. */
  readonly balance?: ShipBalance;
}

/**
 * Resolve a legacy draft and compile it. The legacy path resolves each placement from its
 * `ComponentDef`; the production path resolves parts first and calls `compileResolved` directly.
 */
export function compileDesign(draft: DesignDraft, ctx: ShipContext): CompiledDesign {
  const findings: Finding[] = [];
  if (ctx.hullForms[draft.hull.hullFormId] === undefined)
    throw new Error(`unknown hull form '${draft.hull.hullFormId}'`);
  const plant = ctx.plants.find((p) => p.id === draft.machinery.plantId);
  if (!plant) throw new Error(`unknown plant '${draft.machinery.plantId}'`);
  const catalogue = new Map(ctx.catalogue.map((c) => [c.id, c]));

  // 1. Technology availability and parameter validity (stage VALIDATE_TECHNOLOGY)
  const resolved = resolveDesignComponents(draft, ctx, catalogue, plant, findings);
  return compileResolved(draft, plant, resolved, ctx, findings);
}

/**
 * Compile an already-resolved design: the intent, its plant, and every placement's resolved
 * part facts. Findings accumulate into `findings`; corruption in the context throws.
 */
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

  const byId = new Map(resolved.map((r) => [r.spec.instanceId, r]));
  const hull = intent.hull;

  // 2-3. Weapons, then machinery/systems.
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

  // 4-5. Armour + hull + displacement ledger.
  const { hullRes, armour } = compileStructure({
    draft: intent,
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
    draft: intent,
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
    draft: intent,
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
  // A type that is not available has no window by definition and is rejected by a finding below, not by a throw. An
  // available type without one is a content error.
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

  // 7b. Ship-type availability, then intended classification (DESIGN-22 section 5). A type the ruleset does not
  // register, or does not yet allow, is a blocking finding here: this is the authoritative gate (ADR-0088), so a
  // stale UI, an imported file or a hand-built command cannot reach construction with a locked type.
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

  // 8. Dock, treaty, modernization
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
    valid: !hasBlocking(sorted),
  };
  return { ...body, hash: sha256Hex(canonicalSerialize(withoutSubjects(body))) };
}
