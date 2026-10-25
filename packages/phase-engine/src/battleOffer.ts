import type {
  BattleInstance,
  CampaignSnapshot,
  DeclineCounterEntry,
  DeclinedBattleRecord,
  NationState,
  Ship,
  WarDeclaration,
} from "@bluewave/campaign";
import type { BattleMissionType } from "@bluewave/combat/generation";
import {
  BATTLE_DECLINE_NOT_ALLOWED,
  BATTLE_ENEMY_DECLINED,
  BATTLE_ENEMY_PROCEEDS,
  BATTLE_SUPPORT_FORCE_ABSENT,
  BATTLE_SUPPORT_FORCE_PRESENT,
  ENEMY_DECLINE_DRAW_RANGE_BP,
  GENERATION_SEED_FORMULA_VERSION,
  SUPPORT_FORCE_DRAW_RANGE_BP,
  addSupport,
  composeSupportForce,
  enemyDeclineDrawDeclines,
  enemyDeclinePredicateHolds,
  gatherEligibleAssets,
  isDeclineAllowed,
  supportCandidateDigest,
  supportForceDrawPresent,
  supportForceStrengthCap,
  type AcceptanceClass,
  type AlliedCandidate,
  type BattleGenerationResult,
} from "@bluewave/combat/generation";
import type { BattleOfferRules } from "@bluewave/content-schema";
import { BluewaveError, SafeInt, type TurnPhase } from "@bluewave/contracts";
import { canonicalSerialize, compareCodePoints, sha256Hex } from "@bluewave/deterministic";
import {
  computeInputHash,
  computeInterruptionId,
  type OfferContent,
  type OfferForceShip,
  type OfferRequest,
  type OfferResponseInput,
  type OfferSide,
} from "@bluewave/messages";
import type { RandomEngine, RandomLedger } from "@bluewave/random";
import {
  applyWarScoreDelta,
  resolveBattleManifest,
  resolveCampaignBattleReadiness,
  resolveGenerationShipType,
  resolveShipStrength,
} from "./battles.js";
import {
  battleDeclinedEvent,
  declineThresholdReachedEvent,
  enemyDeclinedBattleEvent,
} from "./events.js";
import { suspend, type InterruptionState } from "./interruption.js";
import type { PhaseContext } from "./pipeline.js";
import { applyPrestigeChange } from "./prestigeApplication.js";

export type { OfferContent } from "@bluewave/messages";

export const OFFERED_MISSION_TYPES: readonly BattleMissionType[] = [
  "FLEET_BATTLE",
  "CRUISER_BATTLE",
];

export const BATTLE_OFFER_ESTIMATE_STREAM = "battle-offer/estimate";
export const BATTLE_OFFER_ESTIMATE_PERTURBED = "BATTLE_OFFER_ESTIMATE_PERTURBED";
export const BATTLE_OFFER_ESTIMATE_INVALID = "BATTLE_OFFER_ESTIMATE_INVALID";

export const OFFER_DECLINE_STATEMENT_KEYS: readonly string[] = [
  "ui.offer.decline.costsVictoryPoints",
  "ui.offer.decline.mayCostPrestige",
];

export const BATTLE_DECLINED_REASON = "BATTLE_DECLINED_WITH_CONSEQUENCES";

export const OFFER_DECLINE_UNPRICED = "OfferDeclineUnpriced";

export const ENEMY_DECLINE_STREAM = "battle-offer/enemy-decline";

export const SUPPORT_FORCE_STREAM = "battle-offer/support-force";

type EstimateModel = BattleOfferRules["estimateModel"];
export type Rounding = "FLOOR" | "CEIL" | "HALF_UP";

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

export function divide(numerator: bigint, denominator: bigint, rounding: Rounding): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  if (remainder === 0n || rounding === "FLOOR") return quotient;
  if (rounding === "CEIL") return quotient + 1n;
  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

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

  const support: readonly string[] =
    manifest["temporaryAssets"].length === 0
      ? []
      : (manifest["sides"].find((side) => side["sideId"] === playerSide)?.["participantIds"] ?? [])
          .filter((nationId) => nationId !== playerNationId)
          .sort(compareCodePoints);

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
    supportForcePresent: support.length > 0,
    ...(support.length > 0 ? { supportNationIds: support } : {}),
    declineStatementKeys: OFFER_DECLINE_STATEMENT_KEYS,
  };
}

