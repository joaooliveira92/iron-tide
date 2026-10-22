import {
  isShipOperational,
  type CampaignSnapshot,
  type CompiledDesignVersion,
} from "@bluewave/campaign";
import { designFamilyYear, isDesignBuildableByYear } from "@bluewave/campaign-engine";
import {
  compileDesign,
  DESIGN_22_EARLY,
  dockRecordFor,
  dockRecordFromDefinition,
  evaluateAmcFleetLimit,
  HULL_TYPE_FOR_SHIP_TYPE,
  newConstructionDockEligibility,
  type AvailabilityReason,
  type DesignDraft,
  type ShipBuildingContent,
} from "@bluewave/ship-design";
import {
  allocateBuilderCapacity,
  committedNewConstructionMassKg,
  designNewConstructionReservedMassKg,
  foreignContractClaims,
  foreignContractsCommittedMassKg,
  nationalConstructionCapacity,
} from "./newConstructionCapacity.js";

export type OrderRejectionCode =
  | AvailabilityReason["code"]
  | "DESIGN_REVALIDATION_FAILED"
  | "DESIGN_REVALIDATION_UNAVAILABLE"
  | "DESIGN_NOT_YET_AVAILABLE"
  | "SHIP_EXCEEDS_DOMESTIC_DOCK_LIMIT"
  | "INSUFFICIENT_PROJECT_CAPACITY"
  | "FOREIGN_CONTRACT_PRIORITY_DEFERRED"
  | "DOCK_LIMIT_MISSING";

export interface OrderRejection {
  readonly code: OrderRejectionCode;
  readonly message: string;
}

export interface OrderEligibility {
  readonly eligible: boolean;
  readonly rejections: readonly OrderRejection[];
  readonly newConstructionReservedMassKg?: number;
}

const CRUISER_HULL_TYPES: ReadonlySet<string> = new Set([
  HULL_TYPE_FOR_SHIP_TYPE.CA,
  HULL_TYPE_FOR_SHIP_TYPE.CL,
  "heavy_cruiser",
  "light_cruiser",
]);
const AMC_HULL_TYPE = HULL_TYPE_FOR_SHIP_TYPE.AMC;

export function auxiliaryFleetCounts(
  snapshot: CampaignSnapshot,
  nationId: string,
  excludeProjectId?: string,
  fastSpeedUms: number = DESIGN_22_EARLY.amcFastSpeedUms,
): { cruisers: number; amc: number; fastAmc: number } {
  const nation = snapshot["nations"].get(nationId);
  const out = { cruisers: 0, amc: 0, fastAmc: 0 };
  if (!nation) return out;
  const countAmc = (design: CompiledDesignVersion): void => {
    out.amc += 1;
    if (Number(design.normalizedSpeedUms) >= fastSpeedUms) out.fastAmc += 1;
  };
  for (const fleet of nation["fleets"])
    for (const ship of fleet["ships"]) {
      const design = snapshot["designs"].get(ship["designVersionId"]);
      if (!design) continue;
      if (design.hullType === AMC_HULL_TYPE) countAmc(design);
      else if (CRUISER_HULL_TYPES.has(design.hullType) && isShipOperational(ship))
        out.cruisers += 1;
    }
  for (const p of nation["constructionProjects"]) {
    if (
      p["type"] !== "ship" ||
      p["projectType"] !== "NEW_CONSTRUCTION" ||
      p["status"] === "COMPLETED" ||
      p["id"] === excludeProjectId
    )
      continue;
    const design = snapshot["designs"].get(p["designVersionId"]);
    if (design?.hullType === AMC_HULL_TYPE) countAmc(design);
  }
  return out;
}

