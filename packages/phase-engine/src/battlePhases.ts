import type { BattleInstance, CampaignWeatherState, NationState } from "@bluewave/campaign";
import { generate, resolve } from "@bluewave/combat";
import { BATTLE_AUTO_RESOLUTION_FAILED, BattleResolver } from "@bluewave/combat/battleResolution";
import { INVALID_BATTLE_WEATHER_INITIALIZATION } from "@bluewave/combat/weather";
import { isBluewaveError } from "@bluewave/contracts";
import type { RandomEngine } from "@bluewave/random";
import {
  applyBattleConsequences,
  applyBattleResult,
  collectLostShips,
  recordResolvedBattle,
  resolveBattleManifest,
  resolveCampaignBattleReadiness,
  resolveGenerationShipType,
  resolveLegacyBattle,
  resolveShipStrength,
  toCampaignBattleResult,
} from "./battles.js";
import {
  applyDecline,
  applyEnemyDeclines,
  applySupportForces,
  buildOfferContent,
  consumeOffer,
  offeredManifestFor,
} from "./battleOffer.js";
import { battleOfferAnsweredEvent } from "./events.js";
import { applyRecordedBattleResult, consumeBattleResult } from "./interruption.js";
import type { MonthPhase, PhaseContext, PhaseRunOutcome } from "./pipeline.js";
import { applyPrestigeChange } from "./prestigeApplication.js";

type AutoResolutionManifest = Parameters<typeof resolve>[0]["manifest"];

export function runBattleGenerationPhase(ctx: PhaseContext): PhaseRunOutcome {
  const { campaignMonth } = ctx;

  const hadWars = (ctx.snapshot.read("wars")["wars"] ?? []).some(
    (w) => w["status"] === "ACTIVE" || w["status"] === "DECLARED_NOT_ACTIVE",
  );
  if (!hadWars) return { status: "continue" };

  const generated = generate({
    snapshot: ctx.snapshot.current,
    campaignMonth,
    campaignSeed: ctx.rng.seed(),
    rngVersion: "1",
    formulaVersion: "1",
    rulesetVersion: ctx.snapshot.current["rulesetVersion"],
    contentVersion: "0.1.0",
    resolveStrength: (shipId) => resolveShipStrength(ctx.snapshot.current, shipId),
    resolveShipType: resolveGenerationShipType,
    resolveReadiness: (shipId) => resolveCampaignBattleReadiness(ctx.snapshot.current, shipId),
  });

  const surviving = applyEnemyDeclines(ctx, generated);
  const generationResult = applySupportForces(ctx, surviving);

  if (generationResult.battleIds.length === 0) return { status: "continue" };

  const fleetsInArea = (nationId: string, areaId: string): string[] => {
    const nation = ctx.snapshot.current["nations"].get(nationId);
    if (!nation) return [];
    return nation["fleets"].filter((f) => f["locationAreaId"] === areaId).map((f) => f["id"]);
  };

  const newBattles: BattleInstance[] = generationResult.battleIds.map((battleId, i) => {
    const manifest = generationResult.manifests[i]!;
    const attackerFleetIds = fleetsInArea(manifest.attackerId, manifest.areaId);
    const defenderFleetIds = fleetsInArea(manifest.defenderId, manifest.areaId);
    return {
      id: battleId,
      phase: "pending" as const,
      attackerId: manifest.attackerId,
      defenderId: manifest.defenderId,
      areaId: manifest.areaId,
      attackerFleetIds,
      defenderFleetIds,
      manifestHash: manifest.manifestHash,
    };
  });

  const reservedShipIds = new Set(generationResult.manifests.flatMap((m) => m["persistentAssets"]));
  const updatedNations = new Map<string, NationState>();
  for (const [nid, nation] of ctx.snapshot.current["nations"]) {
    if (reservedShipIds.size === 0) {
      updatedNations.set(nid, nation);
      continue;
    }
    const fleets = nation["fleets"].map((f) => ({
      ...f,
      ships: f["ships"].map((s) =>
        reservedShipIds.has(s["id"]) ? { ...s, inBattleId: generationResult.battleIds[0] } : s,
      ),
    }));
    updatedNations.set(nid, { ...nation, fleets });
  }

  ctx.snapshot.current = {
    ...ctx.snapshot.current,
    nations: updatedNations,
    wars: {
      ...ctx.snapshot.current["wars"],
      battleManifests: [
        ...(ctx.snapshot.current["wars"]["battleManifests"] ?? []),
        ...generationResult.manifests,
      ],
      battles: [...ctx.snapshot.current["wars"]["battles"], ...newBattles],
    },
  };
  return { status: "continue" };
}

