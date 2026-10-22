import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  ConstructionPlanRecord,
  ConstructionProject,
  NationState,
} from "@bluewave/campaign";
import {
  constructionBatchProjectIdForCommand,
  constructionProjectIdForCommand,
  projectedConstructionOrderCosts,
  type ConstructionOrderCosts,
} from "@bluewave/campaign-engine";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  allocateShipNames,
  resolveNationalConstruction,
  shipTypeForHullType,
  type ShipBuildingContent,
  type ShipNameAllocation,
} from "@bluewave/ship-design";
import { constructionOrderEligibility } from "./orderEligibility.js";
import { builderDockRecord } from "./foreignConstruction.js";

function packagesFor(
  plan: ConstructionPlanRecord | undefined,
  projectedCost: number,
): Pick<ConstructionProject, "packages" | "yardId"> {
  if (plan === undefined) return {};
  const total = plan.packages.reduce((sum, p) => sum + Number(p.totalWork), 0);
  if (total !== projectedCost) return {};
  return {
    packages: plan.packages.map((p) => ({
      id: p.id,
      kind: p.kind,
      line: p.line,
      totalWork: p.totalWork,
      doneWork: SafeInt.ZERO,
      dependsOn: [...p.dependsOn],
    })),
    yardId: plan.yardId,
  };
}

export function constructionProjectFor(
  commandId: string,
  designId: string,
  projectedCost: number,
  month: { month: number; year: number },
  plan?: ConstructionPlanRecord,
  national?: { profileId: string; costMultiplierBp: number; buildTimeMultiplierBp: number },
): ConstructionProject {
  return {
    id: constructionProjectIdForCommand(commandId),
    type: "ship",
    projectType: "NEW_CONSTRUCTION",
    targetId: designId,
    designVersionId: designId,
    totalWork: SafeInt(projectedCost),
    completedWork: SafeInt.ZERO,
    paidWork: SafeInt.ZERO,
    status: "PLANNED",
    startedAt: `${String(month.year)}-${String(month.month).padStart(2, "0")}`,
    ...packagesFor(plan, projectedCost),
    ...(national !== undefined
      ? {
          nationalProfileId: national.profileId,
          costMultiplierBp: national.costMultiplierBp,
          buildTimeMultiplierBp: national.buildTimeMultiplierBp,
        }
      : {}),
  };
}

type OrderTargetResolution =
  | { readonly ok: true; readonly nation: NationState; readonly design: CompiledDesignVersion }
  | { readonly ok: false; readonly reason: string; readonly diagnostics: readonly string[] };

export function resolveOrderTargets(
  snapshot: CampaignSnapshot,
  nationId: string,
  designVersionId: string,
): OrderTargetResolution {
  const nation = snapshot["nations"].get(nationId);
  if (!nation)
    return { ok: false, reason: "NATION_NOT_FOUND", diagnostics: [`Nation ${nationId} not found`] };
  const design = snapshot["designs"].get(designVersionId);
  if (!design)
    return {
      ok: false,
      reason: "UNKNOWN_DESIGN",
      diagnostics: [`No design ${designVersionId} in the compiled snapshot`],
    };
  if (design["nationId"] !== nationId)
    return {
      ok: false,
      reason: "DESIGN_NOT_FOR_PLAYER",
      diagnostics: [
        `Design ${designVersionId} belongs to ${design["nationId"]}, not player slot ${nationId}`,
      ],
    };
  return { ok: true, nation, design };
}

interface ResolvedOrderCosts {
  readonly costs: ConstructionOrderCosts;
  readonly national:
    | {
        readonly profileId: string;
        readonly costMultiplierBp: number;
        readonly buildTimeMultiplierBp: number;
      }
    | undefined;
}

