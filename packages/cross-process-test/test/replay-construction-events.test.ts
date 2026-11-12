import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { executeScenario, saveAndLoad, verifyReplay } from "../src/replay-corpus/corpus.js";
import { REPLAY_SCENARIOS, decodeReplayFile, recordReplay } from "../src/replay-corpus/index.js";

const REPLAY_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../golden/replays");
const scenario = REPLAY_SCENARIOS.find(
  (s) => s.id === "production-1880-12m-certain-construction-events",
)!;
const CAP_BP = 3_000;

describe("certain construction events replay", () => {
  const months = [...executeScenario(scenario)];
  const kinds = (month: number) =>
    months[month - 1]!.result.eventLedger.all.map((e) => e.body.kind);

  it("declares the certain-construction-events setup", () => {
    expect(scenario.setup).toBe("certain-construction-events");
  });

  it("hits home builds with an overrun in the first month", () => {
    expect(kinds(1)).toContain("ConstructionOverrun");
  });

  it("holds builds with a delay once the overrun cap is reached", () => {
    const delayed = months.flatMap((m) =>
      m.result.eventLedger.all.filter(
        (e) => e.body.kind === "ConstructionDelayed" && e.body.months !== undefined,
      ),
    );
    expect(delayed.length).toBeGreaterThan(0);
  });

  it("never lets cumulative overrun pass the cap and reaches it", () => {
    let reached = false;
    for (const month of months) {
      for (const nation of month.result.finalSnapshot.nations.values()) {
        for (const project of nation.constructionProjects) {
          const overrunWork = (project.overruns ?? []).reduce(
            (sum, o) => sum + Number(o.amount),
            0,
          );
          const originalWork = Number(project.totalWork) - overrunWork;
          const ceiling = Math.floor((originalWork * CAP_BP) / 10_000);
          expect(overrunWork).toBeLessThanOrEqual(ceiling);
          if (overrunWork === ceiling && ceiling > 0) reached = true;
        }
      }
    }
    expect(reached).toBe(true);
  });

  it("records the hit history on the project", () => {
    const projects = [...months.at(-1)!.result.finalSnapshot.nations.values()].flatMap(
      (n) => n.constructionProjects,
    );
    expect(projects.some((p) => (p.overruns?.length ?? 0) > 0)).toBe(true);
    expect(projects.some((p) => (p.delays?.length ?? 0) > 0)).toBe(true);
  });

  it("re-verifies through save and load", () => {
    const text = recordReplay(scenario);
    const decoded = decodeReplayFile(text);
    expect(Result.isSuccess(decoded)).toBe(true);
    const outcome = verifyReplay(text, { roundTrip: {} });
    expect(Result.isSuccess(outcome) && outcome.success.ok).toBe(true);
    const last = months.at(-1)!.result.finalSnapshot;
    const trip = saveAndLoad(last);
    expect(trip.ok).toBe(true);
    if (!trip.ok) return;
    const flat = (s: typeof last) =>
      [...s.nations.values()].flatMap((n) =>
        n.constructionProjects.map((p) => [p.id, p.delays, p.overruns]),
      );
    expect(flat(trip.snapshot)).toEqual(flat(last));
  });

  it("is checked in byte-for-byte", () => {
    const checkedIn = readFileSync(resolve(REPLAY_DIR, `${scenario.id}.replay.json`), "utf8");
    expect(recordReplay(scenario)).toBe(checkedIn);
  });
});
