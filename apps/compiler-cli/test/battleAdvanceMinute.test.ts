import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TacticalBattleState, TacticalShipUnit } from "@bluewave/combat";
import { SafeInt } from "@bluewave/contracts";
import { runBattleAdvanceMinute, type BattleAdvanceMinuteCliOptions } from "../src/commands.js";
import { runCli } from "./runCli.js";

function stdoutSpy() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true as any);
}

function unit(id: string, sideId: "ATTACKER" | "DEFENDER"): TacticalShipUnit {
  return {
    assetId: id,
    campaignShipId: id,
    sideId,
    name: id,
    className: "Battleship",
    designVersionId: "dv-1",
    shipType: "BB",
    displacementKg: SafeInt(30_000_000),
    designedSpeedUms: SafeInt(15_433_320),
    armorBeltUm: SafeInt(305_000),
    mainGunsCaliberUm: SafeInt(343_000),
    mainGunsCount: SafeInt(10),
    crewComplement: SafeInt(1_000),
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    sourceStateHash: "pre",
    provenance: {
      battleAssetId: id,
      campaignAssetId: id,
      campaignAggregateType: "Ship",
      sourcePermanentDivisionId: null,
      sourceCompiledDesignId: "dv-1",
      sourceCompiledDesignHash: "design-1",
      preBattleStateHash: "pre",
      projectionReason: "test",
      persistenceDisposition: "persistent",
      provenanceHash: "prov",
    },
  };
}

function fixtureState(): TacticalBattleState {
  return {
    battleId: "b1",
    mapId: "test_map",
    sides: [
      { sideId: "ATTACKER", participantIds: ["a1"] },
      { sideId: "DEFENDER", participantIds: ["d1"] },
    ],
    forces: { ATTACKER: ["a1"], DEFENDER: ["d1"] },
    divisions: [],
    units: [unit("a1", "ATTACKER"), unit("d1", "DEFENDER")],
    contacts: [],
    objectives: [],
    weather: { weather: "clear", seaState: "calm", visibilityNm: 20, daylight: true },
    exitZones: [],
    battleEventLedger: [],
  };
}

function baseOptions(statePath?: string): BattleAdvanceMinuteCliOptions {
  return {
    outputMode: "human",
    statePath,
    minute: 1,
    observationTime: "1900-01-01T00:00:00.000Z",
  };
}

describe("runBattleAdvanceMinute", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bwc-advance-minute-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns usage-error when --state is not provided", async () => {
    expect(await runCli(runBattleAdvanceMinute(baseOptions()))).toBe("usage-error");
  });

  it("returns usage-error when the state file does not exist", async () => {
    expect(await runCli(runBattleAdvanceMinute(baseOptions(join(dir, "missing.json"))))).toBe(
      "usage-error",
    );
  });

  it("returns usage-error when the state file is not valid JSON", async () => {
    const statePath = join(dir, "state.json");
    writeFileSync(statePath, "not json", "utf8");
    expect(await runCli(runBattleAdvanceMinute(baseOptions(statePath)))).toBe("usage-error");
  });

  it("advances one minute and prints a human summary", async () => {
    const statePath = join(dir, "state.json");
    writeFileSync(statePath, JSON.stringify({ state: fixtureState() }), "utf8");
    const spy = stdoutSpy();
    const result = await runCli(runBattleAdvanceMinute(baseOptions(statePath)));
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Minute 1 advanced");
    expect(output).toContain("a1");
    expect(output).toContain("d1");
    expect(output).toMatch(/Minute hash: [0-9a-f]{64}/);
    spy.mockRestore();
  });

  it("emits structured JSON output in --json mode", async () => {
    const statePath = join(dir, "state.json");
    writeFileSync(statePath, JSON.stringify({ state: fixtureState() }), "utf8");
    const spy = stdoutSpy();
    const result = await runCli(
      runBattleAdvanceMinute({ ...baseOptions(statePath), outputMode: "json" }),
    );
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    const jsonLine = output.split("\n").find((line) => line.includes("minuteHash"));
    expect(jsonLine).toBeDefined();
    const parsed = JSON.parse(jsonLine!);
    expect(parsed.minute).toBe(1);
    expect(parsed.movementStates).toHaveProperty("a1");
    expect(parsed.movementStates).toHaveProperty("d1");
    expect(parsed.minuteHash).toMatch(/^[0-9a-f]{64}$/);
    spy.mockRestore();
  });

  it("respects orders and attackRangeUm passed through the state file", async () => {
    const statePath = join(dir, "state.json");
    writeFileSync(
      statePath,
      JSON.stringify({
        state: fixtureState(),
        orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
        attackRangeUm: 50_000_000_000,
      }),
      "utf8",
    );
    const spy = stdoutSpy();
    const result = await runCli(
      runBattleAdvanceMinute({ ...baseOptions(statePath), outputMode: "json" }),
    );
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    const jsonLine = output.split("\n").find((line) => line.includes("minuteHash"));
    const parsed = JSON.parse(jsonLine!);
    expect(parsed.movementStates.a1.orderedSpeed).toBe(20_000);
    spy.mockRestore();
  });

  it("routes a BluewaveError (invalid fixed-point movement state) through the ticket-01 adapter as validation-error", async () => {
    const statePath = join(dir, "state.json");
    const state = fixtureState();
    state.movementStates = {
      a1: {
        position: [0.5, 0], // non-integer -> TACTICAL_STATE_INVARIANT_FAILED
        heading: 0,
        orderedSpeed: 10_000,
        currentSpeed: 10_000,
        acceleration: 0,
        turningRate: 1_000,
        collisionRadius: 5_000_000,
        propulsionState: "steam",
        machineryReliability: 10_000,
        fuelState: "coal",
        formationStation: "LEAD",
      },
    };
    writeFileSync(statePath, JSON.stringify({ state }), "utf8");
    const spy = stdoutSpy();
    const result = await runCli(runBattleAdvanceMinute(baseOptions(statePath)));
    expect(result).toBe("validation-error");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("TACTICAL_STATE_INVARIANT_FAILED");
    spy.mockRestore();
  });
});
