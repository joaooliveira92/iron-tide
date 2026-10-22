import type { BattleInstance, CampaignWeatherState, NationState } from "@bluewave/campaign";
import {
  BATTLE_AUTO_RESOLUTION_FAILED,
  BattleResolver,
  generateBattles,
  INVALID_BATTLE_WEATHER_INITIALIZATION,
  resolveBattleAuto,
} from "@bluewave/combat";
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
import { applyDecline } from "./battleDecline.js";
import { applyEnemyDeclines } from "./enemyDecline.js";
import { applySupportForces } from "./supportForce.js";
import { buildOfferContent, offeredManifestFor } from "./battleOffer.js";
import { battleOfferAnsweredEvent } from "./events.js";
import { applyRecordedBattleResult, consumeBattleResult, consumeOffer } from "./interruption.js";
import { runForeignStationDeploymentStep } from "./foreignStationDeployment.js";
import { runPresenceMeasurementStep } from "./presenceMeasurement.js";
import { runBaseLimitStep } from "./baseLimits.js";
import type { MonthContext } from "./monthContext.js";
import type { PhaseDescriptor } from "./registry.js";
import { PhaseResource } from "./phase-resource.js";

type AutoResolutionManifest = Parameters<typeof resolveBattleAuto>[0]["manifest"];

