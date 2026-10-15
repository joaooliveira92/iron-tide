// SB3-R18/R19: the order-time displacement reservation against the national concurrency cap. This is the application
// layer over the pure `@bluewave/ship-design` primitives: it reads campaign state and the content balance, but owns no
// arithmetic of its own. The cap governs how much tonnage may be under construction at once; the DESIGN-16 section 7
// work-micro-unit pools still govern how fast work advances, and the two are never conflated.
import type { CampaignSnapshot } from "@bluewave/campaign";
import { isTerminalConstructionProjectStatus } from "@bluewave/campaign";
import {
  maxConcurrentConstructionMassKg,
  reservedNewConstructionMassKg,
  shippedConstructionCapacityExemptions,
  type ConstructionCapacityBalance,
  type ConstructionCapacityExemptionDefinition,
} from "@bluewave/ship-design";

/** Re-exported so the order path has one stable, documented reason code. */
export { INSUFFICIENT_PROJECT_CAPACITY } from "@bluewave/ship-design";

/** The national concurrency cap and the exemption definitions it is enforced against. */
export interface NationalConstructionCapacity {
  readonly maxConcurrentMassKg: number;
  readonly exemptions: readonly ConstructionCapacityExemptionDefinition[];
}

/** Resolve a nation's concurrency cap and exemptions from its versioned balance and dock size. Pure. */
export function nationalConstructionCapacity(
  balance: ConstructionCapacityBalance,
  dockMaxMassKg: number,
): NationalConstructionCapacity {
  return {
    maxConcurrentMassKg: maxConcurrentConstructionMassKg(
      dockMaxMassKg,
      balance.shipyardCapacityMultipleBp,
    ),
    exemptions: shippedConstructionCapacityExemptions(balance, dockMaxMassKg),
  };
}

/**
 * The displacement a design reserves against the `NEW_CONSTRUCTION` cap: its non-exempt share under the nation's
 * exemption definitions (DESIGN-16 section 9). A fully exempt ship reserves zero; an ordinary ship reserves all of it.
 */
export function designNewConstructionReservedMassKg(
  hullType: string,
  displacementKg: number,
  capacity: NationalConstructionCapacity,
): number {
  return reservedNewConstructionMassKg({ hullType, displacementKg }, capacity.exemptions);
}

/**
 * DESIGN-16 section 9 (SB3-R19): the compiled capacity readout a screen shows — the cap, the non-exempt mass that
 * competes against it, and the exempt AMC/small-corvette mass that sits outside it. Every field is derived here, never
 * authored by the UI.
 */
export interface ConstructionCapacityUtilization {
  /** The national concurrency cap (`maxConcurrentMassKg`), in kilograms. */
  readonly maxConcurrentMassKg: number;
  /** Non-exempt `NEW_CONSTRUCTION` mass already committed (competes with the cap). */
  readonly committedMassKg: number;
  /** Exempt AMC/small-corvette mass under construction (outside the cap). */
  readonly exemptMassKg: number;
}

/**
 * DESIGN-16 sections 7-9: a nation's `NEW_CONSTRUCTION` capacity utilisation, split into the normal-pool mass that
 * competes with the cap and the exempt AMC/small-corvette share layered outside it. `committedMassKg` is exactly
 * `committedNewConstructionMassKg` (so it matches the order-time reservation); `exemptMassKg` is the non-terminal
 * projects' exempt share `displacement - designNewConstructionReservedMassKg`, clamped at zero. Pure and deterministic.
 */
export function constructionCapacityUtilization(
  snapshot: CampaignSnapshot,
  nationId: string,
  capacity: NationalConstructionCapacity,
): ConstructionCapacityUtilization {
  const committedMassKg = committedNewConstructionMassKg(snapshot, nationId, capacity);
  const nation = snapshot["nations"].get(nationId);
  if (!nation) {
    return { maxConcurrentMassKg: capacity.maxConcurrentMassKg, committedMassKg, exemptMassKg: 0 };
  }
  let exemptMassKg = 0;
  for (const p of nation["constructionProjects"]) {
    if (p.projectType !== "NEW_CONSTRUCTION") continue;
    if (isTerminalConstructionProjectStatus(p.status)) continue;
    // A foreign-contract project is funded and built by its BUILDER (DESIGN-16 section 13.3); its displacement must
    // never count against the ordering nation's pools, exempt or otherwise.
    if (p["foreignContractId"] !== undefined) continue;
    const design = snapshot["designs"].get(p.designVersionId);
    if (!design) continue;
    const displacementKg = Number(design.normalizedDisplacementKg);
    const reserved = designNewConstructionReservedMassKg(design.hullType, displacementKg, capacity);
    exemptMassKg += Math.max(0, displacementKg - reserved);
  }
  return { maxConcurrentMassKg: capacity.maxConcurrentMassKg, committedMassKg, exemptMassKg };
}

