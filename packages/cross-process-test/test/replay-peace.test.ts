import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  executeScenario,
  fleetManagementOptions,
  verifyReplay,
} from "../src/replay-corpus/corpus.js";
import { REPLAY_SCENARIOS, recordReplay } from "../src/replay-corpus/index.js";

const REPLAY_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../golden/replays");
const PEACE_STREAM = "diplomacy/peace_proposal";

function scenarioOf(id: string) {
  const scenario = REPLAY_SCENARIOS.find((s) => s.id === id);
  if (scenario === undefined) throw new Error(`scenario ${id} is not registered`);
  return scenario;
}

function peaceDraws(result: { readonly randomLedger: { readonly all: readonly unknown[] } }) {
  return result.randomLedger.all.filter(
    (entry): entry is { streamId: string; outcome: string; reasonCode: string } =>
      typeof entry === "object" &&
      entry !== null &&
      "streamId" in entry &&
      entry.streamId === PEACE_STREAM,
  );
}

describe("corpus replays with peaceBehaviour wired", () => {
  const offered = scenarioOf("production-1880-5m-peace-offer-accepted");

  it("passes the production peaceBehaviour section to the engine options", () => {
    expect(fleetManagementOptions("austria_hungary").peaceBehaviour).toMatchObject({
      acceptanceScoreMargin: 20,
      proposalChanceBp: 3000,
    });
  });

  it("draws an AI peace proposal and records the offer in the war state", () => {
    const months = [...executeScenario(offered)];
    const offerMonth = months.findIndex((m) =>
      peaceDraws(m.result).some((draw) => draw.outcome === "PROPOSE"),
    );
    expect(offerMonth).toBeGreaterThanOrEqual(0);
    const draw = peaceDraws(months[offerMonth]!.result)[0]!;
    expect(draw.reasonCode).toBe("PROPOSER_TRAILS_BY_MARGIN");
    const offers = months[offerMonth]!.result.finalSnapshot.wars.peaceOffers ?? [];
    expect(offers.map((o) => [o.proposerId, o.targetId, o.term._tag])).toEqual([
      ["italy", "austria_hungary", "StatusQuo"],
    ]);
  });

  it("ends the war when the player accepts the standing offer", () => {
    const months = [...executeScenario(offered)];
    const last = months.at(-1)!;
    expect(last.commands.map((c) => c.body.type)).toEqual(["AcceptPeace"]);
    const wars = last.result.finalSnapshot.wars;
    expect(wars.wars.map((w) => w.status)).toEqual(["ENDED"]);
    expect(wars.peaceOffers ?? []).toEqual([]);
  });

  it("leaves the war running when the section is absent from the engine options", () => {
    const months = [...executeScenario(offered)];
    const { peaceBehaviour: _absent, ...withoutSection } = fleetManagementOptions(
      offered.playerNationId,
      offered.setup,
    );
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(
      months[2]!.startSnapshot,
      [],
      `${offered.seed}:month:${String(months[2]!.startSnapshot.turnNumber)}`,
      collector,
      undefined,
      withoutSection,
    );
    expect(result.finalSnapshot.wars.peaceOffers ?? []).toEqual([]);
    expect(peaceDraws(result)).toEqual([]);
  });

  it("re-verifies and is checked in byte-for-byte", () => {
    const text = recordReplay(offered);
    const outcome = verifyReplay(text, { roundTrip: {} });
    expect(Result.isSuccess(outcome) && outcome.success.ok).toBe(true);
    expect(text).toBe(readFileSync(resolve(REPLAY_DIR, `${offered.id}.replay.json`), "utf8"));
  });
});
