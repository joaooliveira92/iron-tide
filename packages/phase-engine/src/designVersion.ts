import type { CompiledDesignVersion } from "@bluewave/campaign";
import type { CompiledTorpedo } from "@bluewave/armament";
import { SafeInt } from "@bluewave/contracts";
import {
  compileTorpedo,
  computeCost,
  constructionOrderPlan,
  toEngineDesign,
  treasuryCostUnits,
  type CompiledDesign,
  type DesignDraft,
  type ConstructionBalance,
  type CostBalance,
  type CostContext,
  type EngineAdapterOptions,
  type ShipBuildingContent,
  type Yard,
} from "@bluewave/ship-design";

/** What the cost model needs to price a design in treasury units. */
export interface DesignPricing {
  readonly costBalance: CostBalance;
  readonly costCtx: CostContext;
  readonly treasuryUnitMicro: number;
  /** Inputs for the construction plan an order carries (ADR-0077); without them a design version has no plan. */
  readonly construction?: {
    readonly balance: ConstructionBalance;
    readonly yards: readonly Yard[];
    readonly industryBp?: number | undefined;
    /** Keel-laying month for the era multiplier on build time (ADR-0080). */
    readonly month?: string | undefined;
  };
  /**
   * Resolves a torpedo mount's neutral compiled torpedo from the pack's part model (ticket 13b).
   * Present when the pack carries the ship-building parts; absent for a parts-less pack (combat then
   * fails closed rather than defaulting). `buildDesignVersion` fills every torpedo mount the legacy
   * compile path left without a `compiledTorpedo`, so a player- or AI-built design reaches
   * auto-resolution the same way an authored design does.
   */
  readonly torpedoOf?: (torpedoModelId: string) => CompiledTorpedo | undefined;
}

/** Pricing inputs for a month from the ship-building content: the same cost model the Drawing Board forecast uses. */
export function pricingFor(content: ShipBuildingContent, month: string): DesignPricing {
  const env = content.environmentFor(month);
  const byId = content.partModel?.partIndex.byId;
  // A fresh record per call: the snapshot clone treats a shared reference as a cycle, and each
  // mount must own its value. Compiles at the model's effective (latest) revision (`9999-12`).
  const torpedoOf =
    byId === undefined
      ? undefined
      : (torpedoModelId: string): CompiledTorpedo | undefined => {
          const part = byId[torpedoModelId];
          const compiled =
            part !== undefined && part.family === "torpedo"
              ? compileTorpedo(part, "9999-12")
              : undefined;
          return compiled !== undefined && compiled.ok ? compiled.value : undefined;
        };
  return {
    costBalance: env.costBalance,
    costCtx: env.costCtx,
    treasuryUnitMicro: content.treasuryUnitMicro,
    construction: {
      balance: env.constructionBalance,
      yards: env.yards,
      industryBp: env.industryBp,
      month,
    },
    ...(torpedoOf === undefined ? {} : { torpedoOf }),
  };
}

/**
 * Projects a compiled, valid design into the engine's immutable `CompiledDesignVersion` (ADR-0066) and keeps the
 * draft it came from (ADR-0070) so the design can later be revised. Shared by SubmitDesign and ReviseProject.
 */
export function buildDesignVersion(
  compiled: CompiledDesign,
  draft: DesignDraft,
  options: EngineAdapterOptions,
  pricing: DesignPricing,
): CompiledDesignVersion {
  const e = toEngineDesign(compiled, draft, options);
  const cost = computeCost(compiled, draft, pricing.costBalance, pricing.costCtx);
  const units = treasuryCostUnits(cost.total, pricing.treasuryUnitMicro);
  const orderPlan = pricing.construction
    ? constructionOrderPlan(
        {
          compiled,
          draft,
          cost,
          balance: pricing.construction.balance,
          yards: pricing.construction.yards,
          industryBp: pricing.construction.industryBp,
          month: pricing.construction.month,
          accelerated: pricing.costCtx.accelerated,
        },
        units,
      )
    : null;
  return {
    designVersionId: e.designVersionId,
    designFamilyId: e.designFamilyId,
    className: e.className,
    nationId: e.nationId,
    hullType: e.hullType,
    normalizedDisplacementKg: SafeInt(e.normalizedDisplacementKg),
    normalizedSpeedUms: SafeInt(e.normalizedSpeedUms),
    normalizedArmorUm: SafeInt(e.normalizedArmorUm),
    hitPoints: SafeInt(e.hitPoints),
    mainGunsCaliber: SafeInt(e.mainGunsCaliber),
    mainGunsCount: SafeInt(e.mainGunsCount),
    machineryType: e.machineryType,
    crewComplement: SafeInt(e.crewComplement),
    contentVersion: e.contentVersion,
    compiledHash: e.compiledHash,
    // A copy: the snapshot must not alias the command body (plain JSON, so structuredClone is exact).
    constructionCostUnits: SafeInt(units),
    ...(orderPlan
      ? {
          constructionPlan: {
            yardId: orderPlan.yardId,
            packages: orderPlan.packages.map((p) => ({
              id: p.id,
              kind: p.kind,
              line: p.line,
              totalWork: SafeInt(p.totalWork),
              dependsOn: [...p.dependsOn],
            })),
            capacityUnits: Object.fromEntries(
              Object.entries(orderPlan.capacityUnits).map(([line, v]) => [line, SafeInt(v)]),
            ),
          },
        }
      : {}),
    sourceDraft: structuredClone(draft) as unknown as Readonly<Record<string, unknown>>,
    // A copy: the immutable armament snapshot must not alias the command body (plain JSON).
    ...(e.armament ? { armament: structuredClone(e.armament) } : {}),
    ...(e.torpedoArmament
      ? {
          torpedoArmament: e.torpedoArmament.map((m) => {
            // The parts read path already resolved the neutral contract; the legacy compile path
            // leaves it absent, so resolve it here from the pack's part model (ticket 13b). This
            // keeps a player- or AI-built design resolvable by combat exactly like an authored one.
            const resolved = m.compiledTorpedo ?? pricing.torpedoOf?.(m.torpedoModelId);
            return {
              mountType: m.mountType,
              tubeCount: SafeInt(m.tubeCount),
              torpedoModelId: m.torpedoModelId,
              // A copy: the immutable compiled-torpedo snapshot must not alias the command body.
              ...(resolved ? { compiledTorpedo: structuredClone(resolved) } : {}),
            };
          }),
        }
      : {}),
  };
}
