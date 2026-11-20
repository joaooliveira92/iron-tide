import { fleetMoveProblem, seaRoute, type CampaignSnapshot } from "@bluewave/campaign";
import type { WarDeclarationRules } from "@bluewave/content-schema";

export type WarDeclarationReason =
  | "DECLARE"
  | "UNKNOWN_NATION"
  | "ALREADY_AT_WAR"
  | "ALLIED"
  | "NON_AGGRESSION_PACT"
  | "ALREADY_IN_WAR"
  | "TENSION_BELOW_THRESHOLD"
  | "OUTMATCHED"
  | "UNREACHABLE";

export interface WarDeclarationDecision {
  readonly declare: boolean;
  readonly reason: WarDeclarationReason;
}

export interface WarSortie {
  readonly fleetId: string;
  readonly toAreaId: string;
}

type WarSnapshot = Pick<CampaignSnapshot, "wars" | "world" | "nations" | "politics">;

const BP = 10_000;

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isLiveWar(status: string): boolean {
  return status === "ACTIVE" || status === "DECLARED_NOT_ACTIVE";
}

function liveWarsOf(snapshot: WarSnapshot, nationId: string) {
  return snapshot.wars.wars.filter(
    (w) =>
      isLiveWar(w.status) &&
      (w.attackerSideMembers.includes(nationId) || w.defenderSideMembers.includes(nationId)),
  );
}

function relationBetween(snapshot: WarSnapshot, a: string, b: string) {
  return snapshot.politics.relations.find(
    (r) => (r.nationA === a && r.nationB === b) || (r.nationA === b && r.nationB === a),
  );
}

function navalBudgetOf(snapshot: WarSnapshot, nationId: string): number {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) return 0;
  return Math.floor((Number(nation.income) * Number(nation.navalAppropriationRateBp)) / BP);
}

function fleetAreasOf(snapshot: WarSnapshot, nationId: string): string[] {
  const areas = new Set<string>();
  for (const fleet of snapshot.nations.get(nationId)?.fleets ?? []) {
    for (const ship of fleet.ships) {
      if (!ship.isUnderConstruction) areas.add(ship.locationAreaId);
    }
  }
  return [...areas].sort(compareCodePoints);
}

function reachableEnemyArea(
  snapshot: WarSnapshot,
  nationId: string,
  fleetId: string,
  enemyAreas: readonly string[],
): { readonly areaId: string; readonly hops: number } | undefined {
  let best: { areaId: string; hops: number } | undefined;
  const fleet = snapshot.nations.get(nationId)?.fleets.find((f) => f.id === fleetId);
  if (fleet === undefined) return undefined;
  for (const areaId of enemyAreas) {
    if (fleetMoveProblem(snapshot, nationId, fleetId, areaId) !== null) continue;
    const route = seaRoute(snapshot.world, fleet.locationAreaId, areaId);
    if (route === null) continue;
    if (best === undefined || route.length < best.hops) best = { areaId, hops: route.length };
  }
  return best;
}

export function decideWarSorties(
  snapshot: WarSnapshot,
  nationId: string,
  enemyId: string,
): readonly WarSortie[] {
  const nation = snapshot.nations.get(nationId);
  if (nation === undefined) return [];
  const enemyAreas = fleetAreasOf(snapshot, enemyId);
  const sorties: WarSortie[] = [];
  for (const fleet of [...nation.fleets].sort((a, b) => compareCodePoints(a.id, b.id))) {
    if (fleet.destinationAreaId !== undefined) continue;
    if (enemyAreas.includes(fleet.locationAreaId)) continue;
    const target = reachableEnemyArea(snapshot, nationId, fleet.id, enemyAreas);
    if (target !== undefined) sorties.push({ fleetId: fleet.id, toAreaId: target.areaId });
  }
  return sorties;
}

export function decideWarDeclaration(
  snapshot: WarSnapshot,
  nationId: string,
  targetId: string,
  rules: Pick<WarDeclarationRules, "tensionThreshold" | "minimumNavalStrengthRatioBp">,
): WarDeclarationDecision {
  const no = (reason: WarDeclarationReason): WarDeclarationDecision => ({ declare: false, reason });
  if (nationId === targetId || !snapshot.nations.has(nationId) || !snapshot.nations.has(targetId))
    return no("UNKNOWN_NATION");

  const relation = relationBetween(snapshot, nationId, targetId);
  if (relation?.relation === "at_war") return no("ALREADY_AT_WAR");
  if (relation?.relation === "allied") return no("ALLIED");
  if (relation?.nap === true) return no("NON_AGGRESSION_PACT");

  const ownWars = liveWarsOf(snapshot, nationId);
  if (ownWars.length > 0) {
    const against = ownWars.some(
      (w) => w.attackerSideMembers.includes(targetId) || w.defenderSideMembers.includes(targetId),
    );
    return no(against ? "ALREADY_AT_WAR" : "ALREADY_IN_WAR");
  }

  if ((relation?.tension ?? 0) < rules.tensionThreshold) return no("TENSION_BELOW_THRESHOLD");

  const own = navalBudgetOf(snapshot, nationId);
  const rival = navalBudgetOf(snapshot, targetId);
  if (own * BP < rival * rules.minimumNavalStrengthRatioBp) return no("OUTMATCHED");

  const enemyAreas = fleetAreasOf(snapshot, targetId);
  const nation = snapshot.nations.get(nationId)!;
  const reachable = nation.fleets.some(
    (fleet) => reachableEnemyArea(snapshot, nationId, fleet.id, enemyAreas) !== undefined,
  );
  return reachable ? { declare: true, reason: "DECLARE" } : no("UNREACHABLE");
}
