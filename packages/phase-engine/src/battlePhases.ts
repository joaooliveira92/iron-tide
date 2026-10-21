// Battle phases: battle_generation (order 75) and battle_resolution (order 80).
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

// Phase 9.5: battle_generation (order 75). Generates BattleInstances + manifests
// for reachable missions from committed post-construction state; feeds
// battle_resolution (phase 10) unchanged. No-op path keeps the new collections
// ABSENT so a no-war month's final-state hash is unchanged (AC-12 pin). Uses no
// randomness for reachable missions in B-1.
export function runBattleGenerationPhase(ctx: MonthContext): void {
  const { campaignMonth, randomSeed } = ctx;

  const hadWars = (ctx.currentSnapshot["wars"]["wars"] ?? []).some(
    (w) => w["status"] === "ACTIVE" || w["status"] === "DECLARED_NOT_ACTIVE",
  );
  if (!hadWars) return;

  // S-1 D5: supply each ship's real battle readiness (its crew quality, 0..100)
  // instead of the former hard-coded 80 (ADR-0223).
  const generated = generateBattles({
    snapshot: ctx.currentSnapshot,
    campaignMonth,
    campaignSeed: randomSeed,
    rngVersion: "1",
    formulaVersion: "1",
    rulesetVersion: ctx.currentSnapshot["rulesetVersion"],
    contentVersion: "0.1.0",
    resolveStrength: (shipId) => resolveShipStrength(ctx.currentSnapshot, shipId),
    resolveShipType: () => "BB",
    resolveReadiness: (shipId) => resolveCampaignBattleReadiness(ctx.currentSnapshot, shipId),
  });

  // T-1 07 (spec #109 R11): the enemy may decline a battle with the player before it exists. Dormant (the same object)
  // without the battle-offer section and the player nation.
  const surviving = applyEnemyDeclines(ctx, generated);
  // T-1 08 (spec #109 R12): a friendly AI support force may join the player's side of a battle that exists. Dormant (the
  // same object) without the battle-offer section and the player nation.
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

  // Apply reservations: mark ships in battle.
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

// Phase 10: battle_resolution (registry order 8). B-6 INC-3 (AC-8):
// manifest-carrying pending/resolving battles resolve deterministically via
// `resolveBattleAuto` (@bluewave/combat, INC-2) with the campaign's committed
// ships/divisions/weather for that battle; the result feeds the UNCHANGED A-3
// `applyBattleResult` for DECIDED battles, applies per-ship damage/loss +
// reservation clearing (AC-9), and records `BattleInstance.result` + phase
// "resolved".
//
// - A battle WITHOUT a manifest keeps the M1 `BattleResolver` strength path.
// - A manifest battle whose auto-resolution fails closed records the stable
//   diagnostic and falls back to the same legacy path.
// - A battle whose `manifestHash` matches NO stored manifest is a broken
//   invariant: stable diagnostic + NO mutation (battle stays pending).
// - Null winner/loser (ADR-0026 §7): `applyBattleResult` is called ONLY for
//   decided battles; a tie still records damage/loss, the result, and clearing.
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

  // T-1 03 (spec #109 R3): with a channel, the player nation and the battle-offer ruleset section, a pending battle that
  // involves the player is a player-facing offer. An absent or refused answer suspends the month; an accept or delegate
  // falls through to the unchanged auto-resolution below. Every other battle auto-resolves unchanged.
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
        // A declined battle is terminal: it is never resolved or fought (spec #109 R8).
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
      }
    }
  } else if (ctx.interruption !== undefined) {
    // Additive interruption seam: when a channel is active a pending battle is a
    // player-facing request. A present, hash-valid recorded result is applied exactly
    // once (never re-rolled); an absent one suspends the month. With no channel the
    // pipeline auto-resolves exactly as before.
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

  // Two fail-fast branches, then `manifest` is guaranteed non-null for the
  // tactical auto-resolution path below (narrowed by the union):
  //  - no manifestHash -> M1 legacy strength path, unchanged;
  //  - manifestHash with NO matching stored manifest -> corrupted invariant.
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

  // Tactical auto-resolution (AC-3 fail-closed: the battle area MUST have
  // committed strategic weather from the weather_generation phase).
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

    // A-3 war-score path, UNCHANGED — but only for DECIDED battles. A tie /
    // time-limit end (both winnerId and loserId null, ADR-0026 §7) contributes
    // NO war score, NO victory class, NO contribution delta; it still applies
    // ship damage/loss, records the battle result, and clears reservations.
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

    // ADR-0061: record who was lost BEFORE the ships leave their fleets.
    const lostShips = collectLostShips(ctx.currentSnapshot, battle, autoResult, campaignMonth);
    ctx.currentSnapshot = applyBattleConsequences(ctx.currentSnapshot, battle, autoResult);
    ctx.currentSnapshot = recordResolvedBattle(
      ctx.currentSnapshot,
      battle,
      toCampaignBattleResult(autoResult, lostShips),
    );
  } catch (e) {
    // Fail-closed auto-resolution: INC-2 throws a stable BluewaveError code
    // BEFORE any consequence is applied. Record the diagnostic and resolve via
    // the accepted M1 legacy path — never crash, never a partial mutation.
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
  // ADR-0036: battle_generation reads the nations map (ship strength/
  // readiness) and writes wars (battles + manifests) plus nations (ship
  // inBattleId reservations).
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
  // ADR-0036: battle_resolution reads committed strategic weather + the
  // nations map and writes wars + fleets + nations (per-ship damage/loss
  // and reservation clearing). S-5: its month-end presence step also reads
  // compiled designs (ship tonnage) and writes nothing but events.
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
    // S-5 month-end steps in the battle_resolution footprint: presence is
    // measured after movement and battle resolution (spec #73 R5/R6), then
    // foreign-station ships route one hop toward the largest shortfall, and
    // base limits are checked last so battles this month saw the full fleet
    // (spec #73 R10). Each is dormant (a strict no-op) unless the pack authors
    // the presence ruleset section.
    runForeignStationDeploymentStep(ctx, runPresenceMeasurementStep(ctx));
    runBaseLimitStep(ctx);
    return { status: "continue" };
  },
};
