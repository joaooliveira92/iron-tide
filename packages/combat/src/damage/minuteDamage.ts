import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { RandomEngine, RandomLedger, drawUniform } from "@bluewave/random";
import type { GunneryEventRecord } from "../gunnery/event.js";
import type { TacticalContact } from "../contact/neighbour.js";
import type { BattleEvent } from "../core/battleLedger.js";
import { type GunneryImpact, resolveDamage } from "./engineWiring.js";
import {
  type FireRecord,
  type FloodingSourceRecord,
  type ShipDamageState,
  withDamageStateHash,
} from "./state.js";
import { DAMAGE_RULESET_VERSION, DAMAGE_FORMULA_VERSION } from "./constants.js";
import { DAMAGE_KEYED_DRAW } from "./reasonCodes.js";
import {
  determinePenetrationOutcome,
  lookupArmorQualityMultiplierBp,
  manufacturingEffectiveThickness,
  type PenetrationOutcome,
} from "./armorModel.js";
import { type SplinterIntensity } from "./componentDamage.js";
import {
  AUTO_RESOLUTION_COMPARTMENTS,
  BATTLE_AUTO_RESOLUTION_FAILED,
  AUTO_RESOLUTION_COMPONENTS,
  ARMOR_QUALITY_FAMILY,
  FLOAT_LOSS_RATIO_BP,
  FLOAT_UNIT,
  HIT_DAMAGE_OUTCOME_BP,
  HIT_STRUCTURAL_DAMAGE_BASE,
  PARTIAL_BREACH_FLOAT_LOSS_RATIO_BP,
  PARTIAL_BREACH_MIN_RATIO_BP,
  SHELL_IMPACT_ANGLE_DEG,
  SHELL_MUZZLE_VELOCITY_MS,
  STABILITY_INITIAL_BP,
  STRUCTURE_UNIT,
  type AutoResolutionZone,
  type AutoResolutionZoneId,
  ZONE_HIT_WEIGHT_BP,
} from "./minuteDamageConstants.js";

export const DAMAGE_SUBSTEP = 3 as const;
export const DAMAGE_EVENT_PRIORITY = 10 as const;
export const DAMAGE_EVENT_TYPE = "damage_impact" as const;

export interface DamageTargetContext {
  shipId: string;
  zones: readonly AutoResolutionZone[];
  compartments: readonly string[];
  components: readonly string[];
  state: ShipDamageState;
  designFlotationReserve: number;
  designStabilityScore: number;
  designDisplacementKg: number;
  beltArmorUm: number;
  mainGunsCaliberUm: number;
  shipType: string;
  maxHitPoints: number;
}

export interface DamageContext {
  battleId: string;
  targets: Record<string, DamageTargetContext>;
  engine?: RandomEngine;
  randomLedger?: RandomLedger;
}

export function initialDamageState(shipId: string): ShipDamageState {
  return withDamageStateHash({
    shipId,
    compartments: [...AUTO_RESOLUTION_COMPARTMENTS],
    components: [...AUTO_RESOLUTION_COMPONENTS],
    structuralIntegrity: STRUCTURE_UNIT,
    flotationReserve: FLOAT_UNIT,
    stabilityScore: STABILITY_INITIAL_BP,
    fireRecords: [],
    floodingRecords: [],
    progressiveFloodingTotal: 0,
    performanceModifiers: {},
    terminalStatus: "NORMAL",
    rulesetVersion: DAMAGE_RULESET_VERSION,
    formulaVersion: DAMAGE_FORMULA_VERSION,
  });
}

function clampBp(v: number): number {
  if (v < 0) return 0;
  if (v > 10_000) return 10_000;
  return v;
}

export function hpOfState(state: ShipDamageState, maxHitPoints: number): SafeInt {
  if (state.terminalStatus !== "NORMAL") return SafeInt(0);
  const structuralBp = clampBp(Math.floor((state.structuralIntegrity * 10_000) / STRUCTURE_UNIT));
  const flotationBp = clampBp(Math.floor((state.flotationReserve * 10_000) / FLOAT_UNIT));
  const fractionBp = Math.floor((structuralBp + flotationBp) / 2);
  const hp = Math.floor((maxHitPoints * fractionBp) / 10_000);
  return SafeInt(Math.max(0, Math.min(maxHitPoints, hp)));
}

