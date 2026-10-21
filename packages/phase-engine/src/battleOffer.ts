// T-1 03 (spec #109 R3-R5, ticket #112): the battle offer's content. Everything here is pure: the enemy-strength
// estimate is an integer function of the enemy force and the ruleset estimate model, and the offer carries only what
// the player may see (R4). The one random input, a perturbation draw, comes from a domain-separated stream keyed by
// battle and side and is recorded in the random ledger.
import type { BattleInstance, CampaignSnapshot, Ship } from "@bluewave/campaign";
import type { BattleMissionType } from "@bluewave/combat";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import type { OfferEstimate, OfferForceShip, OfferSide } from "@bluewave/messages";
import type { RandomEngine, RandomLedger } from "@bluewave/random";
import { resolveBattleManifest, resolveShipStrength } from "./battles.js";

/** The registry missions an offer is raised for (spec #109 R13); every other mission stays registered and unreachable. */
export const OFFERED_MISSION_TYPES: readonly BattleMissionType[] = [
  "FLEET_BATTLE",
  "CRUISER_BATTLE",
];

export const BATTLE_OFFER_ESTIMATE_STREAM = "battle-offer/estimate";
export const BATTLE_OFFER_ESTIMATE_PERTURBED = "BATTLE_OFFER_ESTIMATE_PERTURBED";
export const BATTLE_OFFER_ESTIMATE_INVALID = "BATTLE_OFFER_ESTIMATE_INVALID";

/** The message keys of the qualitative decline statement (manual p.67); the amount is never disclosed. */
export const OFFER_DECLINE_STATEMENT_KEYS: readonly string[] = [
  "ui.offer.decline.costsVictoryPoints",
  "ui.offer.decline.mayCostPrestige",
];

type EstimateModel = BattleOfferRules["estimateModel"];
type Rounding = "FLOOR" | "CEIL" | "HALF_UP";

function assertNonNegativeSafeInteger(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BluewaveError(BATTLE_OFFER_ESTIMATE_INVALID, {
      code: BATTLE_OFFER_ESTIMATE_INVALID,
      reason: `${what} must be a non-negative safe integer`,
      value,
    });
  }
}

function toSafeInteger(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new BluewaveError(BATTLE_OFFER_ESTIMATE_INVALID, {
      code: BATTLE_OFFER_ESTIMATE_INVALID,
      reason: "estimate exceeds the safe integer range",
    });
  }
  return Number(value);
}

/** Exact non-negative integer division with the stated rounding, from a bigint intermediate. */
function divide(numerator: bigint, denominator: bigint, rounding: Rounding): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n || rounding === "FLOOR") return quotient;
  if (rounding === "CEIL") return quotient + 1n;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

/**
 * The enemy-strength estimate shown on an offer: a pure integer function of the true strength and the ruleset model
 * (spec #109 R5). `perturbationBp` is the signed perturbation in basis points; only the PERTURBED model reads it, and
 * the caller supplies it from a recorded draw. Checked arithmetic, explicit rounding, never below zero.
 */
export function estimateEnemyStrength(
  model: EstimateModel,
  trueStrength: number,
  perturbationBp: number,
): number {
  assertNonNegativeSafeInteger(trueStrength, "true strength");
  const strength = BigInt(trueStrength);
  switch (model.kind) {
    case "EXACT":
      return trueStrength;
    case "BANDED": {
      const width = BigInt(model.bandWidthStrength);
      return toSafeInteger(divide(strength, width, model.rounding) * width);
    }
    case "PERTURBED": {
      if (!Number.isSafeInteger(perturbationBp) || Math.abs(perturbationBp) > model.errorBoundBp) {
        throw new BluewaveError(BATTLE_OFFER_ESTIMATE_INVALID, {
          code: BATTLE_OFFER_ESTIMATE_INVALID,
          reason: "perturbation is outside the model's error bound",
          perturbationBp,
        });
      }
      return toSafeInteger(
        divide(strength * BigInt(10_000 + perturbationBp), 10_000n, model.rounding),
      );
    }
  }
}

function shipsOf(snapshot: CampaignSnapshot, nationId: string): readonly Ship[] {
  const nation = snapshot["nations"].get(nationId);
  return nation === undefined ? [] : nation["fleets"].flatMap((fleet) => fleet["ships"]);
}

