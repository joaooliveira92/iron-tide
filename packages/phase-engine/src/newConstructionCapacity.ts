import type { CampaignSnapshot } from "@bluewave/campaign";
import { isTerminalConstructionProjectStatus } from "@bluewave/campaign";
import {
  maxConcurrentConstructionMassKg,
  reservedNewConstructionMassKg,
  shippedConstructionCapacityExemptions,
  type ConstructionCapacityBalance,
  type ConstructionCapacityExemptionDefinition,
} from "@bluewave/ship-design";

export { INSUFFICIENT_PROJECT_CAPACITY } from "@bluewave/ship-design";

export interface NationalConstructionCapacity {
  readonly maxConcurrentMassKg: number;
  readonly exemptions: readonly ConstructionCapacityExemptionDefinition[];
}

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

export function designNewConstructionReservedMassKg(
  hullType: string,
  displacementKg: number,
  capacity: NationalConstructionCapacity,
): number {
  return reservedNewConstructionMassKg({ hullType, displacementKg }, capacity.exemptions);
}

export interface ConstructionCapacityUtilization {
  readonly maxConcurrentMassKg: number;
  readonly committedMassKg: number;
  readonly exemptMassKg: number;
}

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
    if (p["foreignContractId"] !== undefined) continue;
    const design = snapshot["designs"].get(p.designVersionId);
    if (!design) continue;
    const displacementKg = Number(design.normalizedDisplacementKg);
    const reserved = designNewConstructionReservedMassKg(design.hullType, displacementKg, capacity);
    exemptMassKg += Math.max(0, displacementKg - reserved);
  }
  return { maxConcurrentMassKg: capacity.maxConcurrentMassKg, committedMassKg, exemptMassKg };
}

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
    if (p["foreignContractId"] !== undefined) continue;
    if (p.id === excludedProjectId) continue;
    total += projectReservedMassKg(snapshot, p, capacity);
  }
  return total;
}

export const FOREIGN_CONTRACT_PRIORITY_POLICY_ID = "foreign_contract_priority_v1" as const;

export const FOREIGN_CONTRACT_PRIORITY_DEFERRED = "FOREIGN_CONTRACT_PRIORITY_DEFERRED" as const;

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

export interface BuilderCapacityClaim {
  readonly id: string;
  readonly rank: ForeignContractPriorityRank;
  readonly massKg: number;
  readonly tieBreak: readonly (string | number)[];
}

export interface BuilderCapacityAllocation {
  readonly admitted: readonly string[];
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

function contractReservedMassKg(contract: {
  readonly capacityReservationSchedule: readonly { readonly reservedMassKg: number }[];
}): number {
  let total = 0;
  for (const reservation of contract.capacityReservationSchedule)
    if (Number.isSafeInteger(reservation.reservedMassKg) && reservation.reservedMassKg > 0)
      total += reservation.reservedMassKg;
  return total;
}

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

export function foreignContractsCommittedMassKg(
  snapshot: CampaignSnapshot,
  builderNationId: string,
): number {
  return foreignContractClaims(snapshot, builderNationId).reduce(
    (sum, claim) => sum + claim.massKg,
    0,
  );
}
