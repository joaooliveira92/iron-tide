import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine, type RandomLedger } from "@bluewave/random";
import { BattleLedger, type BattleEvent } from "../battleLedger.js";
import { advanceMinute } from "../simulation/engine.js";
import {
  assertManifestValid,
  computeManifestHash,
  type BattleManifest,
} from "../generation/manifest.js";
import { BATTLE_SEED_FORMULA_VERSION, deriveBattleSeed } from "../generation/seed.js";
import type { GunneryBattery } from "../gunnery/resolve.js";
import { NO_TARGET, withGunneryStateHash } from "../gunnery/index.js";
import type { TacticalBattleState } from "../tactical/state.js";
import type { TacticalShipUnit } from "../tactical/unit.js";
import type { MovementState } from "../movement.js";
import type { ShipDamageState } from "../damage/state.js";
import type { StrategicWeatherState } from "../weather/strategic-state.js";
import { AUTO_RESOLUTION_UNAVAILABLE } from "../generation/reasonCodes.js";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "./reasonCodes.js";
import { CauseOfLossTracker, type LossCause } from "./causeOfLoss.js";
import { type AutoResolverNation, projectBattle, type ProjectBattleOutput } from "./project.js";
import { buildBattleWeather } from "./weather.js";
import {
  projectAirCombatContext,
  projectAirDefenseContext,
  projectSmokeContext,
} from "./capabilities.js";
import { planTorpedoCommands } from "./torpedoDoctrine.js";
import { pursuitOrders } from "./pursuit.js";
import { TORPEDO_HIT_RESOLVED, type TorpedoContext } from "../torpedoes/index.js";
import {
  battleLoss,
  initialDamageState,
  type DamageContext,
  type DamageTargetContext,
} from "./damage.js";
import {
  decideBattleEnd,
  type BattleSide,
  type ShipViability,
  type WithdrawalReason,
} from "./viability.js";
import { emptyTelemetry, finalizeTelemetry, type BattleTelemetry } from "./telemetry.js";
import { createDefaultDamageControlResource } from "../damage/damageControl.js";
import type { DamageControlContext } from "../damage/damageControlEngineWiring.js";
import { DAMAGE_RULESET_VERSION } from "../damage/constants.js";
import { DAMAGE_CONTROL_KEYED_DRAW } from "../damage/reasonCodes.js";
import { SPEED_BP_SCALE } from "../movement/constants.js";
import {
  AUTO_RESOLUTION_MAX_MINUTES,
  battleAutoResolutionPolicyId,
  BATTLE_AUTO_RESOLUTION_RULESET_VERSION,
  BATTLE_AUTO_RESOLUTION_FORMULA_VERSION,
} from "./constants.js";

export interface ResolveBattleAutoInput {
  battleId: string;
  areaId: string;
  campaignMonth: string;
  manifest: BattleManifest;
  attacker: AutoResolverNation;
  defender: AutoResolverNation;
  strategicWeather: StrategicWeatherState;
  campaignSeed: string;
  rulesetVersion: string;
  formulaVersion: string;
  rngVersion: string;
  maxMinutes?: number;
  randomLedger?: RandomLedger;
}

export interface BattleResolutionResult {
  battleId: string;
  battleEndReason: string;
  elapsedMinutes: number;
  winnerId: string | null;
  loserId: string | null;
  attackerSurvivorIds: string[];
  defenderSurvivorIds: string[];
  attackerSunkIds: string[];
  defenderSunkIds: string[];
  damageReport: Record<string, SafeInt>;
  eventLedgerHash: string;
  minuteHashes: string[];
  resultHash: string;
  causeOfLoss?: Record<string, LossCause>;
  withdrawalReason?: WithdrawalReason;
  telemetry?: BattleTelemetry;
  torpedoSummary?: { tubesFired: number; hits: number };
  smokeActivity?: { events: number };
  airCombatActivity?: { capEngagements: number; strikeAttacks: number; losses: number };
  airDefenseActivity?: {
    engagements: number;
    kills: number;
    aborts: number;
    disruptions: number;
  };
  provenance: {
    battleId: string;
    manifestHash: string;
    campaignAssetIds: string[];
  };
}