export type OfferRefusal =
  | { readonly _tag: "OfferResponseDuplicate" }
  | { readonly _tag: "OfferResponseOutOfOrder" }
  | { readonly _tag: "OfferResponseWrongKind" }
  | { readonly _tag: "OfferResponseStale" }
  | { readonly _tag: "OfferResponseTampered" }
  | { readonly _tag: "OfferResponseWrongBattle" }
  | { readonly _tag: "BATTLE_DECLINE_NOT_ALLOWED" }
  | { readonly _tag: "OfferDeclineUnpriced" };

export type OfferResponseResolution =
  | { readonly status: "inactive" }
  | { readonly status: "awaiting"; readonly ordinal: number; readonly interruptionId: string }
  | {
      readonly status: "invalid";
      readonly ordinal: number;
      readonly interruptionId: string;
      readonly refusal: OfferRefusal;
    }
  | {
      readonly status: "resolved";
      readonly response: OfferResponseInput;
      readonly inputHash: string;
    };

export function consumeOfferResponse(
  state: InterruptionState | undefined,
  subject: { readonly battleId: string; readonly phase: TurnPhase },
): OfferResponseResolution {
  if (state === undefined) return { status: "inactive" };
  const ordinal = state.nextOrdinal;
  const interruptionId = computeInterruptionId({
    turnId: state.turnId,
    phase: subject.phase,
    ordinal,
    subjectKey: subject.battleId,
  });
  const refuse = (refusal: OfferRefusal): OfferResponseResolution => ({
    status: "invalid",
    ordinal,
    interruptionId,
    refusal,
  });
  const atOrdinal = state.recordedInputs.filter((input) => input.ordinal === ordinal);
  if (atOrdinal.length === 0) {
    return state.recordedInputs.some((input) => input.ordinal > ordinal)
      ? refuse({ _tag: "OfferResponseOutOfOrder" })
      : { status: "awaiting", ordinal, interruptionId };
  }
  if (atOrdinal.length > 1) return refuse({ _tag: "OfferResponseDuplicate" });
  const recorded = atOrdinal[0]!;
  if (recorded.kind !== "offer") return refuse({ _tag: "OfferResponseWrongKind" });
  if (recorded.interruptionId !== interruptionId) return refuse({ _tag: "OfferResponseStale" });
  const expectedHash = computeInputHash({
    ordinal,
    kind: "offer",
    interruptionId,
    payload: recorded.payload,
  });
  if (recorded.inputHash !== expectedHash) return refuse({ _tag: "OfferResponseTampered" });
  const response = recorded.payload as OfferResponseInput;
  if (response.interruptionId !== interruptionId) return refuse({ _tag: "OfferResponseStale" });
  if (response.battleId !== subject.battleId) return refuse({ _tag: "OfferResponseWrongBattle" });
  state.nextOrdinal = ordinal + 1;
  return { status: "resolved", response, inputHash: recorded.inputHash };
}

export type AnsweredOffer = OfferResponseInput & { readonly inputHash: string };

function offerRequestOf(
  state: InterruptionState,
  content: OfferContent,
  interruptionId: string,
  ordinal: number,
): OfferRequest {
  return {
    kind: "offer",
    turnId: state.turnId,
    interruptionId,
    phase: "battle_resolution",
    ordinal,
    subjectKey: content.battleId,
    titleKey: "messages.offer.request.title",
    bodyKey: "messages.offer.request.body",
    interpolation: {
      battleId: content.battleId,
      missionType: content.missionType,
      areaId: content.areaId,
      attackerId: content.attackerId,
      defenderId: content.defenderId,
    },
    ...content,
  };
}

