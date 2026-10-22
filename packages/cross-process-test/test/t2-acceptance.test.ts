import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { runT2Acceptance, type T2Observation } from "../src/t2-acceptance.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "dist", "run-t2-acceptance-child.js");

function runChild(): T2Observation | { error: string } {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 180000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!) as T2Observation | { error: string };
}

describe("T-2 acceptance (issue #221): player-fought battle on the production pack", () => {
  const obs = runT2Acceptance();

  it("accepts a production offer, fights the battle and reaches a battle-end decision", () => {
    expect(obs.battle.minutes).toBeGreaterThan(0);
    expect(obs.battle.endReason).not.toBeNull();
    expect(obs.battle.sessionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(obs.battle.damageReport).length).toBeGreaterThan(0);
  });

  it("returns the result through the battle_result interruption into authoritative state", () => {
    expect(obs.submitted.outcome).toBe("completed");
    expect(obs.submitted.battlePhase).toBe("resolved");
    expect(obs.submitted.explanation).toContain("player-resolved");
    expect(obs.submitted.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is byte-identical across two clean processes", () => {
    const a = runChild();
    const b = runChild();
    expect(a).toEqual(b);
    expect(a).toEqual(runT2Acceptance());
  });
});