function resolveOrderCosts(
  content: ShipBuildingContent | undefined,
  nationId: string,
  design: CompiledDesignVersion,
  monthId: string,
): ResolvedOrderCosts | null {
  const profile = content?.navalProfileFor(nationId, monthId) ?? null;
  if (profile === null)
    return { costs: projectedConstructionOrderCosts(design), national: undefined };
  let modifiers;
  try {
    modifiers = resolveNationalConstruction(profile, monthId);
  } catch {
    return null;
  }
  return {
    costs: projectedConstructionOrderCosts(design, modifiers.costMultiplierBp),
    national: {
      profileId: profile.nationId,
      costMultiplierBp: modifiers.costMultiplierBp,
      buildTimeMultiplierBp: modifiers.buildTimeMultiplierBp,
    },
  };
}

export interface ConstructionOrderRequest {
  readonly nationId: string;
  readonly commandId: string;
  readonly designVersionId: string;
  readonly month: { readonly month: number; readonly year: number };
  readonly replacingCommandId?: string;
}

export type ConstructionOrderResult =
  | {
      readonly ok: true;
      readonly snapshot: CampaignSnapshot;
      readonly project: ConstructionProject;
      readonly design: CompiledDesignVersion;
      readonly costs: ConstructionOrderCosts;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly diagnostics: readonly string[];
    };

export function placeConstructionOrder(
  snapshot: CampaignSnapshot,
  request: ConstructionOrderRequest,
  content: ShipBuildingContent | undefined,
): ConstructionOrderResult {
  const targets = resolveOrderTargets(snapshot, request.nationId, request.designVersionId);
  if (!targets.ok) return { ok: false, reason: targets.reason, diagnostics: targets.diagnostics };
  const { nation, design } = targets;
  const replacingProjectId =
    request.replacingCommandId === undefined
      ? undefined
      : constructionProjectIdForCommand(request.replacingCommandId);
  const monthId = `${String(request.month.year)}-${String(request.month.month).padStart(2, "0")}`;
  const eligibility = constructionOrderEligibility(
    snapshot,
    design,
    content,
    monthId,
    replacingProjectId,
  );
  if (!eligibility.eligible) {
    return {
      ok: false,
      reason: eligibility.rejections[0]!.code,
      diagnostics: eligibility.rejections.map((r) => r.message),
    };
  }
  const costs = resolveOrderCosts(content, request.nationId, design, monthId);
  if (costs === null)
    return {
      ok: false,
      reason: "NATIONAL_SUPPLY_UNAVAILABLE",
      diagnostics: [`Nation ${request.nationId} cannot obtain its main armament or armour plate`],
    };
  const project = {
    ...constructionProjectFor(
      request.commandId,
      request.designVersionId,
      costs.costs.projectedCost,
      request.month,
      design["constructionPlan"],
      costs.national,
    ),
    ...(eligibility.newConstructionReservedMassKg !== undefined
      ? { newConstructionReservedMassKg: eligibility.newConstructionReservedMassKg }
      : {}),
  };
  const kept = nation["constructionProjects"].filter((p) => p["id"] !== replacingProjectId);
  const nations = new Map(snapshot["nations"]).set(request.nationId, {
    ...nation,
    constructionProjects: [...kept, project],
  });
  return { ok: true, snapshot: { ...snapshot, nations }, project, design, costs: costs.costs };
}

export const CONSTRUCTION_BATCH_MIN_QUANTITY = 1;
export const CONSTRUCTION_BATCH_MAX_QUANTITY = 12;

export const CONSTRUCTION_BATCH_LIMIT_EXCEEDED = "CONSTRUCTION_BATCH_LIMIT_EXCEEDED" as const;

export interface ConstructionBatchRequest {
  readonly nationId: string;
  readonly commandId: string;
  readonly designVersionId: string;
  readonly quantity: number;
  readonly month: { readonly month: number; readonly year: number };
}

export type ConstructionBatchResult =
  | {
      readonly ok: true;
      readonly snapshot: CampaignSnapshot;
      readonly projects: readonly ConstructionProject[];
      readonly design: CompiledDesignVersion;
      readonly costs: ConstructionOrderCosts;
      readonly names: readonly ShipNameAllocation[];
      readonly namePoolExhausted: boolean;
      readonly batchId: string;
      readonly namedClassId: string;
      readonly batchHash: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly diagnostics: readonly string[];
    };

