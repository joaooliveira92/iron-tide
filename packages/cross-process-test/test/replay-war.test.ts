import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  advance,
  executeScenario,
  saveAndLoad,
  scenarioEnvelopes,
  startSnapshot,
  verifyReplay,
} from "../src/replay-corpus/corpus.js";
import { REPLAY_SCENARIOS, decodeReplayFile, recordReplay } from "../src/replay-corpus/index.js";

const REPLAY_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../golden/replays");
const scenario = REPLAY_SCENARIOS.find((s) => s.id === "production-1880-4m-adriatic-war")!;
const DIVISION = "div_aut_adriatic";

describe("war-bearing replay", () => {
  const months = [...executeScenario(scenario)];
  const battleMonths = months.slice(1);

  function division(month: number) {
    const nation = months[month - 1]!.result.finalSnapshot.nations.get("austria_hungary")!;
    return nation.divisions!.find((d) => d.divisionId === DIVISION)!;
  }

  it("fights no battle until the fleets meet, then one each month", () => {
    expect(months.map((m) => m.result.finalSnapshot.wars.battles.length)).toEqual([0, 1, 2, 3]);
  });

  it("persists the work-up hull as absent with its ordered reasons on every battle", () => {
    const battles = months.at(-1)!.result.finalSnapshot.wars.battles;
    expect(battles.map((b) => b.absences)).toEqual([
      [{ shipId: "aut_tegetthoff", reasons: ["WorkingUp"] }],
      [{ shipId: "aut_tegetthoff", reasons: ["WorkingUp"] }],
      [{ shipId: "aut_tegetthoff", reasons: ["WorkingUp"] }],
    ]);
  });

  it("never lists low crew quality as an absence reason", () => {
    const reasons = months
      .at(-1)!
      .result.finalSnapshot.wars.battles.flatMap((b) => b.absences ?? [])
      .flatMap((absence) => absence.reasons);
    expect(reasons.every((reason) => reason === "WorkingUp")).toBe(true);
  });

  it("grants the division battle experience once per battle", () => {
    const experience = [1, 2, 3, 4].map((month) => division(month).experience);
    expect(experience[0]).toBe(20);
    expect(experience[1]! - experience[0]!).toBeGreaterThan(0);
    expect(experience[2]! - experience[1]!).toBe(experience[1]! - experience[0]!);
    expect(experience[3]! - experience[2]!).toBe(experience[1]! - experience[0]!);
    const granted = battleMonths.map((m) =>
      m.result.eventLedger.all.filter((e) => e.eventType === "DivisionExperienceChanged"),
    );
    expect(granted.map((events) => events.length)).toEqual([2, 2, 2]);
  });

  it("survives a save and load with the absences and experience intact", () => {
    const snapshot = months.at(-1)!.result.finalSnapshot;
    const trip = saveAndLoad(snapshot);
    expect(trip.ok).toBe(true);
    if (!trip.ok) return;
    expect(trip.snapshot.wars.battles.map((b) => b.absences)).toEqual(
      snapshot.wars.battles.map((b) => b.absences),
    );
    expect(
      trip.snapshot.nations
        .get("austria_hungary")!
        .divisions!.find((d) => d.divisionId === DIVISION)!.experience,
    ).toBe(division(4).experience);
  });

  it("records a replay file that re-verifies with the player nation and setup it declares", () => {
    const text = recordReplay(scenario);
    const decoded = decodeReplayFile(text);
    expect(Result.isSuccess(decoded)).toBe(true);
    if (!Result.isSuccess(decoded)) return;
    expect(decoded.success.engineOptions).toEqual({
      kind: "player",
      playerNationId: "austria_hungary",
    });
    expect(decoded.success.initial.setup).toBe("armed-adriatic-war");
    const outcome = verifyReplay(text, { roundTrip: {} });
    expect(Result.isSuccess(outcome) && outcome.success.ok).toBe(true);
  });

  it("is checked in byte-for-byte", () => {
    const checkedIn = readFileSync(resolve(REPLAY_DIR, `${scenario.id}.replay.json`), "utf8");
    expect(recordReplay(scenario)).toBe(checkedIn);
  });

  it("fights the same war differently when the player's gunnery training is proficient", () => {
    const damageAfterMonthTwo = (trained: boolean) => {
      let snapshot = startSnapshot(scenario.setup);
      if (trained) {
        const nations = new Map(snapshot.nations);
        const nation = nations.get("austria_hungary")!;
        nations.set("austria_hungary", {
          ...nation,
          specialTraining: [{ subject: "GUNNERY", fundedMonths: 12, maintenanceAdderBp: 3_000 }],
        });
        snapshot = { ...snapshot, nations };
      }
      let report: unknown;
      for (let month = 1; month <= 2; month++) {
        const commands = scenarioEnvelopes(scenario, month, snapshot);
        const step = advance(
          snapshot,
          scenario.seed,
          { commands: () => commands as never },
          scenario.playerNationId,
        );
        snapshot = step.next;
        report = step.result.finalSnapshot.wars.battles.at(-1)?.result;
      }
      return JSON.stringify(report);
    };
    expect(damageAfterMonthTwo(true)).not.toBe(damageAfterMonthTwo(false));
  });
});
