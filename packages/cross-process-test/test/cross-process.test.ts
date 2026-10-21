import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "dist", "run-child.js");

interface ChildOutput {
  contentArtifactHash: string;
  contentBundleHash: string;
  initialSnapshotHash: string;
  closingSnapshotHash: string;
  commandLedgerHash: string;
  eventLedgerHash: string;
  financialLedgerHash: string;
  randomDecisionLedgerHash: string;
  replayVerificationHash: string;
  battleGenerationHash: string;
  success: boolean;
}

function runChild(): ChildOutput {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  const jsonLine = lines[lines.length - 1]!;
  return JSON.parse(jsonLine) as ChildOutput;
}

describe("Cross-process determinism", () => {
  it("Two clean child-process runs produce identical hashes", () => {
    const r1 = runChild();
    const r2 = runChild();

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);

    expect(r1.contentArtifactHash).toBe(r2.contentArtifactHash);
    expect(r1.contentBundleHash).toBe(r2.contentBundleHash);
    expect(r1.initialSnapshotHash).toBe(r2.initialSnapshotHash);
    expect(r1.closingSnapshotHash).toBe(r2.closingSnapshotHash);
    expect(r1.commandLedgerHash).toBe(r2.commandLedgerHash);
    expect(r1.eventLedgerHash).toBe(r2.eventLedgerHash);
    expect(r1.financialLedgerHash).toBe(r2.financialLedgerHash);
    expect(r1.randomDecisionLedgerHash).toBe(r2.randomDecisionLedgerHash);
    expect(r1.replayVerificationHash).toBe(r2.replayVerificationHash);
    expect(r1.battleGenerationHash).toBe(r2.battleGenerationHash);
  });

  it("Hashes match golden reference", () => {
    const goldenPath = resolve(thisDir, "..", "..", "..", "golden", "hashes.json");
    if (!existsSync(goldenPath)) {
      return; // Skip if golden file doesn't exist yet
    }

    const r = runChild();
    const golden = JSON.parse(readFileSync(goldenPath, "utf8")) as Record<string, string>;

    expect(r.contentArtifactHash).toBe(golden.contentArtifactHash);
    expect(r.initialSnapshotHash).toBe(golden.initialSnapshotHash);
    expect(r.closingSnapshotHash).toBe(golden.closingSnapshotHash);
    expect(r.commandLedgerHash).toBe(golden.commandLedgerHash);
    expect(r.eventLedgerHash).toBe(golden.eventLedgerHash);
    expect(r.financialLedgerHash).toBe(golden.financialLedgerHash);
    expect(r.randomDecisionLedgerHash).toBe(golden.randomDecisionLedgerHash);
    expect(r.replayVerificationHash).toBe(golden.replayVerificationHash);
  });
});

describe("Compiler canonical order is locale-independent (CAH-DET-1)", () => {
  const localeChildScript = resolve(thisDir, "..", "dist", "run-content-bundle-child.js");

  function runWithLocale(locale: string): string {
    const stdout = execFileSync(process.execPath, [localeChildScript], {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, LC_ALL: locale, LANG: locale, NODE_OPTIONS: "" },
    });
    const lines = stdout.trim().split("\n");
    return (JSON.parse(lines[lines.length - 1]!) as { contentBundleHash: string })
      .contentBundleHash;
  }

  it("builds a byte-identical content bundle under different host locales", () => {
    expect(runWithLocale("en_US.UTF-8")).toBe(runWithLocale("tr_TR.UTF-8"));
  });
});

describe("Part index cross-process determinism (ship-part-model ticket 02)", () => {
  const partIndexChildScript = resolve(thisDir, "..", "dist", "run-part-index-child.js");

  function runPartIndexChild(locale: string): string {
    const stdout = execFileSync(process.execPath, [partIndexChildScript], {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, LC_ALL: locale, LANG: locale, NODE_OPTIONS: "" },
    });
    const lines = stdout.trim().split("\n");
    return (JSON.parse(lines[lines.length - 1]!) as { partIndexBundleHash: string })
      .partIndexBundleHash;
  }

  it("two processes under different host locales build a byte-identical part index", () => {
    expect(runPartIndexChild("en_US.UTF-8")).toBe(runPartIndexChild("tr_TR.UTF-8"));
  });
});

