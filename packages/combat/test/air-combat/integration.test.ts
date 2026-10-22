import { describe, it, expect } from "vite-plus/test";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BattleResolver } from "@bluewave/combat/battleResolution";
import { StrengthCalculator } from "@bluewave/combat/battleResolution";
import { advanceMinutes } from "@bluewave/combat/simulation";
import { resolveAirCombat } from "@bluewave/combat/air-combat";
import { createCapPatrolState } from "@bluewave/combat/air-combat";
import { createStrikeMissionState } from "@bluewave/combat/air-combat";
import { SafeInt } from "@bluewave/contracts";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("AC-16 resolveAirCombat stage wiring", () => {
  it("strict no-op: empty context returns empty result", () => {
    const result = resolveAirCombat({
      battleId: "battle-1",
      minute: 1,
    });
    expect(result.records).toHaveLength(0);
    expect(result.active).toBe(false);
    expect(result.nextCapPatrols).toBeUndefined();
    expect(result.nextStrikeMissions).toBeUndefined();
  });

  it("strict no-op: empty arrays returns empty result", () => {
    const result = resolveAirCombat({
      battleId: "battle-1",
      minute: 1,
      capPatrols: [],
      strikeMissions: [],
    });
    expect(result.records).toHaveLength(0);
    expect(result.active).toBe(false);
  });

  it("strict no-op in advanceMinutes: no air-combat field → hashes unchanged", () => {
    const _cap = createCapPatrolState(
      "sq-1",
      ["CAP"],
      SafeInt(4),
      SafeInt(500),
      SafeInt(60),
      [0, 0],
    );
    const r1 = advanceMinutes({
      state: {
        battleId: "test-noop",
        mapId: "eng_ch",
        sides: [{ sideId: "ATTACKER", participantIds: ["a1"] }],
        forces: { ATTACKER: ["a1"] },
        divisions: [],
        units: [],
        contacts: [],
        objectives: [],
        weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
        exitZones: [],
        battleEventLedger: [],
      },
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
    });
    const r2 = advanceMinutes({
      state: {
        battleId: "test-noop",
        mapId: "eng_ch",
        sides: [{ sideId: "ATTACKER", participantIds: ["a1"] }],
        forces: { ATTACKER: ["a1"] },
        divisions: [],
        units: [],
        contacts: [],
        objectives: [],
        weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
        exitZones: [],
        battleEventLedger: [],
      },
      minutes: 1,
      observationTime: "1900-01-01T00:00:00.000Z",
    });

    expect(r1.hashes[0]).toBe(r2.hashes[0]);
    expect(r1.results[0]?.minuteHash).not.toContain("airCombat");
  });

  it("creates engagement records for CAP patrol in INTERCEPTING state", () => {
    const cap = createCapPatrolState(
      "sq-1",
      ["CAP"],
      SafeInt(4),
      SafeInt(500),
      SafeInt(60),
      [0, 0],
    );
    const interceptingCap = {
      ...cap,
      engagementState: "INTERCEPTING" as const,
      interceptTargetId: "strike-1",
    };

    const result = resolveAirCombat({
      battleId: "battle-1",
      minute: 5,
      capPatrols: [interceptingCap],
    });

    expect(result.active).toBe(true);
    expect(result.records.length).toBeGreaterThanOrEqual(1);
    const record = result.records.find((r) => r.recordKind === "ENGAGEMENT");
    expect(record).toBeDefined();
    expect(record!.actorId).toBe("sq-1");
    expect(record!.minute).toBe(5);
  });

  it("creates attack records for strike mission in ATTACKING phase", () => {
    const strike = createStrikeMissionState(
      "mission-1",
      "strike-1",
      ["sq-bomber"],
      "target-ship",
      [0, 0],
      SafeInt(150),
      SafeInt(30),
    );
    const attackingStrike = { ...strike, phase: "ATTACKING" as const };

    const result = resolveAirCombat({
      battleId: "battle-1",
      minute: 7,
      strikeMissions: [attackingStrike],
    });

    expect(result.active).toBe(true);
    expect(result.records.length).toBeGreaterThanOrEqual(1);
    const record = result.records.find((r) => r.recordKind === "ATTACK");
    expect(record).toBeDefined();
    expect(record!.actorId).toBe("mission-1");
  });

  it("returns sorted records with existing plus new records", () => {
    const strike = createStrikeMissionState(
      "mission-1",
      "strike-1",
      ["sq-bomber"],
      "target-ship",
      [0, 0],
      SafeInt(150),
      SafeInt(30),
    );
    const attackingStrike = { ...strike, phase: "ATTACKING" as const };

    const result = resolveAirCombat({
      battleId: "battle-1",
      minute: 6,
      strikeMissions: [attackingStrike],
      existingRecords: [],
    });

    expect(result.records.length).toBe(1);
    const sorted = [...result.records].sort(
      (a, b) => Number(a.minute) - Number(b.minute) || a.actorId.localeCompare(b.actorId),
    );
    expect(result.records).toEqual(sorted);
  });

  it("provides summary when active", () => {
    const cap = createCapPatrolState(
      "sq-cap",
      ["CAP"],
      SafeInt(4),
      SafeInt(500),
      SafeInt(60),
      [0, 0],
    );
    const engagingCap = {
      ...cap,
      engagementState: "ENGAGING" as const,
      interceptTargetId: "strike-1",
    };

    const result = resolveAirCombat({
      battleId: "battle-1",
      minute: 4,
      capPatrols: [engagingCap],
    });

    expect(result.summary).toBeDefined();
    expect(result.summary!.capEngagements).toBe(1);
    expect(result.summary!.strikeAttacks).toBe(0);
  });
});

