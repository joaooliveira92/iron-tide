// T-1 04 (spec #109 R8, ticket #113): declining a battle offer. A decline is a terminal declined record: the battle is
// never resolved or fought, its ship reservations are released with no damage or loss, and the decliner's war score falls
// by the ruleset's decline rule through the one war-score seam (same clamp, same surrender check). All arithmetic is
// integer with the stated rounding; no value here is a default - a mission the ruleset does not price, or a distance
// modifier whose measure the engine does not define, refuses the decline instead of making it free.
import type {
  BattleInstance,
  CampaignSnapshot,
  DeclinedBattleRecord,
  NationState,
} from "@bluewave/campaign";
import { BATTLE_DECLINE_NOT_ALLOWED, isDeclineAllowed } from "@bluewave/combat";
import type { AcceptanceClass } from "@bluewave/combat";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { applyWarScoreDelta, type resolveBattleManifest } from "./battles.js";
import { divide, type OfferContent } from "./battleOffer.js";
import { tallyDecline } from "./declineCounter.js";
import { battleDeclinedEvent, declineThresholdReachedEvent } from "./events.js";
import type { MonthContext } from "./monthContext.js";
import type { OfferRefusal } from "./interruption.js";
import { applyPrestigeChange } from "./prestigeApplication.js";

/** The stable reason a decline was applied (the combat vocabulary's code for a decline that costs). */
export const BATTLE_DECLINED_REASON = "BATTLE_DECLINED_WITH_CONSEQUENCES";

/** The decline of a mission the ruleset does not price, or priced by a measure the engine does not define. */
export const OFFER_DECLINE_UNPRICED = "OfferDeclineUnpriced";

/** The war-score cost to the decliner and the credit to the opponent, in whole points. */
export interface DeclinePrice {
  readonly cost: number;
  readonly credit: number;
}

/**
 * Price a decline from the ruleset: the mission's points (G2), no distance modifier (its measure is an opaque id the engine
 * does not define), and the opponent credit shape (G3). `null` = the decline cannot be priced and is refused.
 */
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

/**
 * Whether the player may decline this offer: an OPERATIONALLY_UNAVOIDABLE mission refuses with the existing typed refusal
 * (`BATTLE_DECLINE_NOT_ALLOWED`), and an unpriceable decline refuses rather than being free. `null` = allowed.
 */
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

/**
 * Apply an accepted decline exactly once. The battle becomes `declined` (it never reaches `resolved`), the ships the
 * battle reserved are released untouched, the decliner's war score changes through the war-score seam, and one terminal
 * record and one event are written. A battle that already has a record is left alone (a duplicate is never scored twice).
 * Returns false only for that duplicate.
 */
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

  // The tally of the player nation's declines (R9): applied with the record, so a duplicate (returned above) never counts.
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
    // R10: the crossing costs the PLAYER prestige, only through the S-2 seam and only when the ruleset authors the rule.
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