export function battleLoss(
  battleStartHitPoints: number,
  state: ShipDamageState,
  maxHitPoints: number,
): SafeInt {
  return SafeInt(Math.max(0, battleStartHitPoints - (hpOfState(state, maxHitPoints) as number)));
}

export function splinterIntensityForOutcome(outcome: PenetrationOutcome): SplinterIntensity {
  switch (outcome) {
    case "SPLINTER_EFFECT":
      return "LIGHT";
    case "PARTIAL_PENETRATION":
      return "MEDIUM";
    default:
      return "NONE";
  }
}

export function effectiveResistanceUm(zone: { thicknessUm: number }): number {
  const armored = manufacturingEffectiveThickness(zone.thicknessUm);
  const qualityBp = lookupArmorQualityMultiplierBp(ARMOR_QUALITY_FAMILY);
  return Math.floor((armored * qualityBp) / 10_000);
}

export const CALIBER_CANONICAL_UNIT = "micrometre" as const;
export const MICROMETRES_PER_MILLIMETRE = 1_000 as const;

export function shellPenetrationUm(caliberUm: number, velocityMS: number): number {
  if (!Number.isFinite(caliberUm) || caliberUm <= 0) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      reason: "caliber must be a positive finite micrometre value",
      caliberUm,
    });
  }
  if (!Number.isFinite(velocityMS) || velocityMS < 0) {
    throw new BluewaveError(BATTLE_AUTO_RESOLUTION_FAILED, {
      code: BATTLE_AUTO_RESOLUTION_FAILED,
      reason: "shell velocity must be a non-negative finite value",
      velocityMS,
    });
  }
  return Math.floor((caliberUm * velocityMS) / MICROMETRES_PER_MILLIMETRE);
}

const HULL_BREACH_OUTCOMES: ReadonlySet<string> = new Set([
  "FULL_PENETRATION",
  "CRITICAL_PENETRATION",
  "PASS_THROUGH",
]);

const WATERLINE_ZONES: ReadonlySet<string> = new Set(["BELT", "MAGAZINE"]);

export interface SynthesizeImpactInput {
  salvo: GunneryEventRecord;
  targetShipId: string;
  zone: AutoResolutionZone;
  beltArmorUm: number;
  mainGunsCaliberUm: number;
  shipType: string;
}

export function synthesizeImpact(input: SynthesizeImpactInput): GunneryImpact {
  const { salvo, targetShipId, zone, mainGunsCaliberUm, shipType } = input;
  const hitLocation = zone.id;
  const effectiveResistance = effectiveResistanceUm(zone);
  const penetrationCapability =
    mainGunsCaliberUm > 0 ? shellPenetrationUm(mainGunsCaliberUm, SHELL_MUZZLE_VELOCITY_MS) : 0;
  const penetrationOutcome = determinePenetrationOutcome(
    penetrationCapability,
    effectiveResistance,
    SHELL_IMPACT_ANGLE_DEG,
    zone.critical,
  );
  const splinterIntensity = splinterIntensityForOutcome(penetrationOutcome);

  const dmgBp = HIT_DAMAGE_OUTCOME_BP[penetrationOutcome] as number;
  const structuralDamage = Math.floor((HIT_STRUCTURAL_DAMAGE_BASE * dmgBp) / 10_000);
  const waterline = WATERLINE_ZONES.has(zone.id);
  const fullBreach = waterline && HULL_BREACH_OUTCOMES.has(penetrationOutcome);
  const nearPenetration =
    penetrationCapability * 10_000 >= effectiveResistance * PARTIAL_BREACH_MIN_RATIO_BP;
  const partialBreach =
    waterline && penetrationOutcome === "PARTIAL_PENETRATION" && nearPenetration;
  const hullBreach = fullBreach || partialBreach;
  const flotationRatioBp = partialBreach ? PARTIAL_BREACH_FLOAT_LOSS_RATIO_BP : FLOAT_LOSS_RATIO_BP;
  const flotationDamage = hullBreach
    ? Math.floor((structuralDamage * flotationRatioBp) / 10_000)
    : 0;

  return {
    sourceId: salvo.batteryId,
    weaponId: salvo.batteryId,
    targetShipId,
    hitLocation,
    penetrationOutcome,
    splinterIntensity,
    effectiveResistanceUm: effectiveResistance,
    penetrationMargin: penetrationCapability - effectiveResistance,
    structuralDamage,
    flotationDamage,
    shipType,
    hasCombustible: true,
    hasOxygen: true,
    hullBreach,
    hasWaterRoute: hullBreach,
    hasMagazineInZone: zone.critical,
    hitZoneType: zone.id,
    catastrophicBreakup: false,
    capsizeRisk: false,
    designFlotationReserve: FLOAT_UNIT,
    designStabilityScore: STABILITY_INITIAL_BP,
  };
}

