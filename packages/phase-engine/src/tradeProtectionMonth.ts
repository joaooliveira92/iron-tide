import {
  applyMerchantLoss,
  applyUnrestDelta,
  countTradeProtectionShips,
  isRaiderBlockedByBlockade,
  isRaiderEligible,
  merchantLossChanceBp,
  MERCHANT_POOL_FULL_BP,
  recoverMerchantPool,
  tradeProtectionQuota,
  tradeProtectionShortfall,
  tradeProtectionUnrestStep,
  unrestOf,
  type NationState,
  type Ship,
  type TradeDutyDesign,
  type TradeProtectionRules,
  type TradeProtectionState,
  type WarDeclaration,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { PhaseContext } from "./pipeline.js";
import { applyUnrestContributions } from "./unrestApplication.js";

const TRADE_EVENT_VERSION = "0.1.0" as const;
const TRADE_STREAM_FAMILY = "trade/loss";
const TRADE_DRAW_RANGE_BP = 10_000;

export const TRADE_RAIDER_HIT_REASON = "RAIDER_HIT";
export const TRADE_SHORTFALL_PRESSURE_REASON = "SHORTFALL_PRESSURE";

const byId = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function tradeProtectionAssessedEvent(
  nationId: string,
  state: TradeProtectionState,
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `TradeProtectionAssessed-${nationId}-${String(seq)}`,
    version: TRADE_EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "TradeProtectionAssessed",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "TradeProtectionAssessed",
      nationId,
      month: campaignMonth,
      quota: SafeInt(state.quota),
      assigned: SafeInt(state.assigned),
      shortfall: SafeInt(state.shortfall),
      shortfallBp: SafeInt(state.shortfallBp),
    },
    sequenceNumber: seq,
  };
}

export function merchantLossSufferedEvent(
  nationId: string,
  loss: {
    readonly raiderHits: number;
    readonly pressureHit: boolean;
    readonly lossBp: number;
    readonly poolBefore: number;
    readonly poolAfter: number;
  },
  seq: SafeInt,
  campaignMonth: string,
): DomainEventEnvelope {
  return {
    eventId: `MerchantLossSuffered-${nationId}-${String(seq)}`,
    version: TRADE_EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType: "MerchantLossSuffered",
    timestamp: `${campaignMonth}-01T00:00:00.000Z`,
    body: {
      kind: "MerchantLossSuffered",
      nationId,
      month: campaignMonth,
      raiderHits: SafeInt(loss.raiderHits),
      pressureHit: loss.pressureHit,
      lossBp: SafeInt(loss.lossBp),
      poolBefore: SafeInt(loss.poolBefore),
      poolAfter: SafeInt(loss.poolAfter),
    },
    sequenceNumber: seq,
  };
}