export function runBattleResolutionPhase(ctx: PhaseContext): PhaseRunOutcome {
  const battles = ctx.snapshot.current["wars"]["battles"].filter(
    (b) => b["phase"] === "pending" || b["phase"] === "resolving",
  );
  if (battles.length === 0) return { status: "continue" };

  const randomEngine = ctx.rng.engine();
  const resolver = new BattleResolver();

  for (const battle of battles) {
    resolveBattle(ctx, battle, resolver, randomEngine);
    if (ctx.interruption?.suspended !== undefined) return { status: "finish", success: true };
  }
  scoreResolvedBattles(
    ctx,
    battles.map((b) => b["id"]),
  );
  return { status: "continue" };
}

function scoreResolvedBattles(ctx: PhaseContext, battleIds: readonly string[]): void {
  const player = ctx.playerNationId;
  if (player === undefined) return;
  const ids = new Set(battleIds);
  const resolved = ctx.snapshot.current["wars"]["battles"]
    .filter((b) => ids.has(b["id"]) && b["phase"] === "resolved")
    .sort((a, b) => (a["id"] < b["id"] ? -1 : a["id"] > b["id"] ? 1 : 0));
  for (const battle of resolved) {
    const result = battle["result"];
    if (result === undefined) continue;
    if (result.loserId === player) applyPrestigeChange(ctx, player, "BATTLE_LOST");
    else if (result.winnerId === player) applyPrestigeChange(ctx, player, "BATTLE_WON");
  }
}

function resolveViaLegacyPath(
  ctx: PhaseContext,
  battle: BattleInstance,
  attacker: NationState,
  defender: NationState,
  randomEngine: RandomEngine,
  resolver: BattleResolver,
): void {
  ctx.snapshot.current = resolveLegacyBattle(
    ctx.snapshot.current,
    battle,
    attacker,
    defender,
    randomEngine,
    resolver,
    ctx.campaignMonth,
    ctx.collector,
  );
}

function resolveBattle(
  ctx: PhaseContext,
  battle: BattleInstance,
  resolver: BattleResolver,
  randomEngine: RandomEngine,
): void {
  const { collector } = ctx;

  if (
    ctx.interruption !== undefined &&
    ctx.playerNationId !== undefined &&
    ctx.battleOffers !== undefined
  ) {
    const manifest = offeredManifestFor(ctx.snapshot.current, battle, ctx.playerNationId);
    if (manifest !== null) {
      const content = buildOfferContent({
        snapshot: ctx.snapshot.current,
        battle,
        manifest,
        playerNationId: ctx.playerNationId,
        rules: ctx.battleOffers,
        randomEngine,
        randomLedger: ctx.randomLedger,
      });
      const answered = consumeOffer(ctx, content);
      if (ctx.interruption.suspended !== undefined) return;
      if (answered !== null && answered.response === "decline") {
        applyDecline(
          ctx,
          battle,
          manifest,
          content,
          ctx.playerNationId,
          ctx.battleOffers,
          answered.inputHash,
        );
        return;
      }
      if (answered !== null) {
        ctx.eventLedger.append(
          battleOfferAnsweredEvent(
            ctx.playerNationId,
            battle["id"],
            content.missionType,
            answered.response === "delegate" ? "delegate" : "accept",
            ctx.nextSeq(),
            ctx.campaignMonth,
          ),
        );
        if (answered.response === "accept") {
          const recorded = consumeBattleResult(ctx, battle);
          if (ctx.interruption.suspended !== undefined) return;
          if (recorded !== null) {
            applyRecordedBattleResult(ctx, battle, recorded);
            return;
          }
        }
      }
    }
  } else if (ctx.interruption !== undefined) {
    const recorded = consumeBattleResult(ctx, battle);
    if (ctx.interruption.suspended !== undefined) return;
    if (recorded !== null) {
      applyRecordedBattleResult(ctx, battle, recorded);
      return;
    }
  }

  const attacker = ctx.snapshot.current["nations"].get(battle["attackerId"]);
  const defender = ctx.snapshot.current["nations"].get(battle["defenderId"]);
  if (!attacker || !defender) {
    collector.addError("BATTLE_NATION_MISSING", `Nation not found for battle ${battle["id"]}`, {
      stage: "battle-resolution",
    });
    return;
  }

  const manifest = resolveBattleManifest(ctx.snapshot.current, battle);
  const hasManifestHash = battle["manifestHash"] !== undefined;

  if (!hasManifestHash || manifest === null) {
    if (hasManifestHash) {
      collector.addError(
        BATTLE_AUTO_RESOLUTION_FAILED,
        `Battle ${battle["id"]} declares manifestHash ${battle["manifestHash"]} but no matching battle manifest exists in the snapshot`,
        { stage: "battle-resolution", entityId: battle["id"] },
      );
      return;
    }
    resolveViaLegacyPath(ctx, battle, attacker, defender, randomEngine, resolver);
    return;
  }

  const strategicWeather = ctx.snapshot.current["strategicWeather"].find(
    (s) => s["areaId"] === battle["areaId"],
  );
  if (!strategicWeather) {
    collector.addError(
      INVALID_BATTLE_WEATHER_INITIALIZATION,
      `Battle ${battle["id"]} has a manifest but no committed strategic weather for area ${battle["areaId"]} — resolving via the legacy strength path`,
      { stage: "battle-resolution", entityId: battle["id"] },
    );
    resolveViaLegacyPath(ctx, battle, attacker, defender, randomEngine, resolver);
    return;
  }

  resolveViaTacticalAuto(
    ctx,
    battle,
    attacker,
    defender,
    manifest,
    strategicWeather,
    randomEngine,
    resolver,
  );
}

