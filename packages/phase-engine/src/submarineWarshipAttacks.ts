import {
  countEnemySubmarines,
  isShipOperational,
  type NationState,
  type Ship,
  type SubmarineThreatRules,
  type TradeDutyDesign,
  type WarDeclaration,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { PhaseContext } from "./pipeline.js";
import {
  warshipAttackChanceBp,
  warshipAttackRulesOf,
  warshipDamage,
  warshipScreenRatioBp,
  type WarshipAttackRules,
} from "./submarineWarshipRules.js";
import type { TradeAttacker } from "./tradeSubmarines.js";
import { activeWars, byId, designMap, shipsOf, tradeAttackersOf } from "./tradeWarContext.js";

export const STREAM_WARSHIP_TARGET = "trade/submarine_warship_target";
export const STREAM_WARSHIP_HIT = "trade/submarine_warship_hit";
export const STREAM_WARSHIP_OUTCOME = "trade/submarine_warship_outcome";
export const SUBMARINE_WARSHIP_TARGET_REASON = "SUBMARINE_WARSHIP_TARGET";
export const SUBMARINE_WARSHIP_HIT_REASON = "SUBMARINE_WARSHIP_HIT";
export const SUBMARINE_WARSHIP_OUTCOME_REASON = "SUBMARINE_WARSHIP_OUTCOME";

const DRAW_RANGE_BP = 10_000;
const EVENT_VERSION = "0.1.0" as const;

type Designs = ReadonlyMap<string, TradeDutyDesign>;

interface Fleetwide {
  readonly damaged: Map<string, Ship>;
  readonly sunk: Set<string>;
}

function liveShips(nation: NationState, state: Fleetwide): readonly Ship[] {
  return shipsOf(nation)
    .filter((ship) => !state.sunk.has(ship.id))
    .map((ship) => state.damaged.get(ship.id) ?? ship);
}

function isEligibleTarget(
  ship: Ship,
  designs: Designs,
  heavyHullTypes: readonly string[],
): boolean {
  const hull = designs.get(ship.designVersionId)?.hullType;
  return (
    hull !== undefined &&
    heavyHullTypes.includes(hull) &&
    ship.readiness === "ACTIVE" &&
    isShipOperational(ship) &&
    ship.inBattleId === undefined &&
    ship.internment === undefined
  );
}

function isFreeScreen(ship: Ship, designs: Designs, screenHullTypes: readonly string[]): boolean {
  const hull = designs.get(ship.designVersionId)?.hullType;
  return (
    hull !== undefined &&
    screenHullTypes.includes(hull) &&
    ship.readiness === "ACTIVE" &&
    isShipOperational(ship) &&
    ship.stationAssignment !== "TRADE_PROTECTION"
  );
}

function boatsOf(
  threat: SubmarineThreatRules,
  attacker: TradeAttacker,
  designs: Designs,
): readonly Ship[] {
  return attacker.ships.filter((ship) => countEnemySubmarines(threat, [ship], designs) === 1);
}

function attackedEvent(
  body: Extract<DomainEventEnvelope["body"], { readonly kind: "SubmarineWarshipAttacked" }>,
  seq: SafeInt,
): DomainEventEnvelope {
  return {
    eventId: `SubmarineWarshipAttacked-${body.shipId}-${String(seq)}`,
    version: EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: body.nationId,
    eventType: "SubmarineWarshipAttacked",
    timestamp: `${body.month}-01T00:00:00.000Z`,
    body,
    sequenceNumber: seq,
  };
}

function attackersOf(
  nations: ReadonlyMap<string, NationState>,
  wars: readonly WarDeclaration[],
  victimId: string,
): readonly TradeAttacker[] {
  const atWar = wars.filter(
    (war) =>
      war.attackerSideMembers.includes(victimId) || war.defenderSideMembers.includes(victimId),
  );
  return tradeAttackersOf(nations, atWar, victimId).sort((a, b) => byId(a.nationId, b.nationId));
}

export function applySubmarineWarshipAttacksForMonth(ctx: PhaseContext): void {
  const threat = ctx.engineOptions?.tradeProtection?.submarineThreat;
  const rules = warshipAttackRulesOf(threat);
  if (threat === undefined || rules === undefined) return;
  const wars = activeWars(ctx);
  if (wars.length === 0) return;
  const nations = ctx.snapshot.read("nations");
  const designs = designMap(ctx);
  const engine = ctx.rng.engine();
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  const month = ctx.campaignMonth;
  const victims = new Set<string>();
  for (const war of wars) {
    for (const id of [...war.attackerSideMembers, ...war.defenderSideMembers]) victims.add(id);
  }

  const draw = (
    stream: string,
    entityKey: string,
    reasonCode: string,
    inputs: Readonly<Record<string, unknown>>,
    outcome: (value: number) => string,
  ): number => {
    const value = Math.floor(engine.stream(`${stream}/${entityKey}`).next() * DRAW_RANGE_BP);
    ctx.randomLedger.record({
      streamId: stream,
      entityKey,
      phase: "resolve_diplomacy",
      rulesetVersion,
      inputHash: sha256Hex(canonicalSerialize({ entityKey, ...inputs })),
      draw: value,
      outcome: outcome(value),
      reasonCode,
    });
    return value;
  };

  const states = new Map<string, Fleetwide>();
  for (const victimId of [...victims].sort(byId)) {
    const victim = nations.get(victimId);
    if (victim === undefined) continue;
    const state: Fleetwide = { damaged: new Map(), sunk: new Set() };
    for (const attacker of attackersOf(nations, wars, victimId)) {
      for (const boat of boatsOf(threat, attacker, designs)) {
        attackWith({ ctx, rules, designs, victim, state, attacker, boat, draw, month });
      }
    }
    if (state.damaged.size > 0 || state.sunk.size > 0) states.set(victimId, state);
  }
  if (states.size === 0) return;

  const updated = new Map(nations);
  for (const [victimId, state] of states) {
    const victim = nations.get(victimId);
    if (victim === undefined) continue;
    updated.set(victimId, {
      ...victim,
      fleets: victim.fleets.map((fleet) => ({
        ...fleet,
        ships: fleet.ships
          .filter((ship) => !state.sunk.has(ship.id))
          .map((ship) => state.damaged.get(ship.id) ?? ship),
      })),
    });
  }
  ctx.snapshot.write("nations", updated);
}

interface AttackInput {
  readonly ctx: PhaseContext;
  readonly rules: WarshipAttackRules;
  readonly designs: Designs;
  readonly victim: NationState;
  readonly state: Fleetwide;
  readonly attacker: TradeAttacker;
  readonly boat: Ship;
  readonly draw: (
    stream: string,
    entityKey: string,
    reasonCode: string,
    inputs: Readonly<Record<string, unknown>>,
    outcome: (value: number) => string,
  ) => number;
  readonly month: string;
}

function attackWith(input: AttackInput): void {
  const { ctx, rules, designs, victim, state, attacker, boat, draw, month } = input;
  const live = liveShips(victim, state);
  const targets = live.filter((ship) => isEligibleTarget(ship, designs, rules.heavyHullTypes));
  if (targets.length === 0) return;
  const entityKey = `subw/${attacker.warId}/${boat.id}/${victim.id}/${month}`;
  const pick = draw(
    STREAM_WARSHIP_TARGET,
    entityKey,
    SUBMARINE_WARSHIP_TARGET_REASON,
    { targetCount: targets.length },
    (value) => `TARGET_${Math.floor((value * targets.length) / DRAW_RANGE_BP)}`,
  );
  const target = targets[Math.floor((pick * targets.length) / DRAW_RANGE_BP)];
  if (target === undefined) return;
  const areaId = target.locationAreaId;
  const heavies = targets.filter((ship) => ship.locationAreaId === areaId).length;
  const freeDestroyers = live.filter(
    (ship) => ship.locationAreaId === areaId && isFreeScreen(ship, designs, rules.screenHullTypes),
  ).length;
  const screenRatioBp = warshipScreenRatioBp(freeDestroyers, heavies);
  const chanceBp = warshipAttackChanceBp(rules, attacker.policy, screenRatioBp);
  const hitDraw = draw(
    STREAM_WARSHIP_HIT,
    entityKey,
    SUBMARINE_WARSHIP_HIT_REASON,
    { chanceBp, policy: attacker.policy, screenRatioBp, areaId },
    (value) => (value < chanceBp ? "HIT" : "MISS"),
  );
  if (hitDraw >= chanceBp) return;
  const outcomeDraw = draw(
    STREAM_WARSHIP_OUTCOME,
    entityKey,
    SUBMARINE_WARSHIP_OUTCOME_REASON,
    { chanceBp, sunkBp: rules.sunkBp, maxDamageBp: rules.maxDamageBp, shipId: target.id },
    (value) => (value < rules.sunkBp ? "SUNK" : "DAMAGED"),
  );
  const damage = warshipDamage(rules, outcomeDraw, target.hitPoints, target.maxHitPoints);
  const gone = damage.kind === "SUNK" || damage.hitPointsAfter === 0;
  if (gone) state.sunk.add(target.id);
  else state.damaged.set(target.id, { ...target, hitPoints: SafeInt(damage.hitPointsAfter) });
  ctx.eventLedger.append(
    attackedEvent(
      {
        kind: "SubmarineWarshipAttacked",
        nationId: victim.id,
        attackerNationId: attacker.nationId,
        shipId: target.id,
        areaId,
        month,
        policy: attacker.policy,
        chanceBp: SafeInt(chanceBp),
        outcome: gone ? "SUNK" : "DAMAGED",
        damageBp: SafeInt(damage.kind === "SUNK" ? 0 : damage.damageBp),
        hitPointsAfter: SafeInt(damage.kind === "SUNK" ? 0 : damage.hitPointsAfter),
      },
      ctx.nextSeq(),
    ),
  );
}