describe("Air-combat cross-process determinism", () => {
  const airCombatChildScript = resolve(thisDir, "..", "dist", "run-air-combat-child.js");

  interface AirCombatChildOutput {
    contentArtifactHash: string;
    initialSnapshotHash: string;
    closingSnapshotHash: string;
    commandLedgerHash: string;
    eventLedgerHash: string;
    financialLedgerHash: string;
    randomDecisionLedgerHash: string;
    resolveAirCombatHash: string;
    success: boolean;
  }

  function runAirCombatChild(): AirCombatChildOutput {
    const stdout = execFileSync(process.execPath, [airCombatChildScript], {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    const lines = stdout.trim().split("\n");
    const jsonLine = lines[lines.length - 1]!;
    return JSON.parse(jsonLine) as AirCombatChildOutput;
  }

  it("Two clean air-combat child-process runs produce identical air-combat hashes", () => {
    const r1 = runAirCombatChild();
    const r2 = runAirCombatChild();

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.resolveAirCombatHash).toBe(r2.resolveAirCombatHash);
    expect(r1.closingSnapshotHash).toBe(r2.closingSnapshotHash);
    expect(r1.eventLedgerHash).toBe(r2.eventLedgerHash);
  });

  it("Air-combat child creates non-empty records when CAP/strike data is present", () => {
    const r = runAirCombatChild();
    expect(r.success).toBe(true);
    expect(r.resolveAirCombatHash).not.toBe("");
    expect(r.resolveAirCombatHash).not.toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ); // Not empty hash
  });
});