function resolveViaTacticalAuto(
  ctx: PhaseContext,
  battle: BattleInstance,
  attacker: NationState,
  defender: NationState,
  manifest: AutoResolutionManifest,
  strategicWeather: CampaignWeatherState,
  randomEngine: RandomEngine,
  resolver: BattleResolver,
): void {
  const { campaignMonth, collector, randomLedger } = ctx;

  try {
    const autoResult = resolve({
      battleId: battle["id"],
      areaId: battle["areaId"],
      campaignMonth,
      manifest,
      attacker: {
        nationId: attacker["id"],
        ships: attacker["fleets"].flatMap((f) => f["ships"]),
        designs: ctx.snapshot.current["designs"],
        divisions: attacker["divisions"],
        officers: attacker["officers"],
      },
      defender: {
        nationId: defender["id"],
        ships: defender["fleets"].flatMap((f) => f["ships"]),
        designs: ctx.snapshot.current["designs"],
        divisions: defender["divisions"],
        officers: defender["officers"],
      },
      strategicWeather,
      campaignSeed: ctx.rng.seed(),
      rulesetVersion: ctx.snapshot.current["rulesetVersion"],
      formulaVersion: manifest["formulaVersion"],
      rngVersion: manifest["rngVersion"],
      randomLedger,
    });

    if (autoResult.winnerId !== null && autoResult.loserId !== null) {
      ctx.snapshot.current = applyBattleResult(
        ctx.snapshot.current,
        battle,
        {
          winnerId: autoResult.winnerId,
          loserId: autoResult.loserId,
          damageReport: autoResult.damageReport,
        },
        campaignMonth,
        collector,
      );
    }

    const lostShips = collectLostShips(ctx.snapshot.current, battle, autoResult, campaignMonth);
    ctx.snapshot.current = applyBattleConsequences(ctx.snapshot.current, battle, autoResult);
    ctx.snapshot.current = recordResolvedBattle(
      ctx.snapshot.current,
      battle,
      toCampaignBattleResult(autoResult, lostShips),
    );
  } catch (e) {
    const ctxCode =
      isBluewaveError(e) && typeof e.context?.["code"] === "string"
        ? (e.context["code"] as string)
        : "";
    const code = ctxCode.length > 0 ? ctxCode : BATTLE_AUTO_RESOLUTION_FAILED;
    collector.addError(
      code,
      `Battle auto-resolution failed for ${battle["id"]}: ${(e as Error).message ?? String(e)}`,
      { stage: "battle-resolution", entityId: battle["id"] },
    );
    resolveViaLegacyPath(ctx, battle, attacker, defender, randomEngine, resolver);
  }
}

export const battleGenerationPhase: MonthPhase = {
  id: "battle_generation",
  name: "Battle Generation",
  permissions: { reads: "all", writes: ["nations", "wars"], rng: true },
  run: runBattleGenerationPhase,
};

export const battleResolutionPhase: MonthPhase = {
  id: "battle_resolution",
  name: "Battle Resolution",
  permissions: { reads: "all", writes: ["nations", "wars", "politics"], rng: true },
  run: runBattleResolutionPhase,
};