function squaredDistance(
  a: readonly [number, number] | undefined,
  b: readonly [number, number] | undefined,
): number {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dx = a[0]! - b[0]!;
  const dy = a[1]! - b[1]!;
  return dx * dx + dy * dy;
}

export function assignTargetContactIds(
  batteries: readonly GunneryBattery[],
  battleState: TacticalBattleState,
  damage: DamageContext,
  battleId: string,
  units: readonly TacticalShipUnit[],
): Record<string, string> {
  const contacts = new Set(battleState.contacts?.map((c) => c.contactId) ?? []);
  const movement = battleState.movementStates ?? {};
  const out: Record<string, string> = {};
  for (const b of batteries) {
    const shooterPos = movement[b.ownerShipId]?.position;
    let best: { assetId: string; key: string; d2: number } | null = null;
    for (const enemy of units) {
      if (enemy.sideId === b.sideId) continue;
      const key = `${battleId}:${enemy.assetId}`;
      if (!contacts.has(key)) continue;
      const state = damage.targets[enemy.assetId]?.state;
      if (state && state.terminalStatus !== "NORMAL") continue;
      const d2 = squaredDistance(shooterPos, movement[enemy.assetId]?.position);
      if (!best || d2 < best.d2 || (d2 === best.d2 && enemy.assetId < best.assetId)) {
        best = { assetId: enemy.assetId, key, d2 };
      }
    }
    out[b.id] = best?.key ?? NO_TARGET;
  }
  return out;
}

export function mergeTargetStates(
  targets: Record<string, DamageTargetContext>,
  states: Record<string, ShipDamageState>,
): Record<string, DamageTargetContext> {
  const out: Record<string, DamageTargetContext> = { ...targets };
  for (const [shipId, state] of Object.entries(states)) {
    const t = out[shipId];
    if (t) out[shipId] = { ...t, state };
  }
  return out;
}

export function buildDamageControlContexts(input: {
  battleId: string;
  minute: number;
  units: readonly TacticalShipUnit[];
  damage: DamageContext;
  movementStates: Record<string, MovementState> | undefined;
  engine: RandomEngine;
  randomLedger?: RandomLedger;
}): Record<string, DamageControlContext> {
  const { battleId, minute, units, damage, movementStates, engine, randomLedger } = input;
  const contexts: Record<string, DamageControlContext> = {};
  const shipIds = units.map((u) => u.assetId).sort();
  for (const shipId of shipIds) {
    const target = damage.targets[shipId];
    if (!target) continue;
    const state = target.state;
    const currentSpeedBp = movementStates?.[shipId]?.currentSpeed ?? 0;
    let drawCall = 0;
    const scopedRng = (stream: string): number => {
      const ordinal = drawCall;
      drawCall += 1;
      const domain = `${stream}:${battleId}:${minute}:${shipId}:${ordinal}`;
      const draw = engine.stream(domain).next();
      if (randomLedger) {
        randomLedger.record({
          streamId: domain,
          entityKey: shipId,
          phase: "resolve_battle_auto_resolution_damage_control",
          rulesetVersion: DAMAGE_RULESET_VERSION,
          inputHash: sha256Hex(
            canonicalSerialize({
              battleId,
              minute,
              shipId,
              stream,
              drawCall: ordinal,
            }),
          ),
          draw,
          outcome: String(draw),
          reasonCode: DAMAGE_CONTROL_KEYED_DRAW,
        });
      }
      return draw;
    };
    contexts[shipId] = {
      fireRecords: [...state.fireRecords],
      floodingRecords: [...state.floodingRecords],
      floodedWaterBp: state.progressiveFloodingTotal,
      designDisplacementKg: target.designDisplacementKg,
      shipType: target.shipType,
      currentSpeedKt: Math.floor(currentSpeedBp / SPEED_BP_SCALE),
      resources: createDefaultDamageControlResource(),
      keyedRng: scopedRng,
    };
  }
  return contexts;
}