/** The displacement reserved by one in-flight project: its stored reservation, else recomputed from its design. */
function projectReservedMassKg(
  snapshot: CampaignSnapshot,
  project: { designVersionId: string; newConstructionReservedMassKg?: number },
  capacity: NationalConstructionCapacity,
): number {
  if (project.newConstructionReservedMassKg !== undefined)
    return project.newConstructionReservedMassKg;
  const design = snapshot["designs"].get(project.designVersionId);
  if (!design) return 0;
  return designNewConstructionReservedMassKg(
    design.hullType,
    Number(design.normalizedDisplacementKg),
    capacity,
  );
}

/**
 * The mass already reserved by a nation's in-flight `NEW_CONSTRUCTION` projects (SB3-R18). Rebuild projects book to
 * `REFIT_REBUILD` and are excluded; submarines book to `NEW_CONSTRUCTION` and are counted. The replaced project, if
 * any, leaves in the same step and is excluded. Pure and deterministic.
 */
export function committedNewConstructionMassKg(
  snapshot: CampaignSnapshot,
  nationId: string,
  capacity: NationalConstructionCapacity,
  excludedProjectId?: string,
): number {
  const nation = snapshot["nations"].get(nationId);
  if (!nation) return 0;
  let total = 0;
  for (const p of nation["constructionProjects"]) {
    if (p.projectType !== "NEW_CONSTRUCTION") continue;
    if (isTerminalConstructionProjectStatus(p.status)) continue;
    // A foreign-contract project books to its BUILDER (DESIGN-16 section 13.3), never the ordering nation's cap.
    if (p["foreignContractId"] !== undefined) continue;
    if (p.id === excludedProjectId) continue;
    total += projectReservedMassKg(snapshot, p, capacity);
  }
  return total;
}

// DESIGN-16 section 13.3: the builder's declared contract-priority policy (SB3-R21)

/** The versioned builder contract-priority policy (DESIGN-16 section 13.3). */
export const FOREIGN_CONTRACT_PRIORITY_POLICY_ID = "foreign_contract_priority_v1" as const;

/**
 * The stable reason a new discretionary domestic project is refused because accepted foreign contracts (which
 * outrank it) already hold the builder's free `NEW_CONSTRUCTION` capacity.
 */
export const FOREIGN_CONTRACT_PRIORITY_DEFERRED = "FOREIGN_CONTRACT_PRIORITY_DEFERRED" as const;

/**
 * DESIGN-16 section 13.3: the shipped rank order for a builder's `NEW_CONSTRUCTION` capacity. Earlier ranks are
 * allocated first; a claim that cannot fit after the higher ranks take their share is deferred, never silently
 * admitted. `MANDATORY_DOMESTIC` is the rank legally mandatory domestic work occupies; no in-flight project is
 * classified as mandatory in the shipped EARLY content, so it is an authored input to the allocator.
 */
export const FOREIGN_CONTRACT_PRIORITY_RANKS = [
  "MANDATORY_DOMESTIC",
  "ACCEPTED_FOREIGN_CONTRACT",
  "DISCRETIONARY_DOMESTIC",
] as const;
export type ForeignContractPriorityRank = (typeof FOREIGN_CONTRACT_PRIORITY_RANKS)[number];

const RANK_ORDER: Readonly<Record<ForeignContractPriorityRank, number>> = {
  MANDATORY_DOMESTIC: 0,
  ACCEPTED_FOREIGN_CONTRACT: 1,
  DISCRETIONARY_DOMESTIC: 2,
};

/** One reservation competing for a builder's free `NEW_CONSTRUCTION` capacity. */
export interface BuilderCapacityClaim {
  /** Stable identifier of the claim (project id, contract id, or the new order's id). */
  readonly id: string;
  readonly rank: ForeignContractPriorityRank;
  readonly massKg: number;
  /**
   * The deterministic tie-break within a rank: builder nation, builder shipyard, authorization month, then the
   * claim's own id (DESIGN-16 section 13.3). A short tuple, compared lexicographically.
   */
  readonly tieBreak: readonly (string | number)[];
}

