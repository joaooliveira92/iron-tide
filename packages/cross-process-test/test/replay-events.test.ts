import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  executeScenario,
  fleetManagementOptions,
  verifyReplay,
} from "../src/replay-corpus/corpus.js";
import { REPLAY_SCENARIOS, recordReplay } from "../src/replay-corpus/index.js";

const REPLAY_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../golden/replays");
const SCENARIO_ID = "production-1880-10m-japan-event";
const PLAYER = "japan";

function scenarioOf(id: string) {
  const scenario = REPLAY_SCENARIOS.find((s) => s.id === id);
  if (scenario === undefined) throw new Error(`scenario ${id} is not registered`);
  return scenario;
}

describe("corpus replays with event content wired", () => {
  const scenario = scenarioOf(SCENARIO_ID);

  it("passes the production event catalogue and rules to the engine options", () => {
    const events = fleetManagementOptions(PLAYER).events;
    expect(events).toBeDefined();
    expect(events!.catalogue.length).toBeGreaterThan(0);
    expect(events!.rules.defaultAnswerAfterMonths).toBeGreaterThan(0);
  });

  it("draws an event for the player and holds it as a pending dilemma", () => {
    const months = [...executeScenario(scenario)];
    const drawn = months.flatMap((m) =>
      m.result.randomLedger.all.filter(
        (entry) => entry.reasonCode === "EVENT_DRAWN" && entry.entityKey.startsWith(`${PLAYER}/`),
      ),
    );
    expect(drawn.length).toBeGreaterThan(0);
  });

  it("resolves an earlier player event by its default answer with declared effects", () => {
    const final = [...executeScenario(scenario)].at(-1)!.result.finalSnapshot;
    const fired = final.nations.get(PLAYER)?.eventHistory?.fired ?? [];
    expect(
      fired.some((entry) => entry.resolvedBy === "DEFAULT" && entry.effects !== undefined),
    ).toBe(true);
  });

  it("re-verifies and is checked in byte-for-byte", () => {
    const text = recordReplay(scenario);
    const outcome = verifyReplay(text, { roundTrip: {} });
    expect(Result.isSuccess(outcome) && outcome.success.ok).toBe(true);
    expect(text).toBe(readFileSync(resolve(REPLAY_DIR, `${scenario.id}.replay.json`), "utf8"));
  });
});
