import {
  isShipOperational,
  type CampaignSnapshot,
  type CompiledDesignVersion,
} from "@bluewave/campaign";
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

/** Stable codes the construction-order check adds to the ship-type availability reasons. */
export type OrderRejectionCode =
  | AvailabilityReason["code"]
  | "DESIGN_REVALIDATION_FAILED"
  | "DESIGN_REVALIDATION_UNAVAILABLE"
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
  /**
   * The displacement reserved against the national concurrency cap (SB3-R18), when the nation's dock is known. The
   * order path persists it on the project so a later content change cannot re-reserve an existing order.
   */
  readonly newConstructionReservedMassKg?: number;
}

/**
 * Hull types that count as a "cruiser" for the DESIGN-22 section 15 AMC allowance: the canonical CA and CL (the
 * opening campaign's armoured and protected cruisers) and the older authored labels for the same two types. A
 * battlecruiser is a capital ship, DD/KE are not cruisers, and an AMC never counts toward its own allowance.
 */
const CRUISER_HULL_TYPES: ReadonlySet<string> = new Set([
  HULL_TYPE_FOR_SHIP_TYPE.CA,
  HULL_TYPE_FOR_SHIP_TYPE.CL,
  "heavy_cruiser",
  "light_cruiser",
]);
const AMC_HULL_TYPE = HULL_TYPE_FOR_SHIP_TYPE.AMC;

/**
 * The fleet a new AMC order is measured against (DESIGN-22 section 15, ADR-0088):
 * - `cruisers`: ships of a cruiser hull type that are commissioned and operational. A hull still building, or made
 *   unavailable by a rebuild (the engine's only reserve-like state), is not an "active commissioned" cruiser.
 * - `amc` / `fastAmc`: every AMC of the nation, commissioned or still building (a queued order counts at once, so the
 *   limit cannot be exceeded by ordering several before any is launched), whatever its availability: an AMC in a
 *   dockyard is still part of the auxiliary fleet.
 * A fast AMC is one whose designed speed is at or above `amcFastSpeedUms` (22 kn).
 */
export function auxiliaryFleetCounts(
  snapshot: CampaignSnapshot,
  nationId: string,
  /** A project being replaced by the order under test: it is not counted. */
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

/**
 * Whether the player may place a construction order for a design now (application layer, ADR-0088):
 *  1. a design made from a draft is compiled again under today's rules, so a component made obsolete, a treaty or a
 *     ruleset change that now blocks it stops the order instead of reaching the yard;
 *  2. an armed merchant cruiser is checked against the auxiliary fleet limits.
 * Authored designs have no draft and skip the first check (their legality is the content's, not the designer's).
 */
export function constructionOrderEligibility(
  snapshot: CampaignSnapshot,
  design: CompiledDesignVersion,
  content: ShipBuildingContent | undefined,
  month: string,
  replacingProjectId?: string,
  /**
   * The number of ships of `design` the order lays down (DESIGN-23 section 4, `1..12`; default `1`). The dock ceiling
   * is judged per ship (every hull must fit the dock), while the national concurrency cap reserves the whole batch.
   */
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
  if (design.hullType === AMC_HULL_TYPE) {
    // The limits are ruleset data (`ShipBalance.classification`); a pack that sets none gets the DESIGN-22 EARLY values.
    const rules = content?.environmentFor(month).ctx.balance.classification ?? DESIGN_22_EARLY;
    const limit = evaluateAmcFleetLimit(
      Number(design.normalizedSpeedUms),
      auxiliaryFleetCounts(snapshot, design.nationId, replacingProjectId, rules.amcFastSpeedUms),
      rules,
    );
    rejections.push(...limit.reasons);
  }
  // National dock ceiling (DESIGN-16 section 4, ADR-0135): a domestic new construction may not exceed the nation's
  // dock. A materialised dock on the nation wins (dock expansion mutates it); otherwise it is resolved from the naval
  // profile; a pack with neither skips the check (nation-neutral orders).
  const nationDock = snapshot["nations"].get(design.nationId)?.dock;
  const profile = content?.navalProfileFor(design.nationId, month) ?? null;
  const dockRecord =
    nationDock !== undefined
      ? dockRecordFromDefinition(nationDock)
      : profile !== null
        ? dockRecordFor(profile)
        : null;
  if (dockRecord !== null) {
    // INC-16: `CompiledDesignVersion` persists no length/beam, so the dock's dimension predicate is inert here (only
    // the mass ceiling is enforced). Recorded deferral owned by the ship-design/campaign-content work — see
    // `.scratch/shipbuilding-process/issues/INC-16-ship-dimension-dock-predicate.issue.md`.
    const dock = newConstructionDockEligibility(dockRecord, {
      lengthMm: 0,
      beamMm: 0,
      displacementKg: Number(design.normalizedDisplacementKg),
      heaviestKg: 0,
    });
    for (const r of dock.rejections) rejections.push({ code: r.code, message: r.message });
  }
  // National concurrency cap (SB3-R18): the total displacement under construction in the NEW_CONSTRUCTION pool may
  // not exceed `shipyardCapacityMultipleBp` x the dock size. Rebuilds book to REFIT_REBUILD and are not counted;
  // submarines book to NEW_CONSTRUCTION and are. A pack with no balance or dock skips the check (nation-neutral).
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
    // DESIGN-16 section 13.3 (SB3-R21): accepted foreign contracts placed with this nation as BUILDER hold its
    // capacity and outrank a new discretionary domestic project. The new order competes for what is left after the
    // already-admitted domestic work, ranked against the live foreign contracts by the shipped priority policy
    // (`allocateBuilderCapacity`): the foreign rank is admitted first, so a discretionary domestic order that does not
    // fit the remainder is deferred with a stable reason.
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
      // The priority reason only when foreign work is the actual constraint: without the foreign contracts the order
      // would fit. Otherwise the builder's own domestic work alone already exceeds the cap.
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