function activeWars(ctx: PhaseContext): readonly WarDeclaration[] {
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

function opponentsOf(war: WarDeclaration, nationId: string): readonly string[] {
  const side = sideOf(war, nationId);
  if (side === undefined) return [];
  return [...(side === "attacker" ? war.defenderSideMembers : war.attackerSideMembers)].sort(byId);
}

function shipsOf(nation: NationState): readonly Ship[] {
  return nation.fleets.flatMap((fleet) => fleet.ships).sort((a, b) => byId(a.id, b.id));
}

function designMap(ctx: PhaseContext): ReadonlyMap<string, TradeDutyDesign> {
  const designs = new Map<string, TradeDutyDesign>();
  for (const [id, design] of ctx.snapshot.read("designs")) {
    designs.set(id, {
      hullType: design.hullType,
      normalizedSpeedUms: Number(design.normalizedSpeedUms),
      ...(design.shortRange === true ? { shortRange: true as const } : {}),
    });
  }
  return designs;
}

function assess(
  rules: TradeProtectionRules,
  nation: NationState,
  designs: ReadonlyMap<string, TradeDutyDesign>,
  previous: TradeProtectionState | undefined,
  isPlayer: boolean,
  campaignMonth: string,
): TradeProtectionState {
  const ships = shipsOf(nation);
  const pool = previous?.merchantPoolBp ?? MERCHANT_POOL_FULL_BP;
  if (!isPlayer) {
    return {
      month: campaignMonth,
      quota: 0,
      assigned: 0,
      shortfall: 0,
      shortfallBp: 0,
      merchantPoolBp: pool,
      ...(previous?.lastLossMonth === undefined ? {} : { lastLossMonth: previous.lastLossMonth }),
    };
  }
  const operational = ships.filter((ship) => !ship.isUnderConstruction).length;
  const quota = tradeProtectionQuota(rules, operational, Number(nation.baseResources ?? 0));
  const assigned = countTradeProtectionShips(rules, ships, designs);
  return {
    month: campaignMonth,
    quota,
    assigned,
    ...tradeProtectionShortfall(quota, assigned),
    merchantPoolBp: pool,
    ...(previous?.lastLossMonth === undefined ? {} : { lastLossMonth: previous.lastLossMonth }),
  };
}

export function applyTradeProtectionForMonth(ctx: PhaseContext): void {
  const rules = ctx.engineOptions?.tradeProtection;
  const playerNationId = ctx.engineOptions?.playerNationId;
  if (rules === undefined) return;
  const wars = activeWars(ctx);
  const nations = ctx.snapshot.read("nations");
  const designs = designMap(ctx);
  const blockades = ctx.snapshot.read("wars").blockadeState;
  const engine = ctx.rng.engine();
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  const month = ctx.campaignMonth;

  const warsOfVictim = new Map<string, WarDeclaration[]>();
  for (const war of wars) {
    for (const nationId of [...war.attackerSideMembers, ...war.defenderSideMembers]) {
      const list = warsOfVictim.get(nationId);
      if (list === undefined) warsOfVictim.set(nationId, [war]);
      else list.push(war);
    }
  }
  const victims = new Set<string>(warsOfVictim.keys());
  for (const [nationId, nation] of nations) {
    if (nation.tradeProtection !== undefined) victims.add(nationId);
  }

  const updated = new Map(nations);
  const unrestRises: Array<readonly [string, number]> = [];
  for (const victimId of [...victims].sort(byId)) {
    const nation = nations.get(victimId);
    if (nation === undefined) continue;
    const atWar = warsOfVictim.get(victimId) ?? [];
    const isPlayer = victimId === playerNationId && atWar.length > 0;
    const state = assess(rules, nation, designs, nation.tradeProtection, isPlayer, month);

    let hits = 0;
    for (const war of atWar) {
      for (const opponentId of opponentsOf(war, victimId)) {
        const opponent = nations.get(opponentId);
        if (opponent === undefined) continue;
        if (isRaiderBlockedByBlockade(blockades, opponentId, victimId)) continue;
        for (const ship of shipsOf(opponent)) {
          const design = designs.get(ship.designVersionId);
          if (design === undefined || !isRaiderEligible(rules, ship, design)) continue;
          const chanceBp = merchantLossChanceBp(rules, state.shortfallBp);
          const entityKey = `${war.id}/${ship.id}/${victimId}/${month}`;
          const draw = Math.floor(
            engine.stream(`${TRADE_STREAM_FAMILY}/${entityKey}`).next() * TRADE_DRAW_RANGE_BP,
          );
          const hit = draw < chanceBp;
          ctx.randomLedger.record({
            streamId: TRADE_STREAM_FAMILY,
            entityKey,
            phase: "resolve_diplomacy",
            rulesetVersion,
            inputHash: sha256Hex(
              canonicalSerialize({ entityKey, chanceBp, hullType: design.hullType }),
            ),
            draw,
            outcome: hit ? "HIT" : "MISS",
            reasonCode: TRADE_RAIDER_HIT_REASON,
          });
          if (hit) hits += 1;
        }
      }
    }

    let pressureHit = false;
    if (isPlayer && state.shortfallBp > 0) {
      const entityKey = `pressure/${victimId}/${month}`;
      const draw = Math.floor(
        engine.stream(`${TRADE_STREAM_FAMILY}/${entityKey}`).next() * TRADE_DRAW_RANGE_BP,
      );
      pressureHit = draw < rules.pressureChanceBp;
      ctx.randomLedger.record({
        streamId: TRADE_STREAM_FAMILY,
        entityKey,
        phase: "resolve_diplomacy",
        rulesetVersion,
        inputHash: sha256Hex(
          canonicalSerialize({ entityKey, chanceBp: rules.pressureChanceBp, state }),
        ),
        draw,
        outcome: pressureHit ? "HIT" : "MISS",
        reasonCode: TRADE_SHORTFALL_PRESSURE_REASON,
      });
    }

    const lossBp = hits * rules.lossPerHitBp + (pressureHit ? rules.pressureLossBp : 0);
    const poolBefore = state.merchantPoolBp;
    const poolAfter =
      lossBp > 0 ? applyMerchantLoss(poolBefore, lossBp) : recoverMerchantPool(rules, poolBefore);
    const next: TradeProtectionState = {
      ...state,
      merchantPoolBp: poolAfter,
      ...(lossBp > 0 ? { lastLossMonth: month } : {}),
    };

    if (isPlayer) {
      ctx.eventLedger.append(tradeProtectionAssessedEvent(victimId, next, ctx.nextSeq(), month));
    }
    if (lossBp > 0 && poolAfter !== poolBefore) {
      ctx.eventLedger.append(
        merchantLossSufferedEvent(
          victimId,
          { raiderHits: hits, pressureHit, lossBp, poolBefore, poolAfter },
          ctx.nextSeq(),
          month,
        ),
      );
    }

    const step = tradeProtectionUnrestStep(rules, poolAfter, month);
    updated.set(victimId, { ...nation, tradeProtection: next });
    const delta = step > 0 ? applyUnrestDelta(nation.unrest, step) - unrestOf(nation) : 0;
    if (delta !== 0) unrestRises.push([victimId, delta]);
  }
  ctx.snapshot.write("nations", updated);
  for (const [victimId, delta] of unrestRises) {
    applyUnrestContributions(ctx, victimId, [{ reasonCode: "TRADE_LOSS", delta }]);
  }
}