export interface BuilderCapacityAllocation {
  /** Claim ids admitted, in allocation order. */
  readonly admitted: readonly string[];
  /** Claim ids refused once the cap is reached, each with the stable reason. */
  readonly deferred: readonly { readonly id: string; readonly reason: string }[];
}

const cmpTuple = (a: readonly (string | number)[], b: readonly (string | number)[]): number => {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    return x < y ? -1 : 1;
  }
  return 0;
};

/**
 * DESIGN-16 section 13.3: allocate a builder's free `NEW_CONSTRUCTION` capacity across competing claims in rank order,
 * with the documented deterministic tie-break, never selling the same capacity twice. Claims are sorted by (rank,
 * tie-break, id) so database/insertion order can never change the result; each is admitted while the running total
 * stays within the cap, and every later claim is deferred with `FOREIGN_CONTRACT_PRIORITY_DEFERRED`. Pure.
 */
export function allocateBuilderCapacity(
  claims: readonly BuilderCapacityClaim[],
  maxConcurrentMassKg: number,
): BuilderCapacityAllocation {
  const ordered = [...claims].sort(
    (a, b) =>
      RANK_ORDER[a.rank] - RANK_ORDER[b.rank] ||
      cmpTuple(a.tieBreak, b.tieBreak) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const admitted: string[] = [];
  const deferred: { id: string; reason: string }[] = [];
  let used = 0;
  const cap = Number.isSafeInteger(maxConcurrentMassKg) ? maxConcurrentMassKg : 0;
  for (const claim of ordered) {
    const mass = Number.isSafeInteger(claim.massKg) && claim.massKg > 0 ? claim.massKg : 0;
    if (used + mass <= cap) {
      used += mass;
      admitted.push(claim.id);
    } else {
      deferred.push({ id: claim.id, reason: FOREIGN_CONTRACT_PRIORITY_DEFERRED });
    }
  }
  return { admitted, deferred };
}

/** The reserved mass of one contract's capacity schedule, safe-integer clamped. */
function contractReservedMassKg(contract: {
  readonly capacityReservationSchedule: readonly { readonly reservedMassKg: number }[];
}): number {
  let total = 0;
  for (const reservation of contract.capacityReservationSchedule)
    if (Number.isSafeInteger(reservation.reservedMassKg) && reservation.reservedMassKg > 0)
      total += reservation.reservedMassKg;
  return total;
}

/** Whether a stored foreign contract still reserves capacity: its ordering nation has a non-terminal project for it. */
function isLiveForeignContract(
  snapshot: CampaignSnapshot,
  contract: { readonly orderingNationId: string; readonly contractId: string },
): boolean {
  const nation = snapshot["nations"].get(contract.orderingNationId);
  return (
    nation !== undefined &&
    nation["constructionProjects"].some(
      (p) =>
        p["foreignContractId"] === contract.contractId &&
        !isTerminalConstructionProjectStatus(p.status),
    )
  );
}

/**
 * DESIGN-16 section 13.3: every LIVE accepted foreign contract placed with `builderNationId`, as capacity claims in
 * the `ACCEPTED_FOREIGN_CONTRACT` rank, with the documented tie-break (builder nation, shipyard, authorization month,
 * contract id). A terminal (completed/cancelled) contract has released the builder's capacity and is not a claim.
 * Pure and deterministic.
 */
export function foreignContractClaims(
  snapshot: CampaignSnapshot,
  builderNationId: string,
): BuilderCapacityClaim[] {
  const claims: BuilderCapacityClaim[] = [];
  for (const nation of snapshot["nations"].values())
    for (const contract of nation["foreignContracts"] ?? []) {
      if (contract.builderNationId !== builderNationId) continue;
      if (!isLiveForeignContract(snapshot, contract)) continue;
      claims.push({
        id: contract.contractId,
        rank: "ACCEPTED_FOREIGN_CONTRACT",
        massKg: contractReservedMassKg(contract),
        tieBreak: [
          contract.builderNationId,
          contract.builderShipyardId,
          contract.authorizationMonth,
          contract.contractId,
        ],
      });
    }
  return claims;
}

/**
 * The mass committed to a builder by every nation's LIVE accepted foreign contracts placed with it (DESIGN-16 section
 * 13.3). A foreign contract books to its BUILDER, so it competes with the builder's own domestic work for its cap; a
 * completed or cancelled contract releases it. Pure and deterministic.
 */
export function foreignContractsCommittedMassKg(
  snapshot: CampaignSnapshot,
  builderNationId: string,
): number {
  return foreignContractClaims(snapshot, builderNationId).reduce(
    (sum, claim) => sum + claim.massKg,
    0,
  );
}