function takenShipNames(snapshot: CampaignSnapshot, nationId: string): string[] {
  const nation = snapshot["nations"].get(nationId);
  const names: string[] = [];
  if (!nation) return names;
  for (const fleet of nation["fleets"]) for (const ship of fleet["ships"]) names.push(ship["name"]);
  for (const design of snapshot["designs"].values())
    if (design.nationId === nationId) names.push(design.className);
  for (const project of nation["constructionProjects"])
    if (project["shipName"] !== undefined) names.push(project["shipName"]);
  return names;
}

export function placeConstructionBatch(
  snapshot: CampaignSnapshot,
  request: ConstructionBatchRequest,
  content: ShipBuildingContent | undefined,
): ConstructionBatchResult {
  if (
    !Number.isInteger(request.quantity) ||
    request.quantity < CONSTRUCTION_BATCH_MIN_QUANTITY ||
    request.quantity > CONSTRUCTION_BATCH_MAX_QUANTITY
  )
    return {
      ok: false,
      reason: CONSTRUCTION_BATCH_LIMIT_EXCEEDED,
      diagnostics: [
        `A class order is 1..${String(CONSTRUCTION_BATCH_MAX_QUANTITY)} ships; got ${String(request.quantity)}. A second batch needs a second command.`,
      ],
    };
  const targets = resolveOrderTargets(snapshot, request.nationId, request.designVersionId);
  if (!targets.ok) return { ok: false, reason: targets.reason, diagnostics: targets.diagnostics };
  const { nation, design } = targets;
  const monthId = `${String(request.month.year)}-${String(request.month.month).padStart(2, "0")}`;
  const eligibility = constructionOrderEligibility(
    snapshot,
    design,
    content,
    monthId,
    undefined,
    request.quantity,
  );
  if (!eligibility.eligible)
    return {
      ok: false,
      reason: eligibility.rejections[0]!.code,
      diagnostics: eligibility.rejections.map((r) => r.message),
    };
  const costs = resolveOrderCosts(content, request.nationId, design, monthId);
  if (costs === null)
    return {
      ok: false,
      reason: "NATIONAL_SUPPLY_UNAVAILABLE",
      diagnostics: [`Nation ${request.nationId} cannot obtain its main armament or armour plate`],
    };

  const strippedCommandId = request.commandId.replace(/^cmd-/, "");
  const batchId = `batch-${strippedCommandId}`;
  const namedClassId =
    design["designFamilyId"] !== ""
      ? design["designFamilyId"]
      : `class-${design["designVersionId"]}`;
  const shipType = shipTypeForHullType(design["hullType"]);
  const profile = content?.navalProfileFor(request.nationId, monthId) ?? null;
  const stems =
    (shipType !== null ? profile?.namingPolicy.stems[shipType] : undefined) ??
    ([] as readonly string[]);
  const naming = allocateShipNames({
    pool: { poolId: `name_pool:${request.nationId}:${shipType ?? design["hullType"]}`, stems },
    count: request.quantity,
    taken: takenShipNames(snapshot, request.nationId),
    placeholderStem: design["className"],
  });

  const baseProject = constructionProjectFor(
    request.commandId,
    request.designVersionId,
    costs.costs.projectedCost,
    request.month,
    design["constructionPlan"],
    costs.national,
  );
  const projects = naming.allocations
    .map((allocation, index): ConstructionProject => {
      const ordinal = index + 1;
      return {
        ...baseProject,
        id: constructionBatchProjectIdForCommand(request.commandId, ordinal),
        shipName: allocation.name,
        namePoolId: allocation.pool,
        namePoolOrdinal: allocation.ordinal,
        batchId,
        namedClassId,
        batchOrdinal: ordinal,
        ...(eligibility.newConstructionReservedMassKg !== undefined
          ? { newConstructionReservedMassKg: eligibility.newConstructionReservedMassKg }
          : {}),
      };
    })
    .sort(
      (a, b) =>
        (a["batchOrdinal"] ?? 0) - (b["batchOrdinal"] ?? 0) ||
        (a["id"] < b["id"] ? -1 : a["id"] > b["id"] ? 1 : 0),
    );

  const batchHash = sha256Hex(
    canonicalSerialize({
      artifactKind: "construction-batch",
      designVersionId: request.designVersionId,
      designCompiledHash: design.compiledHash,
      namedClassId,
      batchId,
      quantity: request.quantity,
      ships: projects.map((p) => ({
        projectId: p["id"],
        ordinal: p["batchOrdinal"],
        shipName: p["shipName"],
      })),
    }),
  );

  const kept = nation["constructionProjects"];
  const nations = new Map(snapshot["nations"]).set(request.nationId, {
    ...nation,
    constructionProjects: [...kept, ...projects],
  });
  return {
    ok: true,
    snapshot: { ...snapshot, nations },
    projects,
    design,
    costs: costs.costs,
    names: naming.allocations,
    namePoolExhausted: naming.exhausted,
    batchId,
    namedClassId,
    batchHash,
  };
}

