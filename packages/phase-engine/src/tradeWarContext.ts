import type {
  CompiledDesignVersion,
  NationState,
  Ship,
  TradeDutyDesign,
  WarDeclaration,
} from "@bluewave/campaign";
import type { PhaseContext } from "./pipeline.js";

export const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function activeWars(ctx: PhaseContext): readonly WarDeclaration[] {
  return ctx.snapshot
    .read("wars")
    .wars.filter((war) => war.status === "ACTIVE")
    .sort((a, b) => byId(a.id, b.id));
}

function sideOf(war: WarDeclaration, nationId: string): "attacker" | "defender" | undefined {
  if (war.attackerSideMembers.includes(nationId)) return "attacker";
  if (war.defenderSideMembers.includes(nationId)) return "defender";
  return undefined;
}

export function opponentsOf(war: WarDeclaration, nationId: string): readonly string[] {
  const side = sideOf(war, nationId);
  if (side === undefined) return [];
  return [...(side === "attacker" ? war.defenderSideMembers : war.attackerSideMembers)].sort(byId);
}

export function shipsOf(nation: NationState): readonly Ship[] {
  return nation.fleets.flatMap((fleet) => fleet.ships).sort((a, b) => byId(a.id, b.id));
}

function aswLevelOf(design: CompiledDesignVersion): number {
  let level = 0;
  for (const capability of design.capabilities ?? []) {
    if (capability.kind === "asw_attack") level = Math.max(level, capability.level);
  }
  return level;
}

export function designMap(ctx: PhaseContext): ReadonlyMap<string, TradeDutyDesign> {
  const designs = new Map<string, TradeDutyDesign>();
  for (const [id, design] of ctx.snapshot.read("designs")) {
    const aswLevel = aswLevelOf(design);
    designs.set(id, {
      hullType: design.hullType,
      normalizedSpeedUms: Number(design.normalizedSpeedUms),
      ...(design.shortRange === true ? { shortRange: true as const } : {}),
      ...(aswLevel > 0 ? { aswLevel } : {}),
    });
  }
  return designs;
}