function assetIdForContact(contactId: string, contacts: readonly TacticalContact[]): string {
  for (const c of contacts) {
    if (c.contactId === contactId) return c.assetId;
  }
  return "";
}

export interface ResolveMinuteDamageInput {
  battleId: string;
  minute: number;
  salvos: readonly GunneryEventRecord[];
  contacts: readonly TacticalContact[];
  targets: Record<string, DamageTargetContext>;
  engine?: RandomEngine;
  randomLedger?: RandomLedger;
  extraImpacts?: Readonly<Record<string, readonly GunneryImpact[]>>;
}

export interface ResolveMinuteDamageOutput {
  events: BattleEvent[];
  states: Record<string, ShipDamageState>;
  updatedTargets: Record<string, DamageTargetContext>;
}

export function resolveMinuteDamage(input: ResolveMinuteDamageInput): ResolveMinuteDamageOutput {
  const { battleId, minute, salvos, contacts, targets, engine, randomLedger } = input;
  const events: BattleEvent[] = [];
  const states: Record<string, ShipDamageState> = {};
  const updatedTargets: Record<string, DamageTargetContext> = {};
  const byTarget = new Map<string, GunneryImpact[]>();

  for (const salvo of salvos) {
    if (salvo.outcome !== "HIT") continue;
    const targetShipId = assetIdForContact(salvo.targetContactId, contacts);
    if (!targetShipId) continue;
    const target = targets[targetShipId];
    if (!target) continue;

    const zone = pickZone(engine, battleId, target, minute, salvo, randomLedger);

    const impact: GunneryImpact = synthesizeImpact({
      salvo,
      targetShipId,
      zone,
      beltArmorUm: target.beltArmorUm,
      mainGunsCaliberUm: target.mainGunsCaliberUm,
      shipType: target.shipType,
    });

    const list = byTarget.get(targetShipId) ?? [];
    list.push(impact);
    byTarget.set(targetShipId, list);
  }

  for (const [shipId, impacts] of Object.entries(input.extraImpacts ?? {})) {
    if (impacts.length === 0) continue;
    if (!targets[shipId]) continue;
    const list = byTarget.get(shipId) ?? [];
    list.push(...impacts);
    byTarget.set(shipId, list);
  }

  const shipIds = [...byTarget.keys()].sort();
  for (const shipId of shipIds) {
    const impacts = byTarget.get(shipId) ?? [];
    if (impacts.length === 0) continue;
    const target = targets[shipId]!;

    let drawCall = 0;
    const scopedRng = (stream: string): number => {
      const domain = `${stream}:${battleId}:${minute}:${DAMAGE_SUBSTEP}:${drawCall}`;
      drawCall += 1;
      if (!engine) return 0;
      const draw = engine.stream(domain).next();
      if (randomLedger) {
        randomLedger.record({
          streamId: domain,
          entityKey: shipId,
          phase: "resolve_battle_auto_resolution_damage",
          rulesetVersion: DAMAGE_RULESET_VERSION,
          inputHash: sha256Hex(
            canonicalSerialize({
              battleId,
              minute,
              shipId,
              impacts: impacts.map((i) => i.targetShipId),
              stream,
            }),
          ),
          draw,
          outcome: String(draw),
          reasonCode: DAMAGE_KEYED_DRAW,
        });
      }
      return draw;
    };

    const { newState: resolvedState, events: damageEventRecords } = resolveDamage(
      target.state,
      impacts,
      minute,
      DAMAGE_SUBSTEP,
      scopedRng,
    );

    const newState = persistCreatedSources(resolvedState, damageEventRecords);

    for (const dmgEvent of damageEventRecords) {
      events.push({
        battleId,
        minute,
        substep: DAMAGE_SUBSTEP,
        eventPriority: DAMAGE_EVENT_PRIORITY,
        eventType: DAMAGE_EVENT_TYPE,
        actorId: dmgEvent.sourceId,
        targetId: dmgEvent.targetShipId,
        eventId: `${battleId}:${minute}:${DAMAGE_SUBSTEP}:${DAMAGE_EVENT_TYPE}:${dmgEvent.sourceId}:${dmgEvent.targetShipId}`,
        eventHash: dmgEvent.recordHash,
      });
    }

    states[shipId] = newState;
    updatedTargets[shipId] = { ...target, state: newState };
  }

  return { events, states, updatedTargets };
}

