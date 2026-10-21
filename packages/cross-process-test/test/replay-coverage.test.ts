import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";

import {
  REPLAY_SCENARIOS,
  SUBSYSTEMS,
  buildCoverageReport,
  decodeReplayFile,
  formatCoverageReport,
  recordReplay,
} from "../src/replay-corpus/index.js";
import { Result } from "effect";

const REPLAY_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../golden/replays");

describe("replay coverage report", () => {
  const small = [
    { id: "cov-a", seed: "cov-a", months: 1, purpose: "first month" },
    { id: "cov-b", seed: "cov-b", months: 2, purpose: "two months" },
  ];
  const report = buildCoverageReport(small);

  it("lists the subsystems each replay exercised, with its purpose and month count", () => {
    expect(report.replays.map((r) => r.scenarioId)).toEqual(["cov-a", "cov-b"]);
    const first = report.replays[0];
    expect(first).toMatchObject({ purpose: "first month", months: 1 });
    expect(first?.subsystems).toEqual(
      expect.arrayContaining(["weather_generation", "monthly_revenue", "resolve_research"]),
    );
  });

  it("names every catalogue subsystem no replay exercised, and none that one did", () => {
    const exercised = new Set(report.replays.flatMap((r) => r.subsystems));
    const known = SUBSYSTEMS.map((s) => s.id);
    expect(report.uncovered).toEqual(known.filter((id) => !exercised.has(id)));
    // A command-free run never reaches battles, so the gap is visible and not assumed away.
    expect(report.uncovered).toContain("battle_resolution");
  });

  it("only attributes subsystems from the catalogue", () => {
    const known = new Set<string>(SUBSYSTEMS.map((s) => s.id));
    for (const replay of report.replays) {
      for (const id of replay.subsystems) expect(known.has(id)).toBe(true);
    }
    expect(report.unattributedEventTypes).toEqual([]);
  });

  it("renders stable text with a section per replay and the uncovered list", () => {
    const text = formatCoverageReport(report);
    expect(text).toBe(formatCoverageReport(buildCoverageReport(small)));
    expect(text).not.toContain("\r");
    expect(text).toContain("cov-a (1 month): first month");
    expect(text).toContain("uncovered:");
  });
});

describe("checked-in replay corpus", () => {
  it("has at least ten scenarios, each with a unique id, seed and a stated purpose", () => {
    expect(REPLAY_SCENARIOS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(REPLAY_SCENARIOS.map((s) => s.id)).size).toBe(REPLAY_SCENARIOS.length);
    expect(new Set(REPLAY_SCENARIOS.map((s) => s.seed)).size).toBe(REPLAY_SCENARIOS.length);
    for (const scenario of REPLAY_SCENARIOS) {
      expect(scenario.purpose.trim().length).toBeGreaterThan(10);
      expect(scenario.purpose.length).toBeLessThanOrEqual(160);
    }
  });

  it("has one replay file per scenario and no file without a scenario", () => {
    const files = readdirSync(REPLAY_DIR)
      .filter((name) => name.endsWith(".replay.json"))
      .sort();
    expect(files).toEqual(REPLAY_SCENARIOS.map((s) => `${s.id}.replay.json`).sort());
    for (const scenario of REPLAY_SCENARIOS) {
      const text = readFileSync(resolve(REPLAY_DIR, `${scenario.id}.replay.json`), "utf8");
      const decoded = decodeReplayFile(text);
      expect(Result.isSuccess(decoded)).toBe(true);
      if (Result.isSuccess(decoded)) {
        expect(decoded.success).toMatchObject({
          scenarioId: scenario.id,
          seed: scenario.seed,
        });
        expect(decoded.success.months).toHaveLength(scenario.months);
      }
    }
  });

  it("re-records the shortest checked-in replay byte-for-byte", () => {
    const shortest = [...REPLAY_SCENARIOS].sort((a, b) => a.months - b.months)[0];
    expect(shortest).toBeDefined();
    if (shortest === undefined) return;
    const file = resolve(REPLAY_DIR, `${shortest.id}.replay.json`);
    expect(existsSync(file)).toBe(true);
    expect(recordReplay(shortest)).toBe(readFileSync(file, "utf8"));
  });

  it("leaves no authoritative subsystem silently assumed covered", () => {
    const report = buildCoverageReport(REPLAY_SCENARIOS);
    expect(report.replays).toHaveLength(REPLAY_SCENARIOS.length);
    expect(report.unattributedEventTypes).toEqual([]);
    // Pinned on purpose: command-free replays reach none of these. When commands, AI or battle
    // scenarios land this list must shrink in the same change, so a gap is never silent.
    expect(report.uncovered).toEqual([
      "opening_validation",
      "command_collection",
      "ai_planning",
      "ai_procurement",
      "resolve_diplomacy",
      "resolve_aircraft_development",
      "resolve_carrier_operations",
      "battle_generation",
      "battle_resolution",
      "closing_validation",
    ]);
  });
});
