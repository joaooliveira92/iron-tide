import type { CampaignSnapshot } from "@bluewave/campaign";
import type { BattleRequest, BattleResultInput } from "@bluewave/messages";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  makeRecordedInput,
  type OfferRequest,
  type OfferResponse,
  type RecordedInput,
} from "@bluewave/messages";
import { FIXTURE_BATTLE_OFFER_RULES, fixtureBattleOfferRules } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import {
  estimateEnemyStrength,
  unifiedSnapshotHash,
  MonthExecutor,
  type InterruptionChannel,
  type MonthResult,
} from "../src/index.js";
import {
  ATTACKER_NATION,
  DEFENDER_NATION,
  makeBattle,
  makeBattleSnapshot,
  makeShip,
} from "./battle-fixtures.js";

const SEED = "offer-seed";
const TURN = "turn-offer";

interface RunOptions {
  readonly inputs?: readonly RecordedInput[];
  readonly channel?: boolean;
  readonly rules?: typeof FIXTURE_BATTLE_OFFER_RULES | undefined;
  readonly player?: string | undefined;
}

function run(snapshot: CampaignSnapshot, options: RunOptions = {}): MonthResult {
  const { inputs = [], channel = true } = options;
  const rules = "rules" in options ? options.rules : FIXTURE_BATTLE_OFFER_RULES;
  const player = "player" in options ? options.player : ATTACKER_NATION;
  const interruptions: InterruptionChannel | undefined = channel
    ? { turnId: TURN, recordedInputs: inputs }
    : undefined;
  return new MonthExecutor().execute(snapshot, [], SEED, new DiagnosticCollector(), undefined, {
    ...(player === undefined ? {} : { playerNationId: player }),
    ...(rules === undefined ? {} : { battleOffers: rules }),
    ...(interruptions === undefined ? {} : { interruptions }),
  });
}

function offerOf(result: MonthResult): OfferRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "offer") throw new Error(`expected an offer, got ${request?.kind}`);
  return request;
}

function battleRequestOf(result: MonthResult): BattleRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "battle")
    throw new Error(`expected a battle request, got ${request?.kind}`);
  return request;
}

function battleResult(request: BattleRequest): RecordedInput {
  const payload: BattleResultInput = {
    interruptionId: request.interruptionId,
    battleId: request.battleId,
    winnerId: ATTACKER_NATION,
    loserId: DEFENDER_NATION,
    attackerLosses: [],
    defenderLosses: [],
    damageReport: {},
  };
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "battle",
    interruptionId: request.interruptionId,
    payload,
  });
}

function answer(request: OfferRequest, response: OfferResponse): RecordedInput {
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "offer",
    interruptionId: request.interruptionId,
    payload: { interruptionId: request.interruptionId, battleId: request.battleId, response },
  });
}

function warSnapshot(options: { twoAreas?: boolean } = {}): CampaignSnapshot {
  if (options.twoAreas !== true) return makeBattleSnapshot();
  return makeBattleSnapshot({
    areas: ["a-1", "a-2"],
    attackerShips: [
      makeShip("g1", "dv-att-a", ATTACKER_NATION, { firepower: 200 }),
      makeShip("g2", "dv-att-b", ATTACKER_NATION, { firepower: 200 }),
      makeShip("g3", "dv-att-a", ATTACKER_NATION, { firepower: 200, loc: "a-2" }),
      makeShip("g4", "dv-att-b", ATTACKER_NATION, { firepower: 200, loc: "a-2" }),
    ],
    defenderShips: [
      makeShip("f1", "dv-def-a", DEFENDER_NATION, { firepower: 200 }),
      makeShip("f2", "dv-def-b", DEFENDER_NATION, { firepower: 200 }),
      makeShip("f3", "dv-def-a", DEFENDER_NATION, { firepower: 200, loc: "a-2" }),
      makeShip("f4", "dv-def-b", DEFENDER_NATION, { firepower: 200, loc: "a-2" }),
    ],
  });
}

const exact = fixtureBattleOfferRules({ kind: "EXACT", showComposition: false });