export function constructionOrderEligibility(
  snapshot: CampaignSnapshot,
  design: CompiledDesignVersion,
  content: ShipBuildingContent | undefined,
  month: string,
  replacingProjectId?: string,
  batchQuantity = 1,
): OrderEligibility {
  const rejections: OrderRejection[] = [];
  if (design.sourceDraft !== undefined) {
    if (content === undefined)
      rejections.push({
        code: "DESIGN_REVALIDATION_UNAVAILABLE",
        message: "The ship-building content is not loaded, so the design cannot be revalidated.",
      });
    else {
      try {
        const compiled = compileDesign(
          design.sourceDraft as unknown as DesignDraft,
          content.environmentFor(month).ctx,
        );
        if (!compiled.valid)
          rejections.push({
            code: "DESIGN_REVALIDATION_FAILED",
            message: `The design no longer passes validation: ${compiled.findings
              .filter((f) => f.severity === "BLOCKING")
              .map((f) => f.id)
              .join(", ")}.`,
          });
      } catch (e) {
        rejections.push({
          code: "DESIGN_REVALIDATION_FAILED",
          message: `The design could not be revalidated: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }
  }
  const family =
    design.designFamilyId !== ""
      ? snapshot["designFamilies"].get(design.designFamilyId)
      : undefined;
  const designYear = designFamilyYear(family?.familyCreationMonth);
  const campaignYear = parseInt(month.slice(0, 4), 10);
  if (!isDesignBuildableByYear(designYear, campaignYear))
    rejections.push({
      code: "DESIGN_NOT_YET_AVAILABLE",
      message: `Design ${design.designVersionId} enters service in ${String(designYear)}, after the campaign month ${month}.`,
    });
  if (design.hullType === AMC_HULL_TYPE) {
    const rules = content?.environmentFor(month).ctx.balance.classification ?? DESIGN_22_EARLY;
    const limit = evaluateAmcFleetLimit(
      Number(design.normalizedSpeedUms),
      auxiliaryFleetCounts(snapshot, design.nationId, replacingProjectId, rules.amcFastSpeedUms),
      rules,
    );
    rejections.push(...limit.reasons);
  }
  const nationDock = snapshot["nations"].get(design.nationId)?.dock;
  const profile = content?.navalProfileFor(design.nationId, month) ?? null;
  const dockRecord =
    nationDock !== undefined
      ? dockRecordFromDefinition(nationDock)
      : profile !== null
        ? dockRecordFor(profile)
        : null;
  if (dockRecord !== null) {
    const dock = newConstructionDockEligibility(dockRecord, {
      lengthMm: 0,
      beamMm: 0,
      displacementKg: Number(design.normalizedDisplacementKg),
      heaviestKg: 0,
    });
    for (const r of dock.rejections) rejections.push({ code: r.code, message: r.message });
  }
  let newConstructionReservedMassKg: number | undefined;
  if (dockRecord !== null && content !== undefined) {
    const balance = content.environmentFor(month).constructionBalance;
    const capacity = nationalConstructionCapacity(
      balance,
      dockRecord.maximumNewConstructionMassKg ?? 0,
    );
    newConstructionReservedMassKg = designNewConstructionReservedMassKg(
      design.hullType,
      Number(design.normalizedDisplacementKg),
      capacity,
    );
    const ownCommitted = committedNewConstructionMassKg(
      snapshot,
      design.nationId,
      capacity,
      replacingProjectId,
    );
    const batchReservation = newConstructionReservedMassKg * batchQuantity;
    const newClaimId = `new:${design.designVersionId}`;
    const allocation = allocateBuilderCapacity(
      [
        ...foreignContractClaims(snapshot, design.nationId),
        {
          id: newClaimId,
          rank: "DISCRETIONARY_DOMESTIC",
          massKg: batchReservation,
          tieBreak: [design.nationId, "", "", design.designVersionId],
        },
      ],
      Math.max(0, capacity.maxConcurrentMassKg - ownCommitted),
    );
    if (!allocation.admitted.includes(newClaimId)) {
      const foreignCommitted = foreignContractsCommittedMassKg(snapshot, design.nationId);
      const foreignBinding =
        foreignCommitted > 0 && ownCommitted + batchReservation <= capacity.maxConcurrentMassKg;
      rejections.push(
        foreignBinding
          ? {
              code: "FOREIGN_CONTRACT_PRIORITY_DEFERRED",
              message: `Accepted foreign contracts already hold ${foreignCommitted} kg of ${design.nationId}'s capacity; reserving ${batchReservation} kg more would put ${ownCommitted + foreignCommitted + batchReservation} kg under construction, above the builder's cap of ${capacity.maxConcurrentMassKg} kg.`,
            }
          : {
              code: "INSUFFICIENT_PROJECT_CAPACITY",
              message: `Reserving ${batchReservation} kg for ${batchQuantity === 1 ? design.designVersionId : `${String(batchQuantity)} x ${design.designVersionId}`} would put ${ownCommitted + batchReservation} kg under construction, above the nation's cap of ${capacity.maxConcurrentMassKg} kg.`,
            },
      );
    }
  }
  return {
    eligible: rejections.length === 0,
    rejections,
    ...(newConstructionReservedMassKg !== undefined ? { newConstructionReservedMassKg } : {}),
  };
}