export function runBattleGenerationPhase(ctx: MonthContext): void {
  const { campaignMonth, randomSeed } = ctx;

  const hadWars = (ctx.currentSnapshot["wars"]["wars"] ?? []).some(
    (w) => w["status"] === "ACTIVE" || w["status"] === "DECLARED_NOT_ACTIVE",
  );
  if (!hadWars) return;

  const generated = generateBattles({
    snapshot: ctx.currentSnapshot,
    campaignMonth,
    campaignSeed: randomSeed,
    rngVersion: "1",
    formulaVersion: "1",
    rulesetVersion: ctx.currentSnapshot["rulesetVersion"],
    contentVersion: "0.1.0",
    resolveStrength: (shipId) => resolveShipStrength(ctx.currentSnapshot, shipId),
    resolveShipType: resolveGenerationShipType,
    resolveReadiness: (shipId) => resolveCampaignBattleReadiness(ctx.currentSnapshot, shipId),
  });

  const surviving = applyEnemyDeclines(ctx, generated);
  const generationResult = applySupportForces(ctx, surviving);

  if (generationResult.battleIds.length === 0) return;

  const fleetsInArea = (nationId: string, areaId: string): string[] => {
    const nation = ctx.currentSnapshot["nations"].get(nationId);
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
  for (const [nid, nation] of ctx.currentSnapshot["nations"]) {
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

  ctx.currentSnapshot = {
    ...ctx.currentSnapshot,
    nations: updatedNations,
    wars: {
      ...ctx.currentSnapshot["wars"],
      battleManifests: [
        ...(ctx.currentSnapshot["wars"]["battleManifests"] ?? []),
        ...generationResult.manifests,
      ],
      battles: [...ctx.currentSnapshot["wars"]["battles"], ...newBattles],
    },
  };
}

export function runBattleResolutionPhase(ctx: MonthContext): void {
  const battles = ctx.currentSnapshot["wars"]["battles"].filter(
    (b) => b["phase"] === "pending" || b["phase"] === "resolving",
  );
  if (battles.length === 0) return;

  const randomEngine = ctx.phaseGuard.rng("battle_resolution", ctx.randomSeed)!;
  const resolver = new BattleResolver();

  for (const battle of battles) {
    resolveBattle(ctx, battle, resolver, randomEngine);
    if (ctx.interruption?.suspended !== undefined) return;
  }
}

function resolveViaLegacyPath(
  ctx: MonthContext,
  battle: BattleInstance,
  attacker: NationState,
  defender: NationState,
  randomEngine: RandomEngine,
  resolver: BattleResolver,
): void {
  ctx.currentSnapshot = resolveLegacyBattle(
    ctx.currentSnapshot,
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
  ctx: MonthContext,
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
    const manifest = offeredManifestFor(ctx.currentSnapshot, battle, ctx.playerNationId);
    if (manifest !== null) {
      const content = buildOfferContent({
        snapshot: ctx.currentSnapshot,
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

  const attacker = ctx.currentSnapshot["nations"].get(battle["attackerId"]);
  const defender = ctx.currentSnapshot["nations"].get(battle["defenderId"]);
  if (!attacker || !defender) {
    collector.addError("BATTLE_NATION_MISSING", `Nation not found for battle ${battle["id"]}`, {
      stage: "battle-resolution",
    });
    return;
  }

  const manifest = resolveBattleManifest(ctx.currentSnapshot, battle);
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

  const strategicWeather = ctx.currentSnapshot["strategicWeather"].find(
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
  ctx: MonthContext,
  battle: BattleInstance,
  attacker: NationState,
  defender: NationState,
  manifest: AutoResolutionManifest,
  strategicWeather: CampaignWeatherState,
  randomEngine: RandomEngine,
  resolver: BattleResolver,
): void {
  const { campaignMonth, collector, randomSeed, randomLedger } = ctx;

  try {
    const autoResult = resolveBattleAuto({
      battleId: battle["id"],
      areaId: battle["areaId"],
      campaignMonth,
      manifest,
      attacker: {
        nationId: attacker["id"],
        ships: attacker["fleets"].flatMap((f) => f["ships"]),
        designs: ctx.currentSnapshot["designs"],
        divisions: attacker["divisions"],
        officers: attacker["officers"],
      },
      defender: {
        nationId: defender["id"],
        ships: defender["fleets"].flatMap((f) => f["ships"]),
        designs: ctx.currentSnapshot["designs"],
        divisions: defender["divisions"],
        officers: defender["officers"],
      },
      strategicWeather,
      campaignSeed: randomSeed,
      rulesetVersion: ctx.currentSnapshot["rulesetVersion"],
      formulaVersion: manifest["formulaVersion"],
      rngVersion: manifest["rngVersion"],
      randomLedger,
    });

    if (autoResult.winnerId !== null && autoResult.loserId !== null) {
      ctx.currentSnapshot = applyBattleResult(
        ctx.currentSnapshot,
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

    const lostShips = collectLostShips(ctx.currentSnapshot, battle, autoResult, campaignMonth);
    ctx.currentSnapshot = applyBattleConsequences(ctx.currentSnapshot, battle, autoResult);
    ctx.currentSnapshot = recordResolvedBattle(
      ctx.currentSnapshot,
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

export const battleGenerationPhase: PhaseDescriptor = {
  id: "battle_generation",
  name: "Battle Generation",
  order: 75,
  readPermissions: ["wars", "fleets", "politics", "nations"],
  writePermissions: ["wars", "nations"],
  rngAllowed: true,
  footprint: {
    reads: [PhaseResource.WARS, PhaseResource.FLEETS, PhaseResource.NATIONS],
    writes: [PhaseResource.WARS, PhaseResource.NATIONS],
    usesRng: true,
  },
  run: (ctx) => {
    runBattleGenerationPhase(ctx);
    return { status: "continue" };
  },
};

export const battleResolutionPhase: PhaseDescriptor = {
  id: "battle_resolution",
  name: "Battle Resolution",
  order: 80,
  readPermissions: ["wars", "fleets", "nations", "strategicWeather", "designs"],
  writePermissions: ["wars", "fleets", "nations"],
  rngAllowed: true,
  footprint: {
    reads: [
      PhaseResource.WARS,
      PhaseResource.FLEETS,
      PhaseResource.NATIONS,
      PhaseResource.STRATEGIC_WEATHER,
      PhaseResource.DESIGNS,
    ],
    writes: [PhaseResource.WARS, PhaseResource.FLEETS, PhaseResource.NATIONS],
    usesRng: true,
  },
  run: (ctx) => {
    runBattleResolutionPhase(ctx);
    if (ctx.interruption?.suspended !== undefined) {
      return { status: "finish", success: true };
    }
    runForeignStationDeploymentStep(ctx, runPresenceMeasurementStep(ctx));
    runBaseLimitStep(ctx);
    return { status: "continue" };
  },
};