describe("Air-defense cross-process determinism (D-4 AC-19)", () => {
  const airDefenseChildScript = resolve(thisDir, "..", "dist", "run-air-defense-child.js");

  interface AirDefenseChildOutput {
    resolveAirDefenseHash: string;
    closingSnapshotHash: string;
    recordCount: number;
    success: boolean;
    error?: string;
  }

  function runAirDefenseChild(): AirDefenseChildOutput {
    const stdout = execFileSync(process.execPath, [airDefenseChildScript], {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    const lines = stdout.trim().split("\n");
    return JSON.parse(lines[lines.length - 1]!) as AirDefenseChildOutput;
  }

  it("Two clean air-defense child-process runs produce identical hashes", () => {
    const r1 = runAirDefenseChild();
    const r2 = runAirDefenseChild();
    expect(r1.error).toBeUndefined();
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.recordCount).toBeGreaterThan(0);
    expect(r1.resolveAirDefenseHash).toBe(r2.resolveAirDefenseHash);
    expect(r1.closingSnapshotHash).toBe(r2.closingSnapshotHash);
  });
});

describe("Carrier operations cross-process determinism", () => {
  const carrierChildScript = resolve(thisDir, "..", "dist", "run-carrier-operations-child.js");

  interface CarrierChildOutput {
    contentArtifactHash: string;
    initialSnapshotHash: string;
    closingSnapshotHash: string;
    commandLedgerHash: string;
    eventLedgerHash: string;
    financialLedgerHash: string;
    randomDecisionLedgerHash: string;
    carrierOpsHash: string;
    success: boolean;
  }

  function runCarrierChild(): CarrierChildOutput {
    const stdout = execFileSync(process.execPath, [carrierChildScript], {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    const lines = stdout.trim().split("\n");
    const jsonLine = lines[lines.length - 1]!;
    return JSON.parse(jsonLine) as CarrierChildOutput;
  }

  it("Two clean carrier child-process runs produce identical carrier ops hashes", () => {
    const r1 = runCarrierChild();
    const r2 = runCarrierChild();

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);

    expect(r1.carrierOpsHash).toBe(r2.carrierOpsHash);
    expect(r1.closingSnapshotHash).toBe(r2.closingSnapshotHash);
    expect(r1.commandLedgerHash).toBe(r2.commandLedgerHash);
    expect(r1.eventLedgerHash).toBe(r2.eventLedgerHash);
    expect(r1.financialLedgerHash).toBe(r2.financialLedgerHash);
    expect(r1.randomDecisionLedgerHash).toBe(r2.randomDecisionLedgerHash);
    expect(r1.contentArtifactHash).toBe(r2.contentArtifactHash);
    expect(r1.initialSnapshotHash).toBe(r2.initialSnapshotHash);
  });
});

describe("Acceleration capacity-pressure cross-process determinism (SB3-R9)", () => {
  const accelerationChildScript = resolve(thisDir, "..", "dist", "run-acceleration-child.js");

  interface AccelerationChildOutput {
    snapshotHash: string;
    randomLedgerHash: string;
    decisions: { streamId: string; entityKey: string; draw: number; outcome: string }[];
    success: boolean;
    error?: string;
  }

  function runAccelerationChild(): AccelerationChildOutput {
    const stdout = execFileSync(process.execPath, [accelerationChildScript], {
      encoding: "utf8",
      timeout: 30000,
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    const lines = stdout.trim().split("\n");
    return JSON.parse(lines[lines.length - 1]!) as AccelerationChildOutput;
  }

  it("two clean child processes produce identical acceleration-pressure decisions and hashes", () => {
    const r1 = runAccelerationChild();
    const r2 = runAccelerationChild();
    expect(r1.error).toBeUndefined();
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r1.decisions.length).toBeGreaterThan(0);
    expect(r1.decisions).toEqual(r2.decisions);
    expect(r1.randomLedgerHash).toBe(r2.randomLedgerHash);
    expect(r1.snapshotHash).toBe(r2.snapshotHash);
  });
});

describe("Presence measurement cross-process determinism (S-5 05)", () => {
  const presenceChildScript = resolve(thisDir, "..", "dist", "run-presence-child.js");

  interface PresenceChildOutput {
    dormantSnapshotHash: string;
    dormantEventLedgerHash: string;
    dormantShortfallCount: number;
    configuredSnapshotHash: string;
    configuredEventLedgerHash: string;
    shortfalls: { nationId: string; areaId: string; shortfallTons: number }[];
    penaltySnapshotHash: string;
    stationedShipId: string;
    deploymentEvents: { kind: string; shipId: string }[];
    deploymentSnapshotHash: string;
    configuredFullSnapshotHash: string;
    deploymentEventLedgerHash: string;
    prestigeRequests: { nationId: string; areaId: string; shortfallTons: number }[];
    revoltRequests: { nationId: string; areaId: string; shortfallTons: number }[];
    exemptNationEventsUnblockaded: number;
    exemptNationEventsBlockaded: number;
    baseLimitFlagged: string[];
    baseLimitSnapshotHash: string;
    baseLimitEventLedgerHash: string;
    success: boolean;
    error?: string;
  }

  function runPresenceChild(): PresenceChildOutput {
    const stdout = execFileSync(process.execPath, [presenceChildScript], {
      encoding: "utf8",
      timeout: 60000,
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    const lines = stdout.trim().split("\n");
    return JSON.parse(lines[lines.length - 1]!) as PresenceChildOutput;
  }

  it("two clean processes over a fixture ruleset produce identical shortfall events and hashes; dormant emits none", () => {
    const r1 = runPresenceChild();
    const r2 = runPresenceChild();
    expect(r1.error).toBeUndefined();
    expect(r1.success).toBe(true);
    expect(r2).toEqual(r1);
    // Dormant: nothing is measured. Configured: the step adds events only, so authoritative state is unchanged.
    expect(r1.dormantShortfallCount).toBe(0);
    expect(r1.configuredSnapshotHash).toBe(r1.dormantSnapshotHash);
    expect(r1.shortfalls.length).toBeGreaterThan(0);
    expect(r1.configuredEventLedgerHash).not.toBe(r1.dormantEventLedgerHash);
    const keys = r1.shortfalls.map((s) => `${s.nationId}/${s.areaId}`);
    expect(keys).toEqual([...keys].sort());
    expect(r1.shortfalls.every((s) => s.shortfallTons > 0)).toBe(true);
  });

  it("penalty requests mirror the shortfalls exactly once, and a blockaded nation at war drops out of every output (S-5 06)", () => {
    const r1 = runPresenceChild();
    const r2 = runPresenceChild();
    expect(r2).toEqual(r1);
    const key = (e: { nationId: string; areaId: string; shortfallTons: number }) =>
      `${e.nationId}/${e.areaId}/${e.shortfallTons}`;
    expect(r1.prestigeRequests.map(key)).toEqual(r1.shortfalls.map(key));
    expect(r1.revoltRequests.map(key)).toEqual(r1.shortfalls.map(key));
    // Requests are events only: authoritative state is unchanged.
    expect(r1.penaltySnapshotHash).toBe(r1.dormantSnapshotHash);
    expect(r1.exemptNationEventsUnblockaded).toBeGreaterThan(0);
    expect(r1.exemptNationEventsBlockaded).toBe(0);
  });

  it("a foreign-station ship is routed identically in two clean processes and only its own events appear (S-5 07)", () => {
    const r1 = runPresenceChild();
    const r2 = runPresenceChild();
    expect(r2).toEqual(r1);
    expect(r1.stationedShipId).not.toBe("");
    expect(r1.deploymentEvents.length).toBeGreaterThan(0);
    expect(r1.deploymentEvents.every((e) => e.shipId === r1.stationedShipId)).toBe(true);
    // The routed ship changed the full authoritative snapshot (fleets and divisions), unlike the same month without it.
    expect(r1.deploymentSnapshotHash).not.toBe(r1.configuredFullSnapshotHash);
  });

  it("base-limit flags and consequences are identical in two clean processes and absent without the block (S-5 08)", () => {
    const r1 = runPresenceChild();
    const r2 = runPresenceChild();
    expect(r2).toEqual(r1);
    expect(r1.baseLimitFlagged.length).toBeGreaterThan(0);
    expect(r1.baseLimitFlagged).toEqual([...r1.baseLimitFlagged].sort());
    // The block moves authoritative state (flags, crew); without it the presence run still equals the dormant one.
    expect(r1.baseLimitSnapshotHash).not.toBe(r1.configuredFullSnapshotHash);
    expect(r1.configuredSnapshotHash).toBe(r1.dormantSnapshotHash);
  });
});

describe("Battle offer cross-process determinism (T-1 03)", () => {
  const offerChildScript = resolve(thisDir, "..", "dist", "run-battle-offer-child.js");

  interface OfferChildOutput {
    success: boolean;
    error?: string;
    request: { kind: string; missionType: string; estimate: { model: string; strength: number } };
    requestReExecutedEqual: boolean;
    requestLeaksEnemyShip: boolean;
    dormantSnapshotHash: string;
    nonOfferedSnapshotHash: string;
    acceptedSnapshotHash: string;
    delegatedSnapshotHash: string;
    acceptedOutcome: string;
    delegatedOutcome: string;
    acceptedWars: string;
    nonOfferedWars: string;
    dormantRandomLedgerHash: string;
    nonOfferedRandomLedgerHash: string;
    draws: { streamId: string; draw: number; reasonCode: string }[];
    declinedOutcome: string;
    declinedSnapshotHash: string;
    declinedInProcessEqual: boolean;
    declinedRecords: { missionType: string; victoryPointCost: number; nationId: string }[];
    declinedBattlePhases: string[];
    declinedWarScores: number[][];
    declinedReservedShips: number;
    declinedEventLedgerHash: string;
    firstCounters: { count: number; key: string }[];
    firstThresholdEvents: number;
    dormantCounters: boolean;
    secondOutcome: string;
    secondCounters: { count: number }[];
    secondThresholdBodies: Record<string, unknown>[];
    secondSnapshotHash: string;
    secondEventLedgerHash: string;
    secondInProcessEqual: boolean;
  }

  function runOfferChild(): OfferChildOutput {
    const stdout = execFileSync(process.execPath, [offerChildScript], {
      encoding: "utf8",
      timeout: 120000,
      env: { ...process.env, NODE_OPTIONS: "" },
    });
    const lines = stdout.trim().split("\n");
    return JSON.parse(lines[lines.length - 1]!) as OfferChildOutput;
  }

  it("two clean processes produce the identical offer, estimate draw and resumed state", () => {
    const r1 = runOfferChild();
    const r2 = runOfferChild();
    expect(r1.error).toBeUndefined();
    expect(r1.success).toBe(true);
    expect(r2).toEqual(r1);
    expect(r1.request.kind).toBe("offer");
    expect(r1.request.missionType).toBe("FLEET_BATTLE");
    expect(r1.requestReExecutedEqual).toBe(true);
    expect(r1.draws).toHaveLength(1);
    expect(r1.draws[0]?.reasonCode).toBe("BATTLE_OFFER_ESTIMATE_PERTURBED");
  });

  it("never leaks an enemy ship, and accept and delegate end with the state of the non-offered run", () => {
    const r = runOfferChild();
    expect(r.requestLeaksEnemyShip).toBe(false);
    expect(r.acceptedOutcome).toBe("completed");
    expect(r.delegatedOutcome).toBe("completed");
    expect(r.acceptedSnapshotHash).toBe(r.nonOfferedSnapshotHash);
    expect(r.delegatedSnapshotHash).toBe(r.nonOfferedSnapshotHash);
    expect(r.acceptedWars).toBe(r.nonOfferedWars);
  });

  it("a decline is byte-identical across two clean processes: one record, a lowered score, released ships", () => {
    const r1 = runOfferChild();
    const r2 = runOfferChild();
    expect(r2.declinedSnapshotHash).toBe(r1.declinedSnapshotHash);
    expect(r2.declinedEventLedgerHash).toBe(r1.declinedEventLedgerHash);
    expect(r1.declinedInProcessEqual).toBe(true);
    expect(r1.declinedOutcome).toBe("completed");
    expect(r1.declinedRecords).toHaveLength(1);
    expect(r1.declinedRecords[0]).toMatchObject({
      nationId: "uk",
      missionType: "FLEET_BATTLE",
      victoryPointCost: 4,
    });
    expect(r1.declinedBattlePhases).toEqual(["declined"]);
    expect(r1.declinedWarScores).toEqual([[-4, 0]]);
    expect(r1.declinedReservedShips).toBe(0);
    expect(r1.declinedSnapshotHash).not.toBe(r1.nonOfferedSnapshotHash);
  });

  it("the scripted declines raise the threshold event exactly at the threshold, identically in two clean processes (T-1 05)", () => {
    const r1 = runOfferChild();
    const r2 = runOfferChild();
    expect(r1.firstCounters.map((c) => c.count)).toEqual([1]);
    expect(r1.firstThresholdEvents).toBe(0);
    expect(r1.dormantCounters).toBe(false);
    expect(r1.secondOutcome).toBe("completed");
    expect(r1.secondCounters.map((c) => c.count)).toEqual([2]);
    expect(r1.secondThresholdBodies).toHaveLength(1);
    expect(r1.secondThresholdBodies[0]).toMatchObject({
      kind: "DeclineThresholdReached",
      nationId: "uk",
      count: 2,
      threshold: 2,
      scope: "WAR",
    });
    expect(r1.secondInProcessEqual).toBe(true);
    expect(r2.secondSnapshotHash).toBe(r1.secondSnapshotHash);
    expect(r2.secondEventLedgerHash).toBe(r1.secondEventLedgerHash);
  });

  it("is byte-identical to the dormant month when no offer is possible (no channel)", () => {
    const r = runOfferChild();
    expect(r.nonOfferedSnapshotHash).toBe(r.dormantSnapshotHash);
    expect(r.nonOfferedRandomLedgerHash).toBe(r.dormantRandomLedgerHash);
  });
});