/** The content of one offer, before it is wrapped in a request with its interruption identity. */
export interface OfferContent {
  readonly battleId: string;
  readonly missionType: string;
  readonly acceptanceClass: string;
  readonly areaId: string;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly playerSide: OfferSide;
  readonly playerForce: readonly OfferForceShip[];
  readonly estimate: OfferEstimate;
  readonly supportForcePresent: boolean;
  readonly declineStatementKeys: readonly string[];
}

/** Whether a battle is a player-involved, offered mission, and if so its manifest. `null` = not offered (R3, R13). */
export function offeredManifestFor(
  snapshot: CampaignSnapshot,
  battle: BattleInstance,
  playerNationId: string,
): NonNullable<ReturnType<typeof resolveBattleManifest>> | null {
  if (battle["attackerId"] !== playerNationId && battle["defenderId"] !== playerNationId) {
    return null;
  }
  const manifest = resolveBattleManifest(snapshot, battle);
  if (manifest === null) return null;
  const mission = manifest["missionType"];
  return OFFERED_MISSION_TYPES.some((offered) => offered === mission) ? manifest : null;
}

/**
 * Build the offer for a player-involved battle: the player's own selected force and an estimate of the enemy's. The enemy
 * force is read only to compute the estimate and is never copied into the content. A perturbing model draws from the
 * stream `battle-offer/estimate/<battle>/<enemy side>` and records the draw.
 */
export function buildOfferContent(input: {
  readonly snapshot: CampaignSnapshot;
  readonly battle: BattleInstance;
  readonly manifest: NonNullable<ReturnType<typeof resolveBattleManifest>>;
  readonly playerNationId: string;
  readonly rules: BattleOfferRules;
  readonly randomEngine: RandomEngine;
  readonly randomLedger: RandomLedger;
}): OfferContent {
  const { snapshot, battle, manifest, playerNationId, rules } = input;
  const playerSide: OfferSide = battle["attackerId"] === playerNationId ? "ATTACKER" : "DEFENDER";
  const enemySide: OfferSide = playerSide === "ATTACKER" ? "DEFENDER" : "ATTACKER";
  const enemyNationId = playerSide === "ATTACKER" ? battle["defenderId"] : battle["attackerId"];

  const committed = new Set(manifest["persistentAssets"]);
  const playerForce: OfferForceShip[] = shipsOf(snapshot, playerNationId)
    .filter((ship) => committed.has(ship["id"]))
    .map((ship) => ({ shipId: ship["id"], name: ship["name"], classId: ship["classId"] }))
    .sort((a, b) => compareCodePoints(a.shipId, b.shipId));

  let trueStrength = 0n;
  for (const ship of shipsOf(snapshot, enemyNationId)) {
    if (committed.has(ship["id"]))
      trueStrength += BigInt(resolveShipStrength(snapshot, ship["id"]));
  }

  const model = rules.estimateModel;
  let perturbationBp = 0;
  if (model.kind === "PERTURBED") {
    const entityKey = `${battle["id"]}/${enemySide}`;
    const stream = input.randomEngine.stream(`${BATTLE_OFFER_ESTIMATE_STREAM}/${entityKey}`);
    const draw = Math.floor(stream.next() * (2 * model.errorBoundBp + 1));
    perturbationBp = draw - model.errorBoundBp;
    input.randomLedger.record({
      streamId: BATTLE_OFFER_ESTIMATE_STREAM,
      entityKey,
      phase: "battle_resolution",
      rulesetVersion: snapshot["rulesetVersion"],
      inputHash: sha256Hex(
        canonicalSerialize({
          battleId: battle["id"],
          enemySide,
          manifestHash: manifest["manifestHash"],
          sectionVersion: rules.sectionVersion,
          model: model.kind,
          errorBoundBp: model.errorBoundBp,
          rounding: model.rounding,
        }),
      ),
      draw,
      outcome: `perturbationBp:${String(perturbationBp)}`,
      reasonCode: BATTLE_OFFER_ESTIMATE_PERTURBED,
    });
  }

  return {
    battleId: battle["id"],
    missionType: manifest["missionType"],
    acceptanceClass: manifest["acceptanceClass"],
    areaId: battle["areaId"],
    attackerId: battle["attackerId"],
    defenderId: battle["defenderId"],
    playerSide,
    playerForce,
    estimate: {
      model: model.kind,
      strength: estimateEnemyStrength(model, toSafeInteger(trueStrength), perturbationBp),
    },
    // The support force is a later ticket's mechanic (#116); until it lands no battle carries one.
    supportForcePresent: false,
    declineStatementKeys: OFFER_DECLINE_STATEMENT_KEYS,
  };
}
