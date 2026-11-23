import { damageShareBp, isHeavilyDamaged, type NationState, type Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { resolveBattleManifest } from "./battles.js";
import type { PhaseContext } from "./pipeline.js";
import {
  createRaiderDraw,
  drawHeavyDamageDisposition,
  internedShip,
  raiderEnvelope,
  raiderInternedEvent,
} from "./raiderDisposition.js";
import { byId } from "./tradeWarContext.js";

const ENCOUNTER_CERTAIN_BP = 10_000;

function locateShip(
  nations: ReadonlyMap<string, NationState>,
  nationId: string,
  shipIds: ReadonlySet<string>,
): Ship | undefined {
  return nations
    .get(nationId)
    ?.fleets.flatMap((fleet) => fleet.ships)
    .find((ship) => shipIds.has(ship.id));
}

function replaceShip(
  nations: ReadonlyMap<string, NationState>,
  nationId: string,
  shipId: string,
  replacement: Ship | undefined,
): Map<string, NationState> {
  const updated = new Map(nations);
  const nation = nations.get(nationId);
  if (nation === undefined) return updated;
  updated.set(nationId, {
    ...nation,
    fleets: nation.fleets.map((fleet) =>
      fleet.ships.some((ship) => ship.id === shipId)
        ? {
            ...fleet,
            ships: fleet.ships.flatMap((ship) =>
              ship.id !== shipId ? [ship] : replacement === undefined ? [] : [replacement],
            ),
          }
        : fleet,
    ),
  });
  return updated;
}

export function applyRaiderBattleDispositions(
  ctx: PhaseContext,
  battleIds: readonly string[],
): void {
  const rules = ctx.engineOptions?.tradeProtection?.raiderInterception;
  if (rules === undefined) return;
  const ids = new Set(battleIds);
  const resolved = ctx.snapshot.current["wars"]["battles"]
    .filter((battle) => ids.has(battle["id"]) && battle["phase"] === "resolved")
    .sort((a, b) => byId(a["id"], b["id"]));
  let draw: ReturnType<typeof createRaiderDraw> | undefined;
  const month = ctx.campaignMonth;
  for (const battle of resolved) {
    const manifest = resolveBattleManifest(ctx.snapshot.current, battle);
    if (manifest === null) continue;
    const breakout = manifest["missionType"] === "BLOCKADE_BREAKOUT";
    if (!breakout && manifest["missionType"] !== "RAIDER_INTERCEPTION") continue;
    const raiderNationId = breakout ? battle["attackerId"] : battle["defenderId"];
    const victimNationId = breakout ? battle["defenderId"] : battle["attackerId"];
    const nations = ctx.snapshot.current["nations"];
    const raider = locateShip(nations, raiderNationId, new Set(manifest["persistentAssets"]));
    if (raider === undefined || !isHeavilyDamaged(rules, raider.hitPoints, raider.maxHitPoints))
      continue;
    draw ??= createRaiderDraw(ctx, "battle_resolution");
    const entityKey = `${manifest["warId"]}/${raider.id}/${breakout ? "BREAKOUT" : victimNationId}/${month}`;
    const disposition = drawHeavyDamageDisposition(draw, rules, entityKey, raider.hitPoints);
    const loss = Number(battle["result"]?.["damageReport"][raider.id] ?? 0);
    ctx.eventLedger.append(
      raiderEnvelope("RaiderEngaged", raiderNationId, raider.id, month, ctx.nextSeq(), {
        kind: "RaiderEngaged",
        nationId: raiderNationId,
        shipId: raider.id,
        month,
        victimNationId,
        encounter: breakout ? "BREAKOUT" : "INTERCEPTION",
        chanceBp: SafeInt(ENCOUNTER_CERTAIN_BP),
        outcome: disposition,
        damageBp: SafeInt(damageShareBp(loss, raider.maxHitPoints)),
      }),
    );
    if (disposition === "INTERNED")
      ctx.eventLedger.append(
        raiderInternedEvent(raiderNationId, raider.id, month, ctx.nextSeq(), "DAMAGE"),
      );
    ctx.snapshot.current = {
      ...ctx.snapshot.current,
      nations: replaceShip(
        nations,
        raiderNationId,
        raider.id,
        disposition === "SCUTTLED" ? undefined : internedShip(raider, month, "DAMAGE"),
      ),
    };
  }
}