describe("the offer (R3, R4, R13)", () => {
  it("suspends a player-involved generated battle at an offer holding exactly the R4 fields", () => {
    const result = run(warSnapshot(), { rules: exact });
    expect(result.outcome).toBe("suspended");
    expect(result.suspended?.reason).toBe("awaiting-input");
    const request = offerOf(result);

    expect(Object.keys(request).sort()).toEqual(
      [
        "acceptanceClass",
        "areaId",
        "attackerId",
        "battleId",
        "bodyKey",
        "declineStatementKeys",
        "defenderId",
        "estimate",
        "interpolation",
        "interruptionId",
        "kind",
        "missionType",
        "ordinal",
        "phase",
        "playerForce",
        "playerSide",
        "subjectKey",
        "supportForcePresent",
        "titleKey",
        "turnId",
      ].sort(),
    );
    expect(request).toMatchObject({
      phase: "battle_resolution",
      ordinal: 0,
      missionType: "FLEET_BATTLE",
      acceptanceClass: "OPTIONAL",
      areaId: "a-1",
      attackerId: ATTACKER_NATION,
      defenderId: DEFENDER_NATION,
      playerSide: "ATTACKER",
      supportForcePresent: false,
      estimate: { model: "EXACT", strength: 400 },
    });
    expect(request.playerForce.map((s) => s.shipId)).toEqual(["g1", "g2"]);
    expect(request.declineStatementKeys.length).toBeGreaterThan(0);
  });

  it("never carries enemy identities, the battle seed, the manifest hash or any input hash", () => {
    const first = run(warSnapshot(), { rules: exact });
    const manifest = first.finalSnapshot.wars.battleManifests?.[0];
    if (manifest === undefined) throw new Error("expected a generated manifest");
    const text = JSON.stringify(offerOf(first));
    for (const secret of ["f1", "f2", manifest.battleSeed, manifest.manifestHash, "inputHash"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("offers the defender's side too, estimating the attacker", () => {
    const request = offerOf(run(warSnapshot(), { rules: exact, player: DEFENDER_NATION }));
    expect(request.playerSide).toBe("DEFENDER");
    expect(request.playerForce.map((s) => s.shipId)).toEqual(["f1", "f2"]);
    expect(request.estimate.strength).toBe(400);
  });

  it("is identical on every re-execution of the suspended month", () => {
    const a = run(warSnapshot());
    const b = run(warSnapshot());
    expect(offerOf(a)).toEqual(offerOf(b));
    expect(unifiedSnapshotHash(a.finalSnapshot)).toBe(unifiedSnapshotHash(b.finalSnapshot));
  });

  it("never offers a battle between other nations", () => {
    const base = warSnapshot();
    const third = { ...base, nations: new Map(base.nations) };
    third.nations.set("ITA", { ...base.nations.get(ATTACKER_NATION)!, id: "ITA", fleets: [] });
    const control = run(third, { channel: false, player: "ITA" });
    const withChannel = run(third, { player: "ITA" });
    expect(withChannel.outcome).toBe("completed");
    expect(unifiedSnapshotHash(withChannel.finalSnapshot)).toBe(
      unifiedSnapshotHash(control.finalSnapshot),
    );
  });

  it("yields no offer for a battle that was never generated (no eligible force, S-1 exclusion)", () => {
    const weak = makeBattleSnapshot({
      attackerShips: [makeShip("g1", "dv-att-a", ATTACKER_NATION, { firepower: 10 })],
    });
    expect(run(weak).outcome).toBe("completed");
    const laidUp = makeBattleSnapshot({
      attackerShips: [
        makeShip("g1", "dv-att-a", ATTACKER_NATION, { firepower: 200, readiness: "MOTHBALLED" }),
        makeShip("g2", "dv-att-b", ATTACKER_NATION, { firepower: 200, readiness: "MOTHBALLED" }),
      ],
    });
    expect(run(laidUp).outcome).toBe("completed");
  });

  it("does not offer a mission type outside FLEET_BATTLE and CRUISER_BATTLE", () => {
    const snapshot = makeBattleSnapshot({ wars: [], battles: [makeBattle()] });
    expect(run(snapshot).outcome).toBe("completed");
  });
});

describe("dormancy (R1, R3)", () => {
  it("without a ruleset section the pre-existing battle request is raised unchanged", () => {
    const request = run(warSnapshot(), { rules: undefined }).suspended?.request;
    expect(request?.kind).toBe("battle");
  });

  it("without an interruption channel the output is byte-identical with and without the section", () => {
    const configured = run(warSnapshot(), { channel: false });
    const dormant = run(warSnapshot(), { channel: false, rules: undefined, player: undefined });
    const nations = new Map(configured.finalSnapshot.nations);
    const player = nations.get(ATTACKER_NATION)!;
    const dormantPlayer = dormant.finalSnapshot.nations.get(ATTACKER_NATION)!;
    nations.set(ATTACKER_NATION, {
      ...player,
      prestige: dormantPlayer.prestige,
      prestigeLastChange: dormantPlayer.prestigeLastChange,
    });
    expect(unifiedSnapshotHash({ ...configured.finalSnapshot, nations })).toBe(
      unifiedSnapshotHash(dormant.finalSnapshot),
    );
    expect(configured.randomLedger.hash()).toBe(dormant.randomLedger.hash());
    const withoutPrestige = (r: MonthResult) =>
      r.eventLedger.all.filter((e) => e.body.kind !== "PrestigeChanged");
    expect(withoutPrestige(configured).map((e) => e.body)).toEqual(
      withoutPrestige(dormant).map((e) => e.body),
    );
  });

  it("without the player nation the section raises nothing", () => {
    const result = run(warSnapshot(), { player: undefined });
    expect(result.suspended?.request?.kind).toBe("battle");
  });
});

describe("the estimate (R5)", () => {
  const model = (m: Parameters<typeof fixtureBattleOfferRules>[0]) => fixtureBattleOfferRules(m);

  it("bands the true strength with explicit rounding", () => {
    const banded = (rounding: "FLOOR" | "CEIL" | "HALF_UP") =>
      offerOf(
        run(warSnapshot(), {
          rules: model({
            kind: "BANDED",
            bandWidthStrength: 150,
            rounding,
            showComposition: false,
          }),
        }),
      ).estimate;
    expect(banded("FLOOR")).toEqual({ model: "BANDED", strength: 300 });
    expect(banded("CEIL")).toEqual({ model: "BANDED", strength: 450 });
    expect(banded("HALF_UP")).toEqual({ model: "BANDED", strength: 450 });
  });

  it("records no draw for a non-perturbing model", () => {
    const draws = run(warSnapshot(), { rules: exact }).randomLedger.all;
    expect(draws.filter((d) => d.streamId.startsWith("battle-offer"))).toEqual([]);
  });

  it("records a full ledger entry for a perturbing model, and the estimate stays inside the bound", () => {
    const first = run(warSnapshot());
    const request = offerOf(first);
    expect(request.estimate.model).toBe("PERTURBED");
    expect(request.estimate.strength).toBeGreaterThanOrEqual(340);
    expect(request.estimate.strength).toBeLessThanOrEqual(460);

    const entries = first.randomLedger.all.filter((d) => d.streamId.startsWith("battle-offer"));
    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry).toMatchObject({
      streamId: "battle-offer/estimate",
      entityKey: `${request.battleId}/DEFENDER`,
      phase: "battle_resolution",
      reasonCode: "BATTLE_OFFER_ESTIMATE_PERTURBED",
    });
    expect(entry?.rulesetVersion).toBe(first.finalSnapshot.rulesetVersion);
    expect(entry?.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Number.isInteger(entry?.draw)).toBe(true);
    expect(entry?.outcome.length).toBeGreaterThan(0);
    const again = run(warSnapshot());
    expect(again.randomLedger.all).toEqual(first.randomLedger.all);
  });

  it("is a pure integer function of the true strength and the model", () => {
    const perturbed = {
      kind: "PERTURBED",
      errorBoundBp: 1_500,
      rounding: "HALF_UP",
      showComposition: false,
    } as const;
    expect(estimateEnemyStrength({ kind: "EXACT", showComposition: false }, 401, 0)).toBe(401);
    expect(estimateEnemyStrength(perturbed, 400, 1_500)).toBe(460);
    expect(estimateEnemyStrength(perturbed, 400, -1_500)).toBe(340);
    expect(estimateEnemyStrength(perturbed, 3, 1_000)).toBe(3);
    expect(estimateEnemyStrength(perturbed, 5, 1_000)).toBe(6);
    expect(estimateEnemyStrength({ ...perturbed, rounding: "FLOOR" }, 5, 1_000)).toBe(5);
    expect(estimateEnemyStrength({ ...perturbed, rounding: "CEIL" }, 5, 100)).toBe(6);
    expect(estimateEnemyStrength(perturbed, 0, 1_500)).toBe(0);
    expect(() => estimateEnemyStrength(perturbed, 1.5, 0)).toThrow();
    expect(() => estimateEnemyStrength(perturbed, -1, 0)).toThrow();
  });
});

describe("accept and delegate (R6, R7)", () => {
  const nonOffered = () => run(warSnapshot(), { channel: false });

  it("delegate resumes the month with the state of the non-offered run", () => {
    const request = offerOf(run(warSnapshot()));
    const resumed = run(warSnapshot(), { inputs: [answer(request, "delegate")] });
    expect(resumed.outcome).toBe("completed");
    const control = nonOffered();
    expect(unifiedSnapshotHash(resumed.finalSnapshot)).toBe(
      unifiedSnapshotHash(control.finalSnapshot),
    );
    expect(resumed.finalSnapshot.wars.wars).toEqual(control.finalSnapshot.wars.wars);
    expect(resumed.finalSnapshot.wars.battles).toEqual(control.finalSnapshot.wars.battles);

    const answered = resumed.eventLedger.all.filter((e) => e.eventType === "BattleOfferAnswered");
    expect(answered).toHaveLength(1);
    expect(answered[0]?.body).toEqual({
      kind: "BattleOfferAnswered",
      nationId: ATTACKER_NATION,
      battleId: request.battleId,
      missionType: "FLEET_BATTLE",
      response: "delegate",
      resolutionMode: "AUTO_RESOLVE",
    });
  });

  it("accept suspends on a battle request instead of auto-resolving", () => {
    const request = offerOf(run(warSnapshot()));
    const accepted = run(warSnapshot(), { inputs: [answer(request, "accept")] });
    expect(accepted.outcome).toBe("suspended");
    expect(accepted.suspended?.reason).toBe("awaiting-input");
    const battle = battleRequestOf(accepted);
    expect(battle).toMatchObject({
      ordinal: 1,
      battleId: request.battleId,
      attackerId: ATTACKER_NATION,
      defenderId: DEFENDER_NATION,
    });
    expect(
      accepted.eventLedger.all.filter((e) => e.eventType === "BattleOfferAnswered"),
    ).toHaveLength(1);
  });

  it("accept + a recorded battle result resolves the player-fought battle exactly once", () => {
    const request = offerOf(run(warSnapshot()));
    const accepted = run(warSnapshot(), { inputs: [answer(request, "accept")] });
    const battle = battleRequestOf(accepted);
    const resumed = run(warSnapshot(), {
      inputs: [answer(request, "accept"), battleResult(battle)],
    });
    expect(resumed.outcome).toBe("completed");
    const recorded = resumed.finalSnapshot.wars.battles.find((b) => b.id === battle.battleId);
    expect(recorded?.phase).toBe("resolved");
    expect(recorded?.result?.explanation).toContain("player-resolved");

    const replay = run(warSnapshot(), {
      inputs: [answer(request, "accept"), battleResult(battle)],
    });
    expect(unifiedSnapshotHash(replay.finalSnapshot)).toBe(
      unifiedSnapshotHash(resumed.finalSnapshot),
    );
  });

  it("costs no victory points: the war score equals the non-offered run's", () => {
    const request = offerOf(run(warSnapshot()));
    const resumed = run(warSnapshot(), { inputs: [answer(request, "delegate")] });
    const control = nonOffered();
    const score = (r: MonthResult) =>
      r.finalSnapshot.wars.wars.map((w) => [w.attackerWarScore, w.defenderWarScore]);
    expect(score(resumed)).toEqual(score(control));
  });
});

describe("several offers in one month (R3, R15)", () => {
  it("arrive in canonical order, each consumed once; suspend-resume equals one run with every response", () => {
    const snapshot = warSnapshot({ twoAreas: true });
    const first = offerOf(run(snapshot, { rules: exact }));
    expect(first).toMatchObject({ ordinal: 0, areaId: "a-1" });
    const inputs: RecordedInput[] = [answer(first, "delegate")];

    const secondResult = run(snapshot, { rules: exact, inputs });
    const second = offerOf(secondResult);
    expect(second).toMatchObject({ ordinal: 1, areaId: "a-2" });
    expect(second.battleId).not.toBe(first.battleId);
    inputs.push(answer(second, "delegate"));

    const resumed = run(snapshot, { rules: exact, inputs });
    expect(resumed.outcome).toBe("completed");
    const single = run(snapshot, { rules: exact, inputs: [...inputs] });
    expect(unifiedSnapshotHash(single.finalSnapshot)).toBe(
      unifiedSnapshotHash(resumed.finalSnapshot),
    );
    expect(single.randomLedger.all).toEqual(resumed.randomLedger.all);
    expect(single.eventLedger.all).toEqual(resumed.eventLedger.all);
    expect(unifiedSnapshotHash(resumed.finalSnapshot)).toBe(
      unifiedSnapshotHash(run(snapshot, { rules: exact, channel: false }).finalSnapshot),
    );
  });
});

describe("refusals leave the offer pending (R6)", () => {
  const request = () => offerOf(run(warSnapshot(), { rules: exact }));

  function expectPending(inputs: RecordedInput[], tag: string): void {
    const original = request();
    const result = run(warSnapshot(), { rules: exact, inputs });
    expect(result.outcome).toBe("suspended");
    expect(result.suspended?.reason).toBe("invalid-input");
    expect(result.suspended?.refusalTag).toBe(tag);
    expect(result.suspended?.request).toEqual(original);
  }

  it("refuses a stale interruption id", () => {
    const good = answer(request(), "accept");
    expectPending([{ ...good, interruptionId: "stale" }], "OfferResponseStale");
  });

  it("refuses a response naming another battle", () => {
    const r = request();
    const wrong = makeRecordedInput({
      ordinal: 0,
      kind: "offer",
      interruptionId: r.interruptionId,
      payload: { interruptionId: r.interruptionId, battleId: "other", response: "accept" },
    });
    expectPending([wrong], "OfferResponseWrongBattle");
  });

  it("refuses a tampered payload and a wrong input kind", () => {
    const good = answer(request(), "accept");
    expectPending(
      [{ ...good, payload: { ...good.payload, response: "delegate" } }],
      "OfferResponseTampered",
    );
    const r = request();
    const wrongKind = makeRecordedInput({
      ordinal: 0,
      kind: "decision",
      interruptionId: r.interruptionId,
      payload: { interruptionId: r.interruptionId, decisionId: "d", optionId: "o" },
    });
    expectPending([wrongKind], "OfferResponseWrongKind");
  });

  it("refuses a duplicate response and an out-of-order one", () => {
    const r = request();
    const good = answer(r, "accept");
    expectPending([good, good], "OfferResponseDuplicate");
    expectPending([{ ...good, ordinal: 1 }], "OfferResponseOutOfOrder");
  });

  it("suspends, never defaulting, when no response is recorded", () => {
    const result = run(warSnapshot(), { rules: exact });
    expect(result.suspended?.reason).toBe("awaiting-input");
    expect(result.suspended?.refusalTag).toBeUndefined();
  });
});