export function resolveBattleAuto(input: ResolveBattleAutoInput): BattleResolutionResult {
  if (!input.manifest) {
    throw new BluewaveError(AUTO_RESOLUTION_UNAVAILABLE, {
      code: AUTO_RESOLUTION_UNAVAILABLE,
      reason: "battle auto-resolution requires a battle manifest",
      battleId: input.battleId,
    });
  }
  assertManifestValid(input.manifest, { battleId: input.battleId });
  if (input.battleId !== input.manifest.battleId) {
    throw new BluewaveError(AUTO_RESOLUTION_UNAVAILABLE, {
      code: AUTO_RESOLUTION_UNAVAILABLE,
      battleId: input.battleId,
      manifestBattleId: input.manifest.battleId,
      reason: "input battleId must equal the manifest battleId",
    });
  }
  if (!input.attacker || !input.defender) {
    throw new BluewaveError(AUTO_RESOLUTION_UNAVAILABLE, {
      code: AUTO_RESOLUTION_UNAVAILABLE,
      battleId: input.battleId,
      reason: "auto-resolution requires both combatant nation states",
    });
  }
  const attackerParticipants = input.manifest.sides.find(
    (s) => s.sideId === "ATTACKER",
  )?.participantIds;
  const defenderParticipants = input.manifest.sides.find(
    (s) => s.sideId === "DEFENDER",
  )?.participantIds;
  if (!attackerParticipants || !defenderParticipants) {
    throw new BluewaveError(AUTO_RESOLUTION_UNAVAILABLE, {
      code: AUTO_RESOLUTION_UNAVAILABLE,
      reason: "manifest sides must declare ATTACKER and DEFENDER participant lists",
    });
  }
  if (
    !attackerParticipants.includes(input.attacker.nationId) ||
    !defenderParticipants.includes(input.defender.nationId)
  ) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      attackerNationId: input.attacker.nationId,
      defenderNationId: input.defender.nationId,
      reason: "combatant nation not listed on its manifest side participant list",
    });
  }
  const maxMinutes: number = input.maxMinutes ?? AUTO_RESOLUTION_MAX_MINUTES;
  if (!Number.isInteger(maxMinutes) || maxMinutes <= 0) {
    throw new BluewaveError(AUTO_RESOLUTION_UNAVAILABLE, {
      code: AUTO_RESOLUTION_UNAVAILABLE,
      maxMinutes,
      reason: "maxMinutes must be a positive integer",
    });
  }

  const battleSeed = deriveBattleSeed(
    {
      rngVersion: input.rngVersion,
      campaignSeed: input.campaignSeed,
      campaignMonth: input.campaignMonth,
      warId: input.manifest.warId,
      areaId: input.areaId,
      missionType: input.manifest.missionType,
      opportunityId: input.manifest.opportunityId,
      battleGenerationFormulaVersion: BATTLE_SEED_FORMULA_VERSION,
    },
    input.manifest,
  );
  const manifestHash = computeManifestHash(input.manifest);
  const engine = new RandomEngine(battleSeed);

  const projected: ProjectBattleOutput = projectBattle({
    manifest: input.manifest,
    areaId: input.areaId,
    campaignMonth: input.campaignMonth,
    attacker: input.attacker,
    defender: input.defender,
    rulesetVersion: input.rulesetVersion,
  });
  const attackerCount = unitsOf(projected, "ATTACKER").length;
  const defenderCount = unitsOf(projected, "DEFENDER").length;
  if (attackerCount === 0 || defenderCount === 0) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      attackerCount,
      defenderCount,
      reason: "both sides require at least one committed, promotable ship",
    });
  }

  const weather = buildBattleWeather({
    battleId: input.manifest.battleId,
    areaId: input.areaId,
    campaignMonth: input.campaignMonth,
    strategicWeather: input.strategicWeather,
    battleSeed,
    randomLedger: input.randomLedger,
  });

  let battleState: TacticalBattleState = {
    ...projected.state,
    contacts: [...(projected.state.contacts ?? [])],
    movementStates: { ...projected.state.movementStates },
  };
  let gunnery: GunneryBattery[] = [...projected.batteries];
  let damage: DamageContext = { ...projected.damage, engine, randomLedger: input.randomLedger };
  let weatherCtx = weather.context;
  let torpedo: TorpedoContext | undefined = projected.torpedoes;
  const torpedoSummary = { tubesFired: 0, hits: 0 };
  let smoke = projectSmokeContext(input.manifest, weather.context.components);
  let airCombat = projectAirCombatContext(input.manifest, projected.state.battleId);
  let airDefense = projectAirDefenseContext(input.manifest, engine);
  let smokeEventCount = 0;
  const airCombatActivity = { capEngagements: 0, strikeAttacks: 0, losses: 0 };
  const airDefenseActivity = { engagements: 0, kills: 0, aborts: 0, disruptions: 0 };
  const lossTracker = new CauseOfLossTracker();
  const telemetry = emptyTelemetry();

  const allEvents: BattleEvent[] = [];
  const minuteHashes: string[] = [];
  let endReason = "";
  let eliminatedSide: BattleSide | null = null;
  let withdrawnSide: BattleSide | null = null;
  let withdrawalReason: WithdrawalReason | undefined;
  const observationTime = `${weather.battleDate}T06:00:00.000Z`;
  let elapsedMinutes = 0;

  for (let minute = 1; minute <= maxMinutes; minute++) {
    const targets = assignTargetContactIds(
      gunnery,
      battleState,
      damage,
      projected.state.battleId,
      projected.units,
    );
    gunnery = gunnery.map((b) => {
      const t = targets[b.id];
      return t !== undefined
        ? { ...b, state: withGunneryStateHash({ ...b.state, targetContactId: t }) }
        : b;
    });

    if (torpedo) {
      const targets = { ...torpedo.targets };
      for (const [shipId, t] of Object.entries(targets)) {
        const st = damage.targets[shipId]?.state;
        if (st) targets[shipId] = { ...t, damageState: st };
      }
      torpedo = { ...torpedo, targets };
      torpedo = {
        ...torpedo,
        commands: planTorpedoCommands({
          battleId: projected.state.battleId,
          torpedoes: torpedo,
          battleState,
          damage,
          units: projected.units,
        }),
      };
      torpedoSummary.tubesFired += torpedo.commands.reduce((n, c) => n + c.tubeIndexes.length, 0);
    }

    const damageControl = buildDamageControlContexts({
      battleId: projected.state.battleId,
      minute,
      units: projected.units,
      damage,
      movementStates: battleState.movementStates,
      engine,
      randomLedger: input.randomLedger,
    });

    const res = advanceMinute({
      state: battleState,
      minute,
      observationTime,
      orders: pursuitOrders({
        battleId: projected.state.battleId,
        battleState,
        damage,
        units: projected.units,
        baseOrders: projected.orders,
      }),
      engine,
      gunnery,
      weather: weatherCtx,
      damage,
      ...(torpedo ? { torpedoes: torpedo } : {}),
      ...(damageControl ? { damageControl } : {}),
      smoke,
      airCombat,
      airDefense,
    });

    allEvents.push(...res.events);
    minuteHashes.push(res.minuteHash);
    elapsedMinutes = minute;

    if (res.smokeRecords) smokeEventCount += res.smokeRecords.length;
    if (res.airCombatSummary) {
      airCombatActivity.capEngagements += res.airCombatSummary.capEngagements;
      airCombatActivity.strikeAttacks += res.airCombatSummary.strikeAttacks;
      airCombatActivity.losses += res.airCombatSummary.losses;
    }
    if (res.airDefenseRecords) {
      for (const rec of res.airDefenseRecords) {
        if (rec.outcome === "INELIGIBLE") continue;
        airDefenseActivity.engagements += 1;
        if (rec.outcome === "KILL") airDefenseActivity.kills += 1;
        else if (rec.outcome === "ABORT") airDefenseActivity.aborts += 1;
        else if (rec.outcome === "DISRUPTION") airDefenseActivity.disruptions += 1;
      }
    }

    if (res.gunneryRecords) {
      for (const rec of res.gunneryRecords) {
        telemetry.salvosFired += 1;
        telemetry.roundsExpended += Math.max(0, rec.ammunition.before - rec.ammunition.after);
        if (rec.outcome === "HIT") telemetry.hits += 1;
        else telemetry.misses += 1;
      }
    }

    battleState = {
      ...battleState,
      contacts: res.contacts.map((c) => ({ ...c })),
      movementStates: Object.fromEntries(
        Object.entries(res.movementStates).map(([k, v]) => [k, { ...v }]),
      ),
    };
    if (res.gunneryStates) {
      gunnery = gunnery.map((b) => {
        const ns = res.gunneryStates![b.id];
        return ns ? { ...b, state: ns } : b;
      });
    }
    if (res.weatherComponents) {
      weatherCtx = { ...weatherCtx, components: res.weatherComponents };
    }
    if (res.damageStates) {
      const preTargets = damage.targets;
      damage = { ...damage, targets: mergeTargetStates(damage.targets, res.damageStates) };
      const hitKeys = new Set(
        (res.torpedoRecords ?? [])
          .filter(
            (r) =>
              r.kind === "HIT_RESOLUTION" && r.damageEffects.reasonCode === TORPEDO_HIT_RESOLVED,
          )
          .map((r) => r.targetId),
      );
      for (const [shipId, post] of Object.entries(res.damageStates)) {
        const pre = preTargets[shipId]?.state;
        if (pre)
          lossTracker.observe(
            shipId,
            pre,
            post,
            hitKeys.has(`${projected.state.battleId}:${shipId}`),
          );
      }
    }
    if (torpedo) {
      torpedoSummary.hits += (res.torpedoRecords ?? []).filter(
        (r) => r.kind === "HIT_RESOLUTION" && r.damageEffects.reasonCode === TORPEDO_HIT_RESOLVED,
      ).length;
      const launcherStates = res.torpedoStates;
      torpedo = {
        ...torpedo,
        commands: [],
        tracks: (res.torpedoTracks ?? []).map((t) => ({ ...t })),
        launchers: launcherStates
          ? torpedo.launchers.map((w) => {
              const next = launcherStates[w.launcher.launcherId];
              return next ? { ...w, launcher: next } : w;
            })
          : torpedo.launchers,
      };
    }

    if (res.smokeClouds) smoke = { ...smoke, clouds: res.smokeClouds };
    if (res.airCombatRecords) {
      airCombat = { ...airCombat, existingRecords: res.airCombatRecords.map((r) => ({ ...r })) };
    }
    if (res.airDefenseStates) {
      const nextStates = res.airDefenseStates;
      airDefense = {
        ...airDefense,
        defenders: airDefense.defenders.map((d) => {
          const ns = nextStates[d.state.defenderId];
          return ns ? { ...d, state: ns } : d;
        }),
      };
    }

    const viabilities: ShipViability[] = projected.units.map((u) => ({
      assetId: u.assetId,
      sideId: u.sideId as BattleSide,
      damageState: damage.targets[u.assetId]?.state ?? initialDamageState(u.assetId),
    }));
    const decision = decideBattleEnd(viabilities, minute, maxMinutes);
    if (decision.ended) {
      endReason = decision.reason!;
      eliminatedSide = decision.eliminatedSide ?? null;
      withdrawnSide = decision.withdrawnSide ?? null;
      withdrawalReason = decision.withdrawalReason;
      break;
    }
  }

  if (endReason === "") {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      battleId: input.manifest.battleId,
      reason: "minute loop exhausted without a §32 battle-end decision",
    });
  }

  const attackerShips = unitsOf(projected, "ATTACKER");
  const defenderShips = unitsOf(projected, "DEFENDER");
  const sunkOf = (ships: readonly TacticalShipUnit[]): string[] =>
    ships
      .filter((u) => {
        const st = damage.targets[u.assetId]?.state;
        if (!st) {
          throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
            code: BATTLE_AUTO_RESOLUTION_FAILED,
            battleId: input.manifest.battleId,
            shipId: u.assetId,
            reason: "projected unit has no damage target at result assembly",
          });
        }
        return st.terminalStatus !== "NORMAL";
      })
      .map((u) => u.assetId)
      .sort();

  const attackerSunkIds = sunkOf(attackerShips);
  const defenderSunkIds = sunkOf(defenderShips);
  const attackerSurvivorIds = attackerShips
    .map((u) => u.assetId)
    .sort()
    .filter((id) => !attackerSunkIds.includes(id));
  const defenderSurvivorIds = defenderShips
    .map((u) => u.assetId)
    .sort()
    .filter((id) => !defenderSunkIds.includes(id));

  const damageReport: Record<string, SafeInt> = {};
  for (const u of projected.units) {
    const st = damage.targets[u.assetId]?.state;
    if (!st) continue;
    damageReport[u.assetId] = battleLoss(u.hitPoints as number, st, u.maxHitPoints as number);
  }

  let winnerId: string | null = null;
  let loserId: string | null = null;
  if (endReason === "no_viable_combatants") {
    if (eliminatedSide === "ATTACKER") {
      winnerId = input.defender.nationId;
      loserId = input.attacker.nationId;
    } else if (eliminatedSide === "DEFENDER") {
      winnerId = input.attacker.nationId;
      loserId = input.defender.nationId;
    }
  } else if (endReason === "withdrawal_complete") {
    if (withdrawnSide === "ATTACKER") {
      winnerId = input.defender.nationId;
      loserId = input.attacker.nationId;
    } else if (withdrawnSide === "DEFENDER") {
      winnerId = input.attacker.nationId;
      loserId = input.defender.nationId;
    }
  }

  const ledger = new BattleLedger();
  for (const e of allEvents) ledger.append(e);

  const campaignAssetIds = [...new Set(projected.units.map((u) => u.assetId))].sort();
  const provenance = {
    battleId: input.manifest.battleId,
    manifestHash,
    campaignAssetIds,
  };

  const causeOfLoss: Record<string, LossCause> = {};
  for (const id of [...attackerSunkIds, ...defenderSunkIds].sort()) {
    causeOfLoss[id] = lossTracker.causeOf(id) ?? "gunfire";
  }

  const result: BattleResolutionResult = {
    battleId: input.manifest.battleId,
    battleEndReason: endReason,
    elapsedMinutes,
    winnerId,
    loserId,
    attackerSurvivorIds,
    defenderSurvivorIds,
    attackerSunkIds,
    defenderSunkIds,
    damageReport,
    eventLedgerHash: ledger.hash(),
    minuteHashes,
    resultHash: "",
    ...(projected.torpedoes ? { torpedoSummary } : {}),
    ...(Object.keys(causeOfLoss).length > 0 ? { causeOfLoss } : {}),
    ...(withdrawalReason ? { withdrawalReason } : {}),
    ...(smokeEventCount > 0 ? { smokeActivity: { events: smokeEventCount } } : {}),
    ...(airCombatActivity.capEngagements + airCombatActivity.strikeAttacks > 0
      ? { airCombatActivity }
      : {}),
    ...(airDefenseActivity.engagements > 0 ? { airDefenseActivity } : {}),
    telemetry: finalizeTelemetry(telemetry),
    provenance,
  };
  const {
    resultHash: _hash,
    causeOfLoss: _cause,
    withdrawalReason: _withdrawalReason,
    telemetry: _telemetry,
    smokeActivity: _smoke,
    airCombatActivity: _airCombat,
    airDefenseActivity: _airDefense,
    ...hashBody
  } = result;
  result.resultHash = createEnvelope(
    "battle-auto-resolution-result",
    battleAutoResolutionPolicyId,
    {
      ...hashBody,
      rulesetVersion: BATTLE_AUTO_RESOLUTION_RULESET_VERSION,
      formulaVersion: BATTLE_AUTO_RESOLUTION_FORMULA_VERSION,
      inputFormulaVersion: input.formulaVersion,
      inputRngVersion: input.rngVersion,
      inputRulesetVersion: input.rulesetVersion,
    },
  ).bodyHash;

  return result;
}

function unitsOf(p: ProjectBattleOutput, sideId: string): TacticalShipUnit[] {
  return p.units.filter((u) => u.sideId === sideId);
}