export function consumeOffer(ctx: PhaseContext, content: OfferContent): AnsweredOffer | null {
  const state = ctx.interruption;
  if (state === undefined) return null;
  const phase = "battle_resolution" as const;
  const resolution = consumeOfferResponse(state, { battleId: content.battleId, phase });
  if (resolution.status === "inactive") return null;

  const ordinal = state.nextOrdinal - (resolution.status === "resolved" ? 1 : 0);
  const interruptionId =
    resolution.status === "resolved"
      ? resolution.response.interruptionId
      : resolution.interruptionId;
  const request = offerRequestOf(state, content, interruptionId, ordinal);

  switch (resolution.status) {
    case "awaiting":
      suspend(state, request, "awaiting-input");
      return null;
    case "invalid":
      suspend(state, request, "invalid-input", resolution.refusal._tag);
      return null;
    case "resolved": {
      const answered = resolution.response;
      if (answered.response === "decline") {
        const refusal =
          ctx.battleOffers === undefined ? null : declineRefusal(content, ctx.battleOffers);
        if (refusal !== null) {
          state.nextOrdinal = ordinal;
          suspend(state, request, "invalid-input", refusal._tag);
          return null;
        }
      }
      return { ...answered, inputHash: resolution.inputHash };
    }
  }
}

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
  ctx: PhaseContext,
  battle: BattleInstance,
  manifest: NonNullable<ReturnType<typeof resolveBattleManifest>>,
  content: OfferContent,
  decliner: string,
  rules: BattleOfferRules,
  responseInputHash: string,
): boolean {
  const snapshot = ctx.snapshot.current;
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
  ctx.snapshot.current = {
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
      SafeInt(price.cost),
      SafeInt(price.credit),
      SafeInt(tally.count),
      ctx.nextSeq(),
      ctx.campaignMonth,
    ),
  );
  if (tally.thresholdReached) {
    ctx.eventLedger.append(
      declineThresholdReachedEvent(
        decliner,
        battle["id"],
        SafeInt(tally.count),
        SafeInt(rules.declineCounter.threshold),
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

export type DeclineCounterRules = BattleOfferRules["declineCounter"];

export interface TallyInput {
  readonly rules: DeclineCounterRules;
  readonly repeatEachDecline: boolean;
  readonly warId: string;
  readonly nationId: string;
  readonly month: string;
  readonly wars: readonly Pick<WarDeclaration, "id" | "status">[];
}

export interface TallyResult {
  readonly entries: DeclineCounterEntry[];
  readonly count: number;
  readonly thresholdReached: boolean;
}

export function declineScopeKey(
  scope: DeclineCounterRules["scope"],
  warId: string,
  nationId: string,
): string {
  switch (scope) {
    case "WAR":
      return `WAR|${warId}|${nationId}`;
    case "NATION":
      return `NATION|${nationId}`;
    case "CAMPAIGN":
      return "CAMPAIGN";
  }
}

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

function monthLabel(index: number): string {
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

function settled(
  entry: DeclineCounterEntry,
  input: TallyInput,
): { readonly count: number; readonly anchor: string } {
  const reset = input.rules.reset;
  switch (reset.kind) {
    case "NONE":
      return { count: entry.count, anchor: entry.decayAnchorMonth };
    case "ON_WAR_END": {
      if (entry.lastWarId === input.warId)
        return { count: entry.count, anchor: entry.decayAnchorMonth };
      const last = input.wars.find((w) => w.id === entry.lastWarId);
      return last === undefined || last.status === "ENDED"
        ? { count: 0, anchor: input.month }
        : { count: entry.count, anchor: entry.decayAnchorMonth };
    }
    case "DECAY": {
      const elapsed = monthIndex(input.month) - monthIndex(entry.decayAnchorMonth);
      const periods = elapsed > 0 ? Math.floor(elapsed / reset.perMonths) : 0;
      if (periods === 0) return { count: entry.count, anchor: entry.decayAnchorMonth };
      const count = Math.max(0, entry.count - periods * reset.countRemoved);
      return {
        count,
        anchor:
          count === 0
            ? input.month
            : monthLabel(monthIndex(entry.decayAnchorMonth) + periods * reset.perMonths),
      };
    }
  }
}

export function tallyDecline(
  entries: readonly DeclineCounterEntry[] | undefined,
  input: TallyInput,
): TallyResult {
  const key = declineScopeKey(input.rules.scope, input.warId, input.nationId);
  const existing = entries ?? [];
  const current = existing.find((e) => e.key === key);
  const before =
    current === undefined ? { count: 0, anchor: input.month } : settled(current, input);
  const anchor = before.count === 0 ? input.month : before.anchor;
  const count = before.count + 1;
  const next: DeclineCounterEntry = {
    key,
    nationId: input.nationId,
    lastWarId: input.warId,
    count,
    decayAnchorMonth: anchor,
  };
  const threshold = input.rules.threshold;
  return {
    entries:
      current === undefined ? [...existing, next] : existing.map((e) => (e.key === key ? next : e)),
    count,
    thresholdReached: count >= threshold && (before.count < threshold || input.repeatEachDecline),
  };
}

export type GeneratedManifest = BattleGenerationResult["manifests"][number];

function enemyOf(manifest: GeneratedManifest, playerNationId: string): string | null {
  if (!OFFERED_MISSION_TYPES.some((mission) => mission === manifest["missionType"])) return null;
  if (manifest["attackerId"] === playerNationId) return manifest["defenderId"];
  if (manifest["defenderId"] === playerNationId) return manifest["attackerId"];
  return null;
}

function committedStrength(
  snapshot: CampaignSnapshot,
  nationId: string,
  committed: ReadonlySet<string>,
): number {
  const nation = snapshot["nations"].get(nationId);
  if (nation === undefined) return 0;
  let total = 0n;
  for (const fleet of nation["fleets"]) {
    for (const ship of fleet["ships"]) {
      if (committed.has(ship["id"])) total += BigInt(resolveShipStrength(snapshot, ship["id"]));
    }
  }
  return Number(total);
}

function drawAndRecord<Classification extends { outcome: string; reasonCode: string }>(
  ctx: PhaseContext,
  engine: RandomEngine,
  step: {
    readonly streamId: string;
    readonly battleId: string;
    readonly rangeBp: number;
    readonly inputs: unknown;
    readonly classify: (draw: number) => Classification;
  },
): Classification {
  const draw = Math.floor(engine.stream(`${step.streamId}/${step.battleId}`).next() * step.rangeBp);
  const classification = step.classify(draw);
  ctx.randomLedger.record({
    streamId: step.streamId,
    entityKey: step.battleId,
    phase: "battle_generation",
    rulesetVersion: ctx.snapshot.read("rulesetVersion"),
    inputHash: sha256Hex(canonicalSerialize(step.inputs)),
    draw,
    outcome: classification.outcome,
    reasonCode: classification.reasonCode,
  });
  return classification;
}

export function applyEnemyDeclines(
  ctx: PhaseContext,
  generated: BattleGenerationResult,
): BattleGenerationResult {
  const rules: BattleOfferRules | undefined = ctx.battleOffers;
  const playerNationId = ctx.playerNationId;
  if (rules === undefined || playerNationId === undefined || ctx.interruption === undefined)
    return generated;
  const engine = ctx.rng.engine();

  const rule = rules.enemyDecline;
  const keptIndexes: number[] = [];
  let declined = false;
  generated.manifests.forEach((manifest, index) => {
    const enemyNationId = enemyOf(manifest, playerNationId);
    if (enemyNationId === null || manifest["acceptanceClass"] === "OPERATIONALLY_UNAVOIDABLE") {
      keptIndexes.push(index);
      return;
    }
    const committed = new Set(manifest["persistentAssets"]);
    const snapshot = ctx.snapshot.current;
    const holds = enemyDeclinePredicateHolds(
      rule.comparison,
      rule.thresholdBp,
      committedStrength(snapshot, enemyNationId, committed),
      committedStrength(snapshot, playerNationId, committed),
    );
    if (!holds) {
      keptIndexes.push(index);
      return;
    }

    const battleId = manifest["battleId"];
    const { declines } = drawAndRecord(ctx, engine, {
      streamId: ENEMY_DECLINE_STREAM,
      battleId,
      rangeBp: ENEMY_DECLINE_DRAW_RANGE_BP,
      inputs: {
        battleId,
        manifestHash: manifest["manifestHash"],
        sectionVersion: rules.sectionVersion,
        comparison: rule.comparison,
        thresholdBp: rule.thresholdBp,
        probabilityBp: rule.probabilityBp,
      },
      classify: (draw) => {
        const declines = enemyDeclineDrawDeclines(draw, rule.probabilityBp);
        return {
          declines,
          outcome: declines ? "DECLINED" : "PROCEEDS",
          reasonCode: declines ? BATTLE_ENEMY_DECLINED : BATTLE_ENEMY_PROCEEDS,
        };
      },
    });
    if (!declines) {
      keptIndexes.push(index);
      return;
    }

    declined = true;
    const cost = rule.enemyCostPoints ?? 0;
    const war = snapshot["wars"]["wars"].find((w) => w["id"] === manifest["warId"]);
    if (cost > 0 && war !== undefined) {
      const enemyIsAttacker = war["attackerSideMembers"].includes(enemyNationId);
      ctx.snapshot.current = applyWarScoreDelta(
        snapshot,
        war["id"],
        enemyIsAttacker ? { attacker: -cost, defender: 0 } : { attacker: 0, defender: -cost },
        ctx.campaignMonth,
      );
    }
    ctx.eventLedger.append(
      enemyDeclinedBattleEvent(
        playerNationId,
        enemyNationId,
        battleId,
        manifest["missionType"],
        manifest["areaId"],
        SafeInt(cost),
        ctx.nextSeq(),
        ctx.campaignMonth,
      ),
    );
  });
  if (!declined) return generated;

  const keptIds = new Set(keptIndexes.map((i) => generated.battleIds[i]!));
  return {
    ...generated,
    manifests: keptIndexes.map((i) => generated.manifests[i]!),
    battleIds: keptIndexes.map((i) => generated.battleIds[i]!),
    records: generated.records.filter((record) => record.accepted.every((id) => keptIds.has(id))),
  };
}

function supportingNations(
  snapshot: CampaignSnapshot,
  manifest: GeneratedManifest,
  playerNationId: string,
  enemyNationId: string,
): string[] {
  const war = snapshot["wars"]["wars"].find((w) => w["id"] === manifest["warId"]);
  const enemySide: readonly string[] =
    war === undefined
      ? [enemyNationId]
      : war["attackerSideMembers"].includes(enemyNationId)
        ? war["attackerSideMembers"]
        : war["defenderSideMembers"];
  const allies = new Set<string>();
  for (const relation of snapshot["politics"]["relations"]) {
    if (relation["relation"] !== "allied") continue;
    if (relation["nationA"] === playerNationId) allies.add(relation["nationB"]);
    else if (relation["nationB"] === playerNationId) allies.add(relation["nationA"]);
  }
  return [...allies]
    .filter(
      (nationId) =>
        nationId !== manifest["attackerId"] &&
        nationId !== manifest["defenderId"] &&
        !enemySide.includes(nationId),
    )
    .sort(compareCodePoints);
}

export function applySupportForces(
  ctx: PhaseContext,
  generated: BattleGenerationResult,
): BattleGenerationResult {
  const rules: BattleOfferRules | undefined = ctx.battleOffers;
  const playerNationId = ctx.playerNationId;
  if (rules === undefined || playerNationId === undefined || ctx.interruption === undefined)
    return generated;
  const engine = ctx.rng.engine();

  const rule = rules.supportForce;
  const snapshot = ctx.snapshot.current;
  const taken = new Set<string>(generated.manifests.flatMap((m) => m["persistentAssets"]));
  let result = generated;

  generated.manifests.forEach((manifest) => {
    const enemyNationId = enemyOf(manifest, playerNationId);
    if (enemyNationId === null) return;
    const candidates: AlliedCandidate[] = [];
    for (const nationId of supportingNations(snapshot, manifest, playerNationId, enemyNationId)) {
      const nation = snapshot["nations"].get(nationId);
      if (nation === undefined) continue;
      const { eligible } = gatherEligibleAssets({
        ships: nation["fleets"]
          .flatMap((fleet) => fleet["ships"])
          .filter((s) => !s["isUnderConstruction"]),
        sideId: manifest["attackerId"] === playerNationId ? "ATTACKER" : "DEFENDER",
        nationId,
        areaId: manifest["areaId"],
        reservedAssetIds: taken,
        resolveStrength: (ship) => resolveShipStrength(snapshot, ship["id"]),
        resolveShipType: resolveGenerationShipType,
        resolveReadiness: (ship) => resolveCampaignBattleReadiness(snapshot, ship["id"]),
      });
      for (const asset of eligible) {
        candidates.push({
          assetId: asset.assetId,
          nationId,
          effectiveStrength: asset.effectiveStrength,
          treatyCommitmentPriority: 0,
          missionFit: 0,
        });
      }
    }
    const cap = supportForceStrengthCap(
      committedStrength(snapshot, playerNationId, new Set(manifest["persistentAssets"])),
      rule.shareOfCapBp,
    );
    const composition = composeSupportForce(candidates, cap);
    if (composition.length === 0) return;

    const battleId = manifest["battleId"];
    const { present } = drawAndRecord(ctx, engine, {
      streamId: SUPPORT_FORCE_STREAM,
      battleId,
      rangeBp: SUPPORT_FORCE_DRAW_RANGE_BP,
      inputs: {
        battleId,
        manifestHash: manifest["manifestHash"],
        sectionVersion: rules.sectionVersion,
        presenceChanceBp: rule.presenceChanceBp,
        shareOfCapBp: rule.shareOfCapBp,
        source: rule.source,
        capStrength: cap,
        candidates: supportCandidateDigest(candidates),
        composition: composition.map((c) => c.assetId),
      },
      classify: (draw) => {
        const isPresent = supportForceDrawPresent(draw, rule.presenceChanceBp);
        return {
          present: isPresent,
          outcome: isPresent ? "PRESENT" : "ABSENT",
          reasonCode: isPresent ? BATTLE_SUPPORT_FORCE_PRESENT : BATTLE_SUPPORT_FORCE_ABSENT,
        };
      },
    });
    if (!present) return;

    for (const candidate of composition) taken.add(candidate.assetId);
    result = addSupport(result, {
      battleId,
      playerNationId,
      support: composition.map((candidate) => ({
        nationId: candidate.nationId,
        assetId: candidate.assetId,
      })),
      rngVersion: manifest["rngVersion"],
      campaignSeed: ctx.rng.seed(),
      campaignMonth: ctx.campaignMonth,
      battleGenerationFormulaVersion: GENERATION_SEED_FORMULA_VERSION,
    });
  });
  return result;
}
