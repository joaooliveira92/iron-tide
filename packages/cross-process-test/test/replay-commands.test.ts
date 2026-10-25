import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { sha256Hex, canonicalSerialize } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { ReplayVerifier, hashSnapshot } from "@bluewave/phase-engine";
import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  REPLAY_SCENARIOS,
  buildCoverageReport,
  decodeReplayFile,
  executeScenario,
  recordReplay,
  verifyReplay,
  type ReplayScenario,
} from "../src/replay-corpus/index.js";
import { advance, productionStartSnapshot } from "../src/replay-corpus/corpus.js";

const REPLAY_DIR = resolve(import.meta.dirname, "../../../golden/replays");
const SCENARIO = REPLAY_SCENARIOS.find((s) => s.id === "production-1880-6m-fleet-commands")!;

function tamper(text: string, edit: (file: Record<string, any>) => void): string {
  const file = JSON.parse(text);
  edit(file);
  return JSON.stringify(file);
}

describe("replay format v2: recorded command envelopes", () => {
  const recorded = recordReplay(SCENARIO);

  it("records the ordered envelopes per month and the checked-in file is current", () => {
    const decoded = decodeReplayFile(recorded);
    expect(Result.isSuccess(decoded)).toBe(true);
    if (!Result.isSuccess(decoded)) return;
    expect(decoded.success.formatVersion).toBe(2);
    expect(decoded.success.months.map((m) => m.commands.length)).toEqual([2, 0, 1, 1, 2, 1]);
    expect(decoded.success.months[0]!.commands.map((c) => c.body.type)).toEqual([
      "SetShipReadiness",
      "SetShipReadiness",
    ]);
    expect(readFileSync(resolve(REPLAY_DIR, `${SCENARIO.id}.replay.json`), "utf8")).toBe(recorded);
  });

  it("executes the recorded envelopes through the real lifecycle, refusals included", () => {
    const outcomes = [...executeScenario(SCENARIO)].flatMap((m) =>
      m.result.commandLedger.all.map((o) => o.type),
    );
    expect(outcomes).toEqual([
      "success",
      "rejected",
      "success",
      "success",
      "rejected",
      "success",
      "success",
    ]);
  });

  it("verifies, and fails at the month whose recorded command is altered", () => {
    expect(Result.getOrThrow(verifyReplay(recorded))).toEqual({ ok: true, months: 6 });
    const altered = tamper(recorded, (f) => {
      f.months[2].commands[0].body.readiness = "MOTHBALLED";
    });
    const outcome = Result.getOrThrow(verifyReplay(altered));
    expect(outcome).toMatchObject({ ok: false, divergence: { month: 3 } });
  });

  it("fails when a recorded command is dropped", () => {
    const dropped = tamper(recorded, (f) => {
      f.months[0].commands.pop();
    });
    const outcome = Result.getOrThrow(verifyReplay(dropped));
    expect(outcome).toMatchObject({ ok: false, divergence: { month: 1, where: "command" } });
  });

  it("decodes envelopes strictly: excess keys, unknown bodies and bad fields fail", () => {
    const failures = [
      (f: Record<string, any>) => (f.months[0].commands[0].surprise = 1),
      (f: Record<string, any>) => (f.months[0].commands[0].body.surprise = 1),
      (f: Record<string, any>) => (f.months[0].commands[0].body.type = "DeclareWar"),
      (f: Record<string, any>) => (f.months[0].commands[0].body.readiness = "WORKING_UP"),
      (f: Record<string, any>) => (f.months[0].commands[0].expectedSnapshotHash = "abc"),
    ];
    for (const edit of failures) {
      expect(Result.isFailure(decodeReplayFile(tamper(recorded, edit)))).toBe(true);
    }
  });

  it("still reads format v1 files and refuses commands inside one", () => {
    const v1 = readFileSync(resolve(REPLAY_DIR, "production-1880-1m.replay.json"), "utf8");
    expect(Result.isSuccess(decodeReplayFile(v1))).toBe(true);
    const bad = tamper(recorded, (f) => (f.formatVersion = 1));
    const result = decodeReplayFile(bad);
    expect(Result.isFailure(result) && result.failure.message).toContain(
      "version 1 records no commands",
    );
  });

  it("reports command_collection in the coverage report", () => {
    const report = buildCoverageReport([SCENARIO]);
    expect(report.replays[0]!.subsystems).toContain("command_collection");
  });

  it("feeds a recorded month to the engine's existing ReplayVerifier", () => {
    const decoded = Result.getOrThrow(decodeReplayFile(recordReplay(SCENARIO)));
    const month = 3;
    let snapshot = productionStartSnapshot();
    for (let index = 1; index < month; index++) {
      const recordedMonth = decoded.months[index - 1]!;
      snapshot = advance(snapshot, decoded.seed, {
        commands: () => recordedMonth.commands as never,
      }).next;
    }
    const commands = decoded.months[month - 1]!.commands as never;
    const seed = `${decoded.seed}:month:${String(snapshot.turnNumber)}`;
    const original = new DiagnosticCollector();
    const first = advance(snapshot, decoded.seed, { commands: () => commands });
    const result = new ReplayVerifier().verify(
      snapshot,
      commands,
      first.result.commandLedger,
      hashSnapshot(first.result.finalSnapshot),
      seed,
      original,
    );
    expect(result.mismatches).toEqual([]);
    expect(result.match).toBe(true);
    expect(sha256Hex(canonicalSerialize(snapshot))).toBe(
      (commands as { expectedSnapshotHash: string }[])[0]!.expectedSnapshotHash,
    );
  });
});

describe("scenario command plans", () => {
  it("record the same bytes twice", () => {
    const scenario: ReplayScenario = { ...SCENARIO, months: 2 };
    expect(recordReplay(scenario)).toBe(recordReplay(scenario));
  });
});
