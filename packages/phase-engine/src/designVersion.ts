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

export interface DesignPricing {
  readonly costBalance: CostBalance;
  readonly costCtx: CostContext;
  readonly treasuryUnitMicro: number;
  readonly construction?: {
    readonly balance: ConstructionBalance;
    readonly yards: readonly Yard[];
    readonly industryBp?: number | undefined;
    readonly month?: string | undefined;
  };
  readonly torpedoOf?: (torpedoModelId: string) => CompiledTorpedo | undefined;
}

export function pricingFor(content: ShipBuildingContent, month: string): DesignPricing {
  const env = content.environmentFor(month);
  const byId = content.partModel?.partIndex.byId;
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
    ...(e.capabilities === undefined ? {} : { capabilities: [...e.capabilities] }),
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
    ...(draft.colonialServiceFitted === true ? { colonialServiceFitted: true as const } : {}),
    ...(e.armament ? { armament: structuredClone(e.armament) } : {}),
    ...(e.torpedoArmament
      ? {
          torpedoArmament: e.torpedoArmament.map((m) => {
            const resolved = m.compiledTorpedo ?? pricing.torpedoOf?.(m.torpedoModelId);
            return {
              mountType: m.mountType,
              tubeCount: SafeInt(m.tubeCount),
              torpedoModelId: m.torpedoModelId,
              ...(resolved ? { compiledTorpedo: structuredClone(resolved) } : {}),
            };
          }),
        }
      : {}),
  };
}