describe("AC-22 integration boundary", () => {
  it("does not modify BattleResolver", () => {
    expect(typeof BattleResolver).toBe("function");
    const src = readFileSync(resolve(__dirname, "../../src/resolver.ts"), "utf-8");
    expect(src).not.toContain("airCombat");
    expect(src).not.toContain("resolveAirCombat");
  });

  it("does not modify StrengthCalculator", () => {
    expect(typeof StrengthCalculator).toBe("function");
    const src = readFileSync(resolve(__dirname, "../../src/strength.ts"), "utf-8");
    expect(src).not.toContain("airCombat");
    expect(src).not.toContain("resolveAirCombat");
  });

  it("air-combat module has no phase-engine dependency", () => {
    const airCombatDir = resolve(__dirname, "../../src/air-combat");
    const files = readdirSync(airCombatDir).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const content = readFileSync(resolve(airCombatDir, file), "utf-8");
      expect(content).not.toContain("phase-engine");
      expect(content).not.toContain("phaseEngine");
    }
  });

  it("all air-combat module files are in the air-combat/ directory", () => {
    const srcDir = resolve(__dirname, "../../src");
    const allFiles = readdirSync(srcDir).filter((f) => f.endsWith(".ts") && f !== "index.ts");
    for (const file of allFiles) {
      const content = readFileSync(resolve(srcDir, file), "utf-8");
      if (content.includes("../air-combat") || content.includes("./air-combat")) {
        if (file !== "index.ts" && !file.startsWith("simulation/")) {
          throw new Error(
            `File ${file} outside air-combat/ directory references air-combat module`,
          );
        }
      }
    }
  });

  it("air-comcat records have valid hashes", () => {
    const cap = createCapPatrolState(
      "sq-verify",
      ["CAP"],
      SafeInt(4),
      SafeInt(500),
      SafeInt(60),
      [0, 0],
    );
    const engagingCap = {
      ...cap,
      engagementState: "ENGAGING" as const,
      interceptTargetId: "target-1",
    };

    const result = resolveAirCombat({
      battleId: "battle-verify",
      minute: 3,
      capPatrols: [engagingCap],
    });

    for (const record of result.records) {
      expect(record.recordHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