export function persistCreatedSources(
  state: ShipDamageState,
  records: readonly {
    createdFireSources: readonly FireRecord[];
    createdFloodingSources: readonly FloodingSourceRecord[];
  }[],
): ShipDamageState {
  const fires: FireRecord[] = [...state.fireRecords];
  const floods: FloodingSourceRecord[] = [...state.floodingRecords];
  let changed = false;
  for (const r of records) {
    for (const f of r.createdFireSources) {
      const idx = fires.findIndex((x) => x.locationId === f.locationId);
      if (idx < 0) {
        fires.push({ ...f });
        changed = true;
      } else if (f.intensityBp > fires[idx]!.intensityBp) {
        fires[idx] = { ...fires[idx]!, intensityBp: f.intensityBp };
        changed = true;
      }
    }
    for (const fl of r.createdFloodingSources) {
      floods.push({ ...fl });
      changed = true;
    }
  }
  if (!changed) return state;
  return withDamageStateHash({ ...state, fireRecords: fires, floodingRecords: floods });
}

function pickZone(
  engine: RandomEngine | undefined,
  battleId: string,
  target: DamageTargetContext,
  minute: number,
  salvo: GunneryEventRecord,
  randomLedger?: RandomLedger,
): AutoResolutionZone {
  if (!engine || target.zones.length === 0) return target.zones[0]!;
  const streamId = `battle/damage/hit_zone:${battleId}:${minute}:${DAMAGE_SUBSTEP}:${target.shipId}:${salvo.batteryId}`;
  const stream = engine.stream(streamId);
  const weightOf = (z: AutoResolutionZone): number =>
    ZONE_HIT_WEIGHT_BP[z.id as AutoResolutionZoneId] ?? 0;
  const totalWeight = target.zones.reduce((a, z) => a + weightOf(z), 0);
  const roll = drawUniform(stream, SafeInt(0), SafeInt(Math.max(0, totalWeight - 1))) as number;
  let acc = 0;
  let draw = target.zones.length - 1;
  for (let i = 0; i < target.zones.length; i++) {
    acc += weightOf(target.zones[i]!);
    if (roll < acc) {
      draw = i;
      break;
    }
  }
  if (randomLedger) {
    randomLedger.record({
      streamId,
      entityKey: target.shipId,
      phase: "resolve_battle_auto_resolution_hit_zone",
      rulesetVersion: DAMAGE_RULESET_VERSION,
      inputHash: sha256Hex(
        canonicalSerialize({
          battleId,
          minute,
          shipId: target.shipId,
          batteryId: salvo.batteryId,
        }),
      ),
      draw: draw as number,
      outcome: target.zones[draw as number]!.id,
      reasonCode: DAMAGE_KEYED_DRAW,
    });
  }
  return target.zones[draw as number]!;
}
