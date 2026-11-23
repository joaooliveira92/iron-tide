import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  REPLAY_SCENARIOS,
  decodeReplayFile,
  executeScenario,
  recordReplay,
  verifyReplay,
  type ReplayScenario,
} from "../src/replay-corpus/index.js";

const scenario = REPLAY_SCENARIOS.find(
  (s) => s.id === "production-1880-6m-raider-interception-offers",
)!;

function tamper(text: string, edit: (file: Record<string, any>) => void): string {
  const file = JSON.parse(text);
  edit(file);
  return JSON.stringify(file);
}

describe("replay corpus battle offers (#1111)", () => {
  const months = [...executeScenario(scenario)];
  const recorded = recordReplay(scenario);

  it("turns the player's intercepted raider into a tactical offer answered by delegation", () => {
    const interceptions = months.flatMap((m) =>
      m.offerAnswers.filter((a) => a.battleId.includes("_raider_interception_")),
    );
    expect(interceptions.length).toBeGreaterThan(0);
    for (const answer of interceptions) expect(answer.response).toBe("delegate");
    const battles = months.at(-1)!.result.finalSnapshot.wars.battles;
    for (const answer of interceptions) {
      expect(battles.find((b) => b.id === answer.battleId)?.phase).toBe("resolved");
    }
  });

  it("settles an intercepted raider in its battle, not the abstract engagement", () => {
    for (const month of months) {
      const intercepted = month.offerAnswers.some((a) =>
        a.battleId.includes("_raider_interception_"),
      );
      const engaged = month.result.eventLedger.all.filter((e) => e.eventType === "RaiderEngaged");
      if (intercepted) expect(engaged).toEqual([]);
    }
  });

  it("records the answers on the months that suspended and the opt-in on the engine options", () => {
    const file = decodeReplayFile(recorded);
    if (Result.isFailure(file)) throw new Error(file.failure.message);
    expect(file.success.formatVersion).toBe(3);
    expect(file.success.engineOptions).toEqual({
      kind: "player",
      playerNationId: "austria_hungary",
      battleOffers: true,
    });
    expect(file.success.months.map((m) => m.offerAnswers?.length ?? 0)).toEqual(
      months.map((m) => m.offerAnswers.length),
    );
  });

  it("verifies the recorded replay and records it byte-identically", () => {
    expect(recordReplay(scenario)).toBe(recorded);
    const outcome = verifyReplay(recorded);
    if (Result.isFailure(outcome)) throw new Error(outcome.failure.message);
    expect(outcome.success).toEqual({ ok: true, months: scenario.months });
  });

  it("fails a month whose recorded answer is removed rather than guessing one", () => {
    const stripped = tamper(recorded, (f) => {
      delete f.months[0].offerAnswers;
    });
    expect(() => verifyReplay(stripped)).toThrow(/do not cover/);
  });

  it("treats a recorded answer that no longer matches its offer as unanswered", () => {
    const wrong = tamper(recorded, (f) => {
      f.months[0].offerAnswers[0].battleId = "not-the-offered-battle";
    });
    expect(() => verifyReplay(wrong)).toThrow(/do not cover/);
  });

  it("diverges when a recorded answer is changed to a different valid response", () => {
    const declined = tamper(recorded, (f) => {
      f.months[0].offerAnswers[0].response = "decline";
    });
    const outcome = verifyReplay(declined);
    if (Result.isFailure(outcome)) throw new Error(outcome.failure.message);
    expect(outcome.success).toMatchObject({ ok: false, divergence: { month: 1 } });
  });

  it("rejects recorded answers on a replay that did not opt into offers", () => {
    const optedOut = tamper(recorded, (f) => {
      f.engineOptions = { kind: "player", playerNationId: "austria_hungary" };
    });
    const decoded = decodeReplayFile(optedOut);
    expect(Result.isFailure(decoded) && decoded.failure.message).toContain("offerAnswers");
  });

  it("leaves a scenario without offers with no new keys", () => {
    const plain: ReplayScenario = { id: "plain", seed: "plain-seed", months: 1 };
    const text = recordReplay(plain);
    expect(text).not.toContain("offerAnswers");
    expect(text).not.toContain("battleOffers");
  });

  it("refuses to pin engine digests together with offers", () => {
    expect(() => recordReplay({ ...scenario, engineDigests: true })).toThrow(/engine digests/);
  });

  it("refuses offers without a player nation", () => {
    const { playerNationId: _player, ...rest } = scenario;
    expect(() => recordReplay(rest)).toThrow(/player nation/);
  });
});
