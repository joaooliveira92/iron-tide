import type {
  BattleInstance,
  CampaignSnapshot,
  DeclinedBattleRecord,
  NationState,
} from "@bluewave/campaign";
import {
  BATTLE_DECLINE_NOT_ALLOWED,
  isDeclineAllowed,
  type AcceptanceClass,
} from "@bluewave/combat/generation";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { applyWarScoreDelta, type resolveBattleManifest } from "./battles.js";
import { divide, type OfferContent } from "./battleOffer.js";
import { tallyDecline } from "./declineCounter.js";
import { battleDeclinedEvent, declineThresholdReachedEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";
import type { OfferRefusal } from "./interruption.js";
import { applyPrestigeChange } from "./prestigeApplication.js";

export const BATTLE_DECLINED_REASON = "BATTLE_DECLINED_WITH_CONSEQUENCES";

export const OFFER_DECLINE_UNPRICED = "OfferDeclineUnpriced";

export interface DeclinePrice {
  readonly cost: number;
  readonly credit: number;
}

export function priceDecline(rules: BattleOfferRules, missionType: string): DeclinePrice | null {
  const rule = rules.declineVictoryPoints;
  const points = Object.hasOwn(rule.pointsByMission, missionType)
    ? rule.pointsByMission[missionType]
    : undefined;
  if (points === undefined || rule.distanceModifier.kind !== "NONE") return null;
  const credit = rule.opponentCredit;
  switch (credit.kind) {
    case "NONE":
      return { cost: points, credit: 0 };
    case "MIRROR":
      return { cost: points, credit: points };
    case "FRACTION_BP":
      return {
        cost: points,
        credit: Number(divide(BigInt(points) * BigInt(credit.fractionBp), 10_000n, rule.rounding)),
      };
  }
}

export function declineRefusal(
  content: OfferContent,
  rules: BattleOfferRules,
): OfferRefusal | null {
  if (!isDeclineAllowed(content.acceptanceClass as AcceptanceClass)) {
    return { _tag: BATTLE_DECLINE_NOT_ALLOWED };
  }
  return priceDecline(rules, content.missionType) === null
    ? { _tag: OFFER_DECLINE_UNPRICED }
    : null;
}

function releaseReservations(
  snapshot: CampaignSnapshot,
  shipIds: ReadonlySet<string>,
): CampaignSnapshot {
  const nations = new Map<string, NationState>();
  for (const [nationId, nation] of snapshot["nations"]) {
    let changed = false;
    const fleets = nation["fleets"].map((fleet) => {
      if (!fleet["ships"].some((ship) => shipIds.has(ship["id"]))) return fleet;
      changed = true;
      return {
        ...fleet,
        ships: fleet["ships"].map((ship) => {
          if (!shipIds.has(ship["id"]) || ship["inBattleId"] === undefined) return ship;
          const { inBattleId: _reservation, ...rest } = ship;
          return rest;
        }),
      };
    });
    nations.set(nationId, changed ? { ...nation, fleets } : nation);
  }
  return { ...snapshot, nations };
}

export function applyDecline(
  ctx: MonthContext,
  battle: BattleInstance,
  manifest: NonNullable<ReturnType<typeof resolveBattleManifest>>,
  content: OfferContent,
  decliner: string,
  rules: BattleOfferRules,
  responseInputHash: string,
): boolean {
  const snapshot = ctx.currentSnapshot;
  const existing = snapshot["wars"]["declinedBattles"] ?? [];
  if (existing.some((record) => record.battleId === battle["id"])) return false;
  const price = priceDecline(rules, content.missionType);
  if (price === null) return false;

  const war = snapshot["wars"]["wars"].find((w) => w["id"] === manifest["warId"]);
  const declinerIsAttacker =
    war !== undefined ? war["attackerSideMembers"].includes(decliner) : false;
  let next = snapshot;
  if (war !== undefined) {
    next = applyWarScoreDelta(
      next,
      war["id"],
      declinerIsAttacker
        ? { attacker: -price.cost, defender: price.credit }
        : { attacker: price.credit, defender: -price.cost },
      ctx.campaignMonth,
    );
  }
  next = releaseReservations(next, new Set(manifest["persistentAssets"]));

  const tally = tallyDecline(next["wars"]["declineCounters"], {
    rules: rules.declineCounter,
    repeatEachDecline: rules.declinedBattlePrestige?.repeat === "EACH_FURTHER_DECLINE",
    warId: manifest["warId"],
    nationId: decliner,
    month: ctx.campaignMonth,
    wars: next["wars"]["wars"],
  });

  const record: DeclinedBattleRecord = {
    battleId: battle["id"],
    warId: manifest["warId"],
    nationId: decliner,
    areaId: battle["areaId"],
    month: ctx.campaignMonth,
    missionType: content.missionType,
    responseInputHash,
    victoryPointCost: price.cost,
    opponentCredit: price.credit,
  };
  ctx.currentSnapshot = {
    ...next,
    wars: {
      ...next["wars"],
      battles: next["wars"]["battles"].map((b) =>
        b["id"] === battle["id"] ? { ...b, phase: "declined" as const } : b,
      ),
      declinedBattles: [...existing, record],
      declineCounters: tally.entries,
    },
  };
  ctx.eventLedger.append(
    battleDeclinedEvent(
      decliner,
      battle["id"],
      content.missionType,
      battle["areaId"],
      price.cost,
      price.credit,
      tally.count,
      ctx.nextSeq(),
      ctx.campaignMonth,
    ),
  );
  if (tally.thresholdReached) {
    ctx.eventLedger.append(
      declineThresholdReachedEvent(
        decliner,
        battle["id"],
        tally.count,
        rules.declineCounter.threshold,
        rules.declineCounter.scope,
        next["rulesetVersion"],
        ctx.nextSeq(),
        ctx.campaignMonth,
      ),
    );
    const prestige = rules.declinedBattlePrestige;
    if (prestige !== undefined && decliner === ctx.playerNationId) {
      applyPrestigeChange(
        ctx,
        decliner,
        "DECLINED_BATTLE",
        prestige.rule.kind === "FIXED_LOSS"
          ? { kind: "FIXED_LOSS", amount: SafeInt(prestige.rule.amount) }
          : { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(prestige.rule.basisPoints) },
      );
    }
  }
  return true;
}
