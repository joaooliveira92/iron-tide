import type { CampaignSnapshot } from "@bluewave/campaign";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  makeRecordedInput,
  type OfferRequest,
  type OfferResponse,
  type RecordedInput,
} from "@bluewave/messages";
import { FIXTURE_BATTLE_OFFER_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import {
  unifiedSnapshotHash,
  MonthExecutor,
  type InterruptionChannel,
  type MonthResult,
} from "../src/index.js";
import {
  ATTACKER_NATION,
  DEFENDER_NATION,
  makeBattleSnapshot,
  makeNation,
  makeShip,
} from "./battle-fixtures.js";

type Rules = typeof FIXTURE_BATTLE_OFFER_RULES;
const SEED = "support-force-seed";
const TURN = "turn-support-force";
const STREAM = "battle-offer/support-force";
const ALLY = "ITA";

function rules(over: Partial<Rules["supportForce"]> = {}): Rules {
  return {
    ...FIXTURE_BATTLE_OFFER_RULES,
    enemyDecline: { comparison: "LESS_THAN", thresholdBp: 0, probabilityBp: 0 },
    supportForce: { ...FIXTURE_BATTLE_OFFER_RULES.supportForce, ...over },
  };
}

function snapshotOf(
  allyShips: Parameters<typeof makeShip>[3][] = [],
  options: { allied?: boolean; extra?: boolean } = {},
): CampaignSnapshot {
  const base = makeBattleSnapshot({
    attackerShips: [makeShip("g1", "dv-att-a", ATTACKER_NATION, { firepower: 800 })],
    defenderShips: [makeShip("f1", "dv-def-a", DEFENDER_NATION, { firepower: 400 })],
  });
  const ships = allyShips.map((opts, i) => makeShip(`i${i + 1}`, "dv-att-a", ALLY, opts));
  const nations = new Map(base.nations);
  nations.set(ALLY, makeNation(ALLY, ships));
  const extraNations =
    options.extra === true
      ? [
          ["AUS", makeShip("x1", "dv-att-a", "AUS", { firepower: 100 }), DEFENDER_NATION, "allied"],
          [
            "RUS",
            makeShip("y1", "dv-att-a", "RUS", { firepower: 100 }),
            ATTACKER_NATION,
            "neutral",
          ],
        ]
      : [];
  for (const [id, ship] of extraNations as [
    string,
    ReturnType<typeof makeShip>,
    string,
    string,
  ][]) {
    nations.set(id, makeNation(id, [ship]));
  }
  return {
    ...base,
    nations,
    politics: {
      ...base.politics,
      relations: [
        ...(options.allied === false
          ? []
          : [
              {
                nationA: ATTACKER_NATION,
                nationB: ALLY,
                relation: "allied" as const,
                tension: 0,
                nap: false,
                since: "1880-01",
              },
            ]),
        ...(extraNations as [string, unknown, string, string][]).map(([id, , other, relation]) => ({
          nationA: other,
          nationB: id,
          relation: relation as "allied" | "neutral",
          tension: 0,
          nap: false,
          since: "1880-01",
        })),
      ],
    },
  };
}

const ELIGIBLE = [{ firepower: 200 }, { firepower: 150 }, { firepower: 250 }];
const EXCLUDED = [
  { firepower: 900, readiness: "WORKING_UP" as const },
  { firepower: 900, readiness: "RESERVE" as const },
  { firepower: 900, readiness: "MOTHBALLED" as const },
  { firepower: 900, crewQuality: 10 },
  { firepower: 900, loc: "a-elsewhere" },
];

function run(
  snapshot: CampaignSnapshot,
  battleOffers: Rules | undefined,
  inputs: readonly RecordedInput[] = [],
  collector = new DiagnosticCollector(),
): MonthResult {
  const interruptions: InterruptionChannel = { turnId: TURN, recordedInputs: inputs };
  return new MonthExecutor().execute(snapshot, [], SEED, collector, undefined, {
    playerNationId: ATTACKER_NATION,
    ...(battleOffers === undefined ? {} : { battleOffers }),
    interruptions,
  });
}

const draws = (result: MonthResult) => result.randomLedger.all.filter((d) => d.streamId === STREAM);

function offerOf(result: MonthResult): OfferRequest {
  const request = result.suspended?.request;
  if (request?.kind !== "offer") throw new Error(`expected an offer, got ${request?.kind}`);
  return request;
}

function answer(request: OfferRequest, response: OfferResponse): RecordedInput {
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "offer",
    interruptionId: request.interruptionId,
    payload: { interruptionId: request.interruptionId, battleId: request.battleId, response },
  });
}

