import {
  countEnemySubmarines,
  damageOutcome,
  isShipOperational,
  warshipAttackChanceBp,
  warshipScreenRatioBp,
  type NationState,
  type Ship,
  type TradeDutyDesign,
  type WarshipAttackRules,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { PhaseContext } from "./pipeline.js";
import { activeWars, byId, designMap, shipsOf, tradeAttackersOf } from "./tradeWarContext.js";

export const SUBMARINE_WARSHIP_TARGET_STREAM = "trade/submarine_warship_target";
export const SUBMARINE_WARSHIP_HIT_STREAM = "trade/submarine_warship_hit";
export const SUBMARINE_WARSHIP_OUTCOME_STREAM = "trade/submarine_warship_outcome";
export const SUBMARINE_WARSHIP_TARGET_REASON = "SUBMARINE_WARSHIP_TARGET";
export const SUBMARINE_WARSHIP_HIT_REASON = "SUBMARINE_WARSHIP_HIT";
export const SUBMARINE_WARSHIP_OUTCOME_REASON = "SUBMARINE_WARSHIP_OUTCOME";

const DRAW_RANGE_BP = 10_000;
const EVENT_VERSION = "0.1.0" as const;

type Designs = ReadonlyMap<string, TradeDutyDesign>;

function isAvailable(ship: Ship): boolean {
  return (
    ship.readiness === "ACTIVE" &&
    isShipOperational(ship) &&
    ship.inBattleId === undefined &&
    ship.internment === undefined
  );
}

function hullOf(designs: Designs, ship: Ship): string | undefined {
  return designs.get(ship.designVersionId)?.hullType;
}

function isHeavyTarget(rules: WarshipAttackRules, designs: Designs, ship: Ship): boolean {
  const hull = hullOf(designs, ship);
  return hull !== undefined && isAvailable(ship) && rules.heavyHullTypes.includes(hull);
}

function isFreeScreen(rules: WarshipAttackRules, designs: Designs, ship: Ship): boolean {
  const hull = hullOf(designs, ship);
  return (
    hull !== undefined &&
    isAvailable(ship) &&
    ship.stationAssignment !== "TRADE_PROTECTION" &&
    rules.screenHullTypes.includes(hull)
  );
}

function withShip(nation: NationState, shipId: string, next: Ship | undefined): NationState {
  return {
    ...nation,
    fleets: nation.fleets.map((fleet) =>
      fleet.ships.some((ship) => ship.id === shipId)
        ? {
            ...fleet,
            ships:
              next === undefined
                ? fleet.ships.filter((ship) => ship.id !== shipId)
                : fleet.ships.map((ship) => (ship.id === shipId ? next : ship)),
          }
        : fleet,
    ),
  };
}

export function submarineWarshipAttackedEvent(
  body: {
    readonly nationId: string;
    readonly boatId: string;
    readonly victimNationId: string;
    readonly victimShipId: string;
    readonly month: string;
    readonly chanceBp: number;
    readonly outcome: "DAMAGED" | "SUNK";
    readonly damageBp: number;
  },
  seq: SafeInt,
): DomainEventEnvelope {
  return {
    eventId: `SubmarineWarshipAttacked-${body.boatId}-${String(seq)}`,
    version: EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: body.nationId,
    eventType: "SubmarineWarshipAttacked",
    timestamp: `${body.month}-01T00:00:00.000Z`,
    body: {
      kind: "SubmarineWarshipAttacked",
      nationId: body.nationId,
      boatId: body.boatId,
      victimNationId: body.victimNationId,
      victimShipId: body.victimShipId,
      month: body.month,
      chanceBp: SafeInt(body.chanceBp),
      outcome: body.outcome,
      damageBp: SafeInt(body.damageBp),
    },
    sequenceNumber: seq,
  };
}

export function applySubmarineWarshipAttacksForMonth(ctx: PhaseContext): void {
  const threat = ctx.engineOptions?.tradeProtection?.submarineThreat;
  const rules = threat?.warshipAttack;
  if (threat === undefined || rules === undefined) return;
  const wars = activeWars(ctx);
  const nations = ctx.snapshot.read("nations");
  const designs = designMap(ctx);
  const engine = ctx.rng.engine();
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  const month = ctx.campaignMonth;

  const victimIds = new Set<string>();
  for (const war of wars) {
    for (const id of [...war.attackerSideMembers, ...war.defenderSideMembers]) victimIds.add(id);
  }

  const working = new Map(nations);
  let changed = false;
  const draw = (
    streamId: string,
    entityKey: string,
    range: number,
    inputs: unknown,
    reasonCode: string,
    outcomeOf: (value: number) => string,
  ): number => {
    const value = Math.floor(engine.stream(`${streamId}/${entityKey}`).next() * range);
    ctx.randomLedger.record({
      streamId,
      entityKey,
      phase: "resolve_diplomacy",
      rulesetVersion,
      inputHash: sha256Hex(canonicalSerialize(inputs)),
      draw: value,
      outcome: outcomeOf(value),
      reasonCode,
    });
    return value;
  };

  for (const victimId of [...victimIds].sort(byId)) {
    const atWar = wars.filter(
      (war) =>
        war.attackerSideMembers.includes(victimId) || war.defenderSideMembers.includes(victimId),
    );
    for (const attacker of tradeAttackersOf(nations, atWar, victimId)) {
      for (const boat of attacker.ships) {
        if (!isAvailable(boat) || countEnemySubmarines(threat, [boat], designs) === 0) continue;
        const victim = working.get(victimId);
        if (victim === undefined) continue;
        const victimShips = shipsOf(victim);
        const targets = victimShips.filter((ship) => isHeavyTarget(rules, designs, ship));
        if (targets.length === 0) continue;

        const entityKey = `subw/${attacker.warId}/${boat.id}/${victimId}/${month}`;
        const targetIds = targets.map((ship) => ship.id);
        const index = draw(
          SUBMARINE_WARSHIP_TARGET_STREAM,
          entityKey,
          targets.length,
          { entityKey, targetIds },
          SUBMARINE_WARSHIP_TARGET_REASON,
          (value) => targetIds[value] ?? "NONE",
        );
        const target = targets[index];
        if (target === undefined) continue;

        const freeScreens = victimShips.filter((ship) => isFreeScreen(rules, designs, ship)).length;
        const chanceBp = warshipAttackChanceBp(
          rules,
          attacker.policy,
          warshipScreenRatioBp(freeScreens, targets.length),
        );
        const hitDraw = draw(
          SUBMARINE_WARSHIP_HIT_STREAM,
          entityKey,
          DRAW_RANGE_BP,
          { entityKey, chanceBp },
          SUBMARINE_WARSHIP_HIT_REASON,
          (value) => (value < chanceBp ? "HIT" : "MISS"),
        );
        if (hitDraw >= chanceBp) continue;

        const outcomeDraw = draw(
          SUBMARINE_WARSHIP_OUTCOME_STREAM,
          entityKey,
          DRAW_RANGE_BP,
          {
            entityKey,
            sunkBp: rules.sunkBp,
            maxDamageBp: rules.maxDamageBp,
            hitPoints: target.hitPoints,
            maxHitPoints: target.maxHitPoints,
          },
          SUBMARINE_WARSHIP_OUTCOME_REASON,
          (value) =>
            damageOutcome(
              rules.sunkBp,
              rules.maxDamageBp,
              value,
              target.hitPoints,
              target.maxHitPoints,
            ).kind,
        );
        const result = damageOutcome(
          rules.sunkBp,
          rules.maxDamageBp,
          outcomeDraw,
          target.hitPoints,
          target.maxHitPoints,
        );
        const survivor =
          result.kind === "DAMAGED" && result.hitPointsAfter > 0
            ? { ...target, hitPoints: SafeInt(result.hitPointsAfter) }
            : undefined;
        working.set(victimId, withShip(victim, target.id, survivor));
        changed = true;
        ctx.eventLedger.append(
          submarineWarshipAttackedEvent(
            {
              nationId: attacker.nationId,
              boatId: boat.id,
              victimNationId: victimId,
              victimShipId: target.id,
              month,
              chanceBp,
              outcome: survivor === undefined ? "SUNK" : "DAMAGED",
              damageBp:
                survivor === undefined || result.kind === "SUNK" ? DRAW_RANGE_BP : result.damageBp,
            },
            ctx.nextSeq(),
          ),
        );
      }
    }
  }

  if (changed) ctx.snapshot.write("nations", working);
}
