import {
  applyDivisionExperienceRequest,
  battleExperienceRequests,
  type BattleInstance,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { compareCodePoints } from "@bluewave/deterministic";
import { divisionExperienceChangedEvent } from "./events.js";
import type { PhaseContext } from "./pipeline.js";

function participantShipIds(ctx: PhaseContext, battle: BattleInstance): Set<string> {
  const manifest = (ctx.snapshot.current["wars"]["battleManifests"] ?? []).find(
    (candidate) => candidate["battleId"] === battle["id"],
  );
  if (manifest !== undefined) return new Set(manifest["persistentAssets"]);
  const fleetIds = new Set([...battle["attackerFleetIds"], ...battle["defenderFleetIds"]]);
  const ids = new Set<string>();
  for (const nation of ctx.snapshot.current["nations"].values())
    for (const fleet of nation["fleets"])
      if (fleetIds.has(fleet["id"])) for (const ship of fleet["ships"]) ids.add(ship["id"]);
  return ids;
}

export function applyBattleExperience(ctx: PhaseContext, battleIds: readonly string[]): void {
  const points = ctx.fleetManagement?.divisionExperience.perBattle;
  if (points === undefined) return;

  const ids = new Set(battleIds);
  const resolved = ctx.snapshot.current["wars"]["battles"]
    .filter((battle) => ids.has(battle["id"]) && battle["phase"] === "resolved")
    .sort((a, b) => compareCodePoints(a["id"], b["id"]));

  for (const battle of resolved) {
    const nations = new Map(ctx.snapshot.current["nations"]);
    const requests = battleExperienceRequests({
      battleId: battle["id"],
      participantShipIds: participantShipIds(ctx, battle),
      divisions: [...nations.values()].flatMap((nation) => nation["divisions"]),
      points,
    });
    let changed = false;
    for (const request of requests) {
      const nation = nations.get(request.nationId);
      if (nation === undefined) continue;
      const index = nation["divisions"].findIndex(
        (division) => division["divisionId"] === request.divisionId,
      );
      if (index === -1) continue;
      const applied = applyDivisionExperienceRequest(nation["divisions"][index]!, request);
      if (applied.division === nation["divisions"][index]) continue;
      const divisions = [...nation["divisions"]];
      divisions[index] = applied.division;
      nations.set(request.nationId, { ...nation, divisions });
      changed = true;
      ctx.eventLedger.append(
        divisionExperienceChangedEvent(
          request.nationId,
          request.divisionId,
          request.sourceId,
          request.reason,
          {
            before: applied.before,
            after: applied.after,
            delta: SafeInt.sub(applied.after, applied.before),
          },
          ctx.nextSeq(),
          ctx.campaignMonth,
        ),
      );
    }
    if (changed) ctx.snapshot.current = { ...ctx.snapshot.current, nations };
  }
}
