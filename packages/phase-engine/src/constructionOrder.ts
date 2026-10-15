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

/**
 * The per-package state a new project starts with (ADR-0077), from the design's construction plan: every package with no
 * work done and the yard that builds it. Only when the plan's packages add up to the project's total work, so the project's
 * invariants hold from the start; otherwise the project keeps the single-figure model.
 */
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

/** The queued new-construction project an order for `designId` starts as. Pure. */
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

// ---------------------------------------------------------------------------------------------------------------
// Shared order-path guards and cost resolution (single order, batch, foreign order)
// ---------------------------------------------------------------------------------------------------------------

/** The nation + design an order targets, or the stable refusal shared by every order path. */
type OrderTargetResolution =
  | { readonly ok: true; readonly nation: NationState; readonly design: CompiledDesignVersion }
  | { readonly ok: false; readonly reason: string; readonly diagnostics: readonly string[] };

/** The nation/design/ownership guard every order path shares (single order, batch, foreign order): the nation must
 * exist, the compiled design must exist, and it must belong to the ordering nation. Pure. */
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

/** The projected costs plus the persisted national modifiers, or `null` when the nation cannot obtain its supply. */
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

/**
 * Resolve the nation's construction economics at order time (ADR-0090): cost/build-time multipliers are applied once
 * here and persisted on the project, so a later profile-content change never re-prices an existing order. Returns
 * `null` when the nation cannot obtain its main armament or armour under the current policy (fail closed).
 */
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
  /** The in-flight order this one replaces: its project leaves in the same step and does not count against limits. */
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
      /** Stable reason code: `NATION_NOT_FOUND`, `UNKNOWN_DESIGN`, `DESIGN_NOT_FOR_PLAYER` or an order rejection code. */
      readonly reason: string;
      readonly diagnostics: readonly string[];
    };

/**
 * The one way a construction project for a new ship enters a snapshot (ADR-0088). It checks that the design exists and
 * belongs to the nation, then the order eligibility policy (revalidation under today's rules, auxiliary fleet limits),
 * and only then returns the snapshot with the project. Platform-independent: a caller (the desktop main process, a
 * test, a future AI planner) cannot add a project without passing these checks.
 */
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
    // Persist the reservation the eligibility check computed, so the concurrency cap (SB3-R18) is enforced against
    // the order-time value even if content later changes.
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

// ---------------------------------------------------------------------------------------------------------------
// Class-order batch (DESIGN-23 sections 3-5, SB3-R11..R14)
// ---------------------------------------------------------------------------------------------------------------

/** DESIGN-23 section 4: one command orders from `1` through exactly `12` ships of one approved compiled version. */
export const CONSTRUCTION_BATCH_MIN_QUANTITY = 1;
export const CONSTRUCTION_BATCH_MAX_QUANTITY = 12;

/** DESIGN-23 section 4: a quantity above `12` (or below `1`, or non-integer) is rejected with this code. */
export const CONSTRUCTION_BATCH_LIMIT_EXCEEDED = "CONSTRUCTION_BATCH_LIMIT_EXCEEDED" as const;

export interface ConstructionBatchRequest {
  readonly nationId: string;
  readonly commandId: string;
  readonly designVersionId: string;
  /** Ship count, an integer in `1..12` (DESIGN-23 section 4). */
  readonly quantity: number;
  readonly month: { readonly month: number; readonly year: number };
}

export type ConstructionBatchResult =
  | {
      readonly ok: true;
      readonly snapshot: CampaignSnapshot;
      /** The batch's projects, in canonical order: batch ordinal, then ship/project id. */
      readonly projects: readonly ConstructionProject[];
      readonly design: CompiledDesignVersion;
      /** The per-ship projected cost; the batch reservation is `quantity` times as much. */
      readonly costs: ConstructionOrderCosts;
      /** The deterministic name allocations, one per ship. */
      readonly names: readonly ShipNameAllocation[];
      /** True when the name pool could not supply `quantity` distinct fresh base names (SB3-R13). */
      readonly namePoolExhausted: boolean;
      readonly batchId: string;
      readonly namedClassId: string;
      /** The batch's stable canonical hash (design version, class, quantity, ships). */
      readonly batchHash: string;
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly diagnostics: readonly string[];
    };

/**
 * The names already spoken for by `nationId`: every commissioned ship's name, every design's class name, and every
 * in-flight project's already-allocated `shipName`. Handing this to the naming policy keeps a new batch from reusing a
 * name another order already claimed. Pure.
 */
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

/**
 * The one way a class-order batch (DESIGN-23 sections 3-5, SB3-R11..R14) enters a snapshot. It reuses the single-order
 * authorization policy (`constructionOrderEligibility`) for the design — revalidation, auxiliary limits, the dock
 * ceiling and the national concurrency cap (reserving the WHOLE batch) — and only then creates `quantity` projects that
 * share one `batchId`/`namedClassId`, carry deterministic per-ship names, and reference the same compiled design
 * version. A failed gate creates no project and no reservation. Platform-independent and deterministic.
 */
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
  // DESIGN-23 section 5: a repeated order of an existing, already-approved compiled version needs no new study. A
  // mechanically changed design cannot reach the order path at all — it is a new draft, compiled into a new immutable
  // version that only the design-study path (`SubmitDesign` -> `planDesignStudy`) can approve. The manual-parity rule
  // is therefore enforced structurally at the study boundary, not here; cosmetic-only changes keep the approved
  // version's compiled hash and need no study.
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

// ---------------------------------------------------------------------------------------------------------------
// Read-only preview for the build dialog (SB3-R30/R33): names, dock fit and ceiling, no mutation, no reservation
// ---------------------------------------------------------------------------------------------------------------

/**
 * What the build dialog shows before the player orders: the names the engine's naming policy would assign, whether
 * the name pool is exhausted, the ordering nation's dock ceiling, the design's displacement and whether it fits.
 *
 * `yardId` is the yard that would build the batch — the design's own `constructionPlan.yardId` (a domestic batch has
 * no separate builder field; explicit builder / per-ship allocation is deferred). It is added to the
 * otherwise-prompted shape so the dialog can name the yard in the per-yard fit readout.
 */
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

/**
 * Preview a class-order batch (DESIGN-23 sections 3-5, SB3-R30/R33) WITHOUT mutating the snapshot or reserving
 * anything: it reuses the same target guard and naming policy as `placeConstructionBatch`, reads the design's own
 * `normalizedDisplacementKg`, and resolves the ordering nation's dock ceiling from `builderDockRecord`. A quantity
 * outside `1..12` is refused with the same `CONSTRUCTION_BATCH_LIMIT_EXCEEDED` code the command path uses. Pure and
 * deterministic: the renderer's preview can never disagree with what the command would allocate.
 */
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