const manifestOf = (result: MonthResult) => result.finalSnapshot.wars.battleManifests?.[0];
const ships = (result: MonthResult, nationId: string) =>
  result.finalSnapshot.nations.get(nationId)!.fleets.flatMap((f) => f.ships);

describe("the support force (R12)", () => {
  const present = rules({ presenceChanceBp: 10_000 });
  const absent = rules({ presenceChanceBp: 0 });
  const withCandidates = snapshotOf([...ELIGIBLE, ...EXCLUDED], { extra: true });

  it("records exactly one fully-described presence draw when candidates exist", () => {
    const result = run(withCandidates, present);
    expect(draws(result)).toHaveLength(1);
    const [decision] = draws(result);
    expect(decision).toMatchObject({
      streamId: STREAM,
      entityKey: expect.stringContaining("battle_war_1_a-1_fleet_battle"),
      phase: "battle_generation",
      rulesetVersion: withCandidates.rulesetVersion,
      outcome: "PRESENT",
      reasonCode: "BATTLE_SUPPORT_FORCE_PRESENT",
    });
    expect(decision?.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(decision?.draw).toBeGreaterThanOrEqual(0);
    expect(decision?.draw).toBeLessThan(10_000);
  });

  it("records an absent draw and adds nothing when the draw falls above the chance", () => {
    const result = run(withCandidates, absent);
    expect(draws(result)).toHaveLength(1);
    expect(draws(result)[0]).toMatchObject({
      outcome: "ABSENT",
      reasonCode: "BATTLE_SUPPORT_FORCE_ABSENT",
    });
    const request = offerOf(result);
    expect(request.supportForcePresent).toBe(false);
    expect("supportNationIds" in request).toBe(false);
  });

  it("makes no draw and changes nothing when no allied candidate exists", () => {
    for (const snapshot of [
      snapshotOf([], {}),
      snapshotOf(EXCLUDED, {}),
      snapshotOf(ELIGIBLE, { allied: false }),
      snapshotOf([{ firepower: 500 }], {}),
      snapshotOf([], { extra: true }),
    ]) {
      const result = run(snapshot, present);
      expect(draws(result)).toHaveLength(0);
      expect(offerOf(result).supportForcePresent).toBe(false);
      expect(result.finalSnapshot.wars.battles).toHaveLength(1);
    }
    expect(manifestOf(run(snapshotOf(EXCLUDED, {}), present))?.manifestHash).toBe(
      manifestOf(run(snapshotOf([], {}), present))?.manifestHash,
    );
  });

  it("orders the force by the existing candidate ordering under the cap, and only from eligible allies", () => {
    const result = run(withCandidates, present);
    const request = offerOf(result);
    const manifest = manifestOf(result)!;
    expect(manifest.temporaryAssets).toEqual(["i2", "i3"]);
    expect(manifest.persistentAssets).toEqual(["f1", "g1"]);
    expect(manifest.sides.find((s) => s.sideId === "ATTACKER")?.participantIds).toEqual([
      ATTACKER_NATION,
      ALLY,
    ]);
    expect(manifest.sides.find((s) => s.sideId === "DEFENDER")?.participantIds).toEqual([
      DEFENDER_NATION,
    ]);
    const strength = ["i2", "i3"].reduce(
      (sum, id) => sum + (ships(result, ALLY).find((s) => s.id === id)?.firepower ?? 0),
      0,
    );
    expect(strength).toBeLessThanOrEqual(400);
    expect(request.supportForcePresent).toBe(true);
  });

  it("clamps a composition larger than the cap to floor(committed strength x min(share, 5000) / 10000)", () => {
    const candidates = snapshotOf([...ELIGIBLE], {});
    const supportStrength = (result: MonthResult): number =>
      (manifestOf(result)?.temporaryAssets ?? []).reduce(
        (sum, id) => sum + (ships(result, ALLY).find((s) => s.id === id)?.firepower ?? 0),
        0,
      );
    const offered = (shareOfCapBp: number) =>
      run(candidates, rules({ presenceChanceBp: 10_000, shareOfCapBp }));
    const bound = offered(3_000);
    expect(manifestOf(bound)?.temporaryAssets).toEqual(["i1"]);
    expect(supportStrength(bound)).toBeLessThanOrEqual(Math.floor((800 * 3_000) / 10_000));
    const clamped = offered(9_000);
    expect(manifestOf(clamped)?.temporaryAssets).toEqual(["i2", "i3"]);
    expect(supportStrength(clamped)).toBe(Math.floor((800 * 5_000) / 10_000));
    expect(manifestOf(clamped)?.manifestHash).toBe(manifestOf(offered(5_000))?.manifestHash);
  });

  it("discloses presence and the supporting nation, and nothing beyond the player's own force view", () => {
    const request = offerOf(run(withCandidates, present));
    expect(request.supportForcePresent).toBe(true);
    expect(request.supportNationIds).toEqual([ALLY]);
    const text = JSON.stringify(request);
    for (const hidden of ["i1", "i2", "i3", "f1", "temporaryAssets", "draw", "manifestHash"]) {
      expect(text).not.toContain(`"${hidden}"`);
    }
    expect(request.playerForce.map((s) => s.shipId)).toEqual(["g1"]);
  });

  it("leaves the support ships unreserved and undamaged whether the player declines or accepts", () => {
    const request = offerOf(run(withCandidates, present));
    const before = ships(run(withCandidates, present), ALLY).map((s) => ({ ...s }));
    for (const response of ["decline", "accept", "delegate"] as const) {
      const done = run(withCandidates, present, [answer(request, response)]);
      expect(done.outcome).toBe(response === "accept" ? "suspended" : "completed");
      expect(ships(done, ALLY)).toEqual(before);
      expect(ships(done, ALLY).filter((s) => s.inBattleId !== undefined)).toEqual([]);
    }
    const declined = run(withCandidates, present, [answer(request, "decline")]);
    expect(ships(declined, ATTACKER_NATION).every((s) => s.inBattleId === undefined)).toBe(true);
  });

  it("fights a delegated battle through the unchanged auto-resolution without a failure diagnostic", () => {
    const request = offerOf(run(withCandidates, present));
    const collector = new DiagnosticCollector();
    const accepted = run(withCandidates, present, [answer(request, "delegate")], collector);
    expect(accepted.finalSnapshot.wars.battles[0]?.phase).toBe("resolved");
    expect(collector.hasErrors).toBe(false);
  });

  it("is identical across re-execution, resume and two passes, and independent of the response", () => {
    const first = run(withCandidates, present);
    const again = run(withCandidates, present);
    expect(draws(again)).toEqual(draws(first));
    expect(again.randomLedger.hash()).toBe(first.randomLedger.hash());
    expect(offerOf(again)).toEqual(offerOf(first));
    const request = offerOf(first);
    for (const response of ["accept", "delegate", "decline"] as const) {
      expect(draws(run(withCandidates, present, [answer(request, response)]))).toEqual(
        draws(first),
      );
    }
    const a = run(withCandidates, present, [answer(request, "accept")]);
    const b = run(withCandidates, present, [answer(request, "accept")]);
    expect(unifiedSnapshotHash(a.finalSnapshot)).toBe(unifiedSnapshotHash(b.finalSnapshot));
    expect(a.eventLedger.hash()).toBe(b.eventLedger.hash());
  });

  it("the draw does not move with the chance, so a ruleset change cannot reorder it", () => {
    const low = draws(run(withCandidates, rules({ presenceChanceBp: 1 })))[0]?.draw;
    const high = draws(run(withCandidates, rules({ presenceChanceBp: 9_999 })))[0]?.draw;
    expect(low).toBe(high);
  });

  it("an absent draw leaves the month equal to one without allied candidates", () => {
    const a = run(withCandidates, absent);
    const b = run(snapshotOf([], {}), absent);
    expect(offerOf(a)).toEqual(offerOf(b));
  });

  it("is dormant without the section: no draw, no support, the manifest as before", () => {
    const result = run(withCandidates, undefined);
    expect(draws(result)).toHaveLength(0);
    expect(result.finalSnapshot.wars.battleManifests?.[0]?.temporaryAssets).toEqual([]);
  });
});

describe("without an interruption channel the month is byte-identical to today (R3)", () => {
  it("makes no presence draw and adds no support although the section and player are set", () => {
    const snapshot = snapshotOf([...ELIGIBLE], {});
    const execute = (battleOffers: Rules | undefined) =>
      new MonthExecutor().execute(snapshot, [], SEED, new DiagnosticCollector(), undefined, {
        playerNationId: ATTACKER_NATION,
        ...(battleOffers === undefined ? {} : { battleOffers }),
      });
    const withSection = execute(rules({ presenceChanceBp: 10_000 }));
    const without = execute(undefined);
    expect(draws(withSection)).toHaveLength(0);
    expect(manifestOf(withSection)?.temporaryAssets).toEqual([]);
    expect(unifiedSnapshotHash(withSection.finalSnapshot)).toBe(
      unifiedSnapshotHash(without.finalSnapshot),
    );
    expect(withSection.eventLedger.hash()).toBe(without.eventLedger.hash());
    expect(withSection.randomLedger.all).toEqual(without.randomLedger.all);
  });
});