export interface ConstructionBatchPreview {
  readonly designVersionId: string;
  readonly quantity: number;
  readonly names: readonly ShipNameAllocation[];
  readonly namePoolExhausted: boolean;
  readonly dockCeilingKg: number | null;
  readonly designDisplacementKg: number;
  readonly fitsDock: boolean;
  readonly yardId: string | null;
}

export type ConstructionBatchPreviewResult =
  | { readonly ok: true; readonly preview: ConstructionBatchPreview }
  | { readonly ok: false; readonly reason: string; readonly diagnostics: readonly string[] };

export function previewConstructionBatch(
  snapshot: CampaignSnapshot,
  nationId: string,
  designVersionId: string,
  quantity: number,
  content: ShipBuildingContent | undefined,
  month: string,
): ConstructionBatchPreviewResult {
  if (
    !Number.isInteger(quantity) ||
    quantity < CONSTRUCTION_BATCH_MIN_QUANTITY ||
    quantity > CONSTRUCTION_BATCH_MAX_QUANTITY
  )
    return {
      ok: false,
      reason: CONSTRUCTION_BATCH_LIMIT_EXCEEDED,
      diagnostics: [
        `A class order is 1..${String(CONSTRUCTION_BATCH_MAX_QUANTITY)} ships; got ${String(quantity)}. A second batch needs a second command.`,
      ],
    };
  const targets = resolveOrderTargets(snapshot, nationId, designVersionId);
  if (!targets.ok) return { ok: false, reason: targets.reason, diagnostics: targets.diagnostics };
  const { design } = targets;
  const shipType = shipTypeForHullType(design["hullType"]);
  const profile = content?.navalProfileFor(nationId, month) ?? null;
  const stems =
    (shipType !== null ? profile?.namingPolicy.stems[shipType] : undefined) ??
    ([] as readonly string[]);
  const naming = allocateShipNames({
    pool: { poolId: `name_pool:${nationId}:${shipType ?? design["hullType"]}`, stems },
    count: quantity,
    taken: takenShipNames(snapshot, nationId),
    placeholderStem: design["className"],
  });
  const dockCeilingKg =
    builderDockRecord(snapshot, nationId, content, month)?.maximumNewConstructionMassKg ?? null;
  const designDisplacementKg = Number(design["normalizedDisplacementKg"]);
  return {
    ok: true,
    preview: {
      designVersionId,
      quantity,
      names: naming.allocations,
      namePoolExhausted: naming.exhausted,
      dockCeilingKg,
      designDisplacementKg,
      fitsDock: dockCeilingKg !== null && designDisplacementKg <= dockCeilingKg,
      yardId: design["constructionPlan"]?.yardId ?? null,
    },
  };
}
