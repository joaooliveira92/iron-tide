import {
  breakoutRequired,
  countTradeProtectionShips,
  engagementOutcome,
  heavilyDamagedDisposition,
  interceptionChanceBp,
  internmentCause,
  isRaiderBlockedByBlockade,
  isRaiderEligible,
  patrolCoverageBp,
  tradeProtectionQuota,
  type InternmentCause,
  type NationState,
  type Ship,
  type TradeDutyDesign,
  type TradeProtectionRules,
  type WarDeclaration,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { DomainEventEnvelope } from "@bluewave/events";
import type { PhaseContext } from "./pipeline.js";
import { queueRaiderEncounter } from "./raiderEncounterQueue.js";
import { activeWars, byId, designMap, opponentsOf, shipsOf } from "./tradeWarContext.js";

const STREAM_INTERCEPTION = "trade/interception";
const STREAM_ENGAGEMENT = "trade/engagement";
const STREAM_DISPOSITION = "trade/disposition";
const STREAM_INTERNMENT = "trade/internment";
const STREAM_SURPRISE = "trade/surprise";
const DRAW_RANGE_BP = 10_000;
const UM_PER_METRE = 1_000_000;
const EVENT_VERSION = "0.1.0" as const;

export const RAIDER_INTERCEPTION_REASON = "RAIDER_INTERCEPTION";
export const RAIDER_BREAKOUT_REASON = "RAIDER_BREAKOUT";
export const RAIDER_ENGAGEMENT_REASON = "RAIDER_ENGAGEMENT";
export const RAIDER_DISPOSITION_REASON = "RAIDER_DISPOSITION";
export const RAIDER_INTERNMENT_REASON = "RAIDER_INTERNMENT";
export const RAIDER_SURPRISE_REASON = "RAIDER_AMC_SURPRISE";

type Rules = NonNullable<TradeProtectionRules["raiderInterception"]>;
type Encounter = "INTERCEPTION" | "BREAKOUT";
type Outcome = "SURVIVED" | "SUNK" | "SCUTTLED" | "INTERNED";

type EventBody = DomainEventEnvelope["body"];

function envelope(
  eventType: "RaiderEngaged" | "RaiderInterned" | "RaiderReleased",
  nationId: string,
  shipId: string,
  month: string,
  seq: SafeInt,
  body: EventBody,
): DomainEventEnvelope {
  return {
    eventId: `${eventType}-${shipId}-${String(seq)}`,
    version: EVENT_VERSION,
    aggregateType: "nation",
    aggregateId: nationId,
    eventType,
    timestamp: `${month}-01T00:00:00.000Z`,
    body,
    sequenceNumber: seq,
  };
}

const internedEvent = (
  nationId: string,
  shipId: string,
  month: string,
  seq: SafeInt,
  cause: InternmentCause,
): DomainEventEnvelope =>
  envelope("RaiderInterned", nationId, shipId, month, seq, {
    kind: "RaiderInterned",
    nationId,
    shipId,
    month,
    cause,
  });

function interned(ship: Ship, month: string, cause: InternmentCause): Ship {
  const { stationAssignment: _assignment, ...rest } = ship;
  return {
    ...rest,
    readiness: "MOTHBALLED",
    internment: { sinceMonth: month, cause, readinessBefore: ship.readiness },
  };
}

function released(ship: Ship): Ship {
  const { internment, ...rest } = ship;
  return internment === undefined ? ship : { ...rest, readiness: internment.readinessBefore };
}

function patrolCoverage(
  rules: TradeProtectionRules,
  victim: NationState,
  designs: ReadonlyMap<string, TradeDutyDesign>,
  isPlayer: boolean,
): number {
  const ships = shipsOf(victim);
  const operational = ships.filter((ship) => !ship.isUnderConstruction).length;
  const quota = tradeProtectionQuota(rules, operational, Number(victim.baseResources ?? 0));
  const assigned = isPlayer ? countTradeProtectionShips(rules, ships, designs) : quota;
  return patrolCoverageBp(quota, assigned);
}

export function applyRaiderInterceptionForMonth(
  ctx: PhaseContext,
  tradeRules: TradeProtectionRules,
  playerNationId: string | undefined,
): void {
  const rules: Rules | undefined = tradeRules.raiderInterception;
  if (rules === undefined) return;
  const amcSurprise = rules.amcSurprise;
  const wars = activeWars(ctx);
  const nations = ctx.snapshot.read("nations");
  const designs = designMap(ctx);
  const blockades = ctx.snapshot.read("wars").blockadeState;
  const engine = ctx.rng.engine();
  const rulesetVersion = ctx.snapshot.read("rulesetVersion");
  const month = ctx.campaignMonth;

  const draw = (
    stream: string,
    entityKey: string,
    chanceBp: number,
    reasonCode: string,
    outcome: (value: number) => string,
    inputs: Readonly<Record<string, unknown>>,
  ): number => {
    const value = Math.floor(engine.stream(`${stream}/${entityKey}`).next() * DRAW_RANGE_BP);
    ctx.randomLedger.record({
      streamId: stream,
      entityKey,
      phase: "resolve_diplomacy",
      rulesetVersion,
      inputHash: sha256Hex(canonicalSerialize({ entityKey, chanceBp, ...inputs })),
      draw: value,
      outcome: outcome(value),
      reasonCode,
    });
    return value;
  };

  const warsOf = (nationId: string): readonly WarDeclaration[] =>
    wars.filter(
      (war) =>
        war.attackerSideMembers.includes(nationId) || war.defenderSideMembers.includes(nationId),
    );

  const updated = new Map(nations);
  for (const [nationId, nation] of [...nations].sort(([a], [b]) => byId(a, b))) {
    const nationWars = warsOf(nationId);
    let changed = false;
    const fleets = nation.fleets.map((fleet) => {
      const ships: Ship[] = [];
      for (const ship of [...fleet.ships].sort((a, b) => byId(a.id, b.id))) {
        if (ship.internment !== undefined) {
          if (nationWars.length === 0) {
            ships.push(released(ship));
            ctx.eventLedger.append(
              envelope("RaiderReleased", nationId, ship.id, month, ctx.nextSeq(), {
                kind: "RaiderReleased",
                nationId,
                shipId: ship.id,
                month,
              }),
            );
            changed = true;
          } else ships.push(ship);
          continue;
        }
        const design = designs.get(ship.designVersionId);
        if (
          design === undefined ||
          ship.inBattleId !== undefined ||
          !isRaiderEligible(tradeRules, ship, design)
        ) {
          ships.push(ship);
          continue;
        }
        const breakout = breakoutRequired(blockades, nationId);
        let target: { readonly war: WarDeclaration; readonly victimId: string } | undefined;
        for (const war of nationWars) {
          for (const opponentId of opponentsOf(war, nationId)) {
            if (target === undefined && !isRaiderBlockedByBlockade(blockades, nationId, opponentId))
              target = { war, victimId: opponentId };
          }
        }
        const victim = target === undefined ? undefined : nations.get(target.victimId);
        if (target === undefined || victim === undefined) {
          ships.push(ship);
          continue;
        }

        const encounter: Encounter = breakout ? "BREAKOUT" : "INTERCEPTION";
        const entityKey = `${target.war.id}/${ship.id}/${breakout ? "BREAKOUT" : target.victimId}/${month}`;
        const chanceBp = breakout
          ? rules.breakoutInterceptBp
          : interceptionChanceBp(
              rules,
              patrolCoverage(tradeRules, victim, designs, target.victimId === playerNationId),
            );
        const intercepted =
          draw(
            STREAM_INTERCEPTION,
            entityKey,
            chanceBp,
            breakout ? RAIDER_BREAKOUT_REASON : RAIDER_INTERCEPTION_REASON,
            (value) => (value < chanceBp ? "INTERCEPTED" : "ESCAPED"),
            { hullType: design.hullType },
          ) < chanceBp;

        if (!intercepted) {
          const internmentChanceBp = rules.fuelInternBp + rules.breakdownInternBp;
          const internmentDraw = draw(
            STREAM_INTERNMENT,
            entityKey,
            internmentChanceBp,
            RAIDER_INTERNMENT_REASON,
            (value) => internmentCause(rules, value) ?? "AT_SEA",
            {},
          );
          const cause = internmentCause(rules, internmentDraw);
          if (cause === undefined) {
            ships.push(ship);
            continue;
          }
          ships.push(interned(ship, month, cause));
          ctx.eventLedger.append(internedEvent(nationId, ship.id, month, ctx.nextSeq(), cause));
          changed = true;
          continue;
        }

        const blockader = breakout
          ? blockades.find((blockade) => blockade.blockadedNationId === nationId)?.blockaderId
          : undefined;
        const queued = queueRaiderEncounter(ctx, tradeRules, designs, {
          warId: target.war.id,
          areaId: fleet.locationAreaId,
          breakout,
          raiderNationId: nationId,
          raiderShip: ship,
          interceptorNation: nations.get(blockader ?? target.victimId),
          ...(amcSurprise === undefined || design.hullType !== tradeRules.amcHullType
            ? {}
            : {
                drawShortRangeStartUm: () =>
                  draw(
                    STREAM_SURPRISE,
                    entityKey,
                    amcSurprise.chanceBp,
                    RAIDER_SURPRISE_REASON,
                    (value) => (value < amcSurprise.chanceBp ? "SURPRISED" : "NOT_SURPRISED"),
                    { startRangeM: amcSurprise.startRangeM },
                  ) < amcSurprise.chanceBp
                    ? amcSurprise.startRangeM * UM_PER_METRE
                    : undefined,
              }),
        });
        if (queued) {
          ships.push(ship);
          continue;
        }

        changed = true;
        let outcome: Outcome = "SURVIVED";
        let damageBp = 0;
        let survivor: Ship | undefined = ship;
        const engagementDraw = draw(
          STREAM_ENGAGEMENT,
          entityKey,
          rules.raiderSunkBp,
          RAIDER_ENGAGEMENT_REASON,
          (value) => engagementOutcome(rules, value, ship.hitPoints, ship.maxHitPoints).kind,
          { hitPoints: ship.hitPoints, maxHitPoints: ship.maxHitPoints },
        );
        const result = engagementOutcome(rules, engagementDraw, ship.hitPoints, ship.maxHitPoints);
        if (result.kind === "SUNK") {
          outcome = "SUNK";
          survivor = undefined;
        } else {
          damageBp = result.damageBp;
          survivor = { ...ship, hitPoints: SafeInt(result.hitPointsAfter) };
          if (result.heavilyDamaged) {
            const disposition = heavilyDamagedDisposition(
              rules,
              draw(
                STREAM_DISPOSITION,
                entityKey,
                rules.scuttleShareBp,
                RAIDER_DISPOSITION_REASON,
                (value) => heavilyDamagedDisposition(rules, value),
                { hitPointsAfter: result.hitPointsAfter },
              ),
            );
            outcome = disposition;
            survivor = disposition === "SCUTTLED" ? undefined : interned(survivor, month, "DAMAGE");
          }
        }
        ctx.eventLedger.append(
          envelope("RaiderEngaged", nationId, ship.id, month, ctx.nextSeq(), {
            kind: "RaiderEngaged",
            nationId,
            shipId: ship.id,
            month,
            victimNationId: target.victimId,
            encounter,
            chanceBp: SafeInt(chanceBp),
            outcome,
            damageBp: SafeInt(damageBp),
          }),
        );
        if (outcome === "INTERNED")
          ctx.eventLedger.append(internedEvent(nationId, ship.id, month, ctx.nextSeq(), "DAMAGE"));
        if (survivor !== undefined) ships.push(survivor);
      }
      return { ...fleet, ships };
    });
    if (changed) updated.set(nationId, { ...nation, fleets });
  }
  ctx.snapshot.write("nations", updated);
}
