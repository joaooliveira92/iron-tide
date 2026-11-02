import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { runPeaceAcceptance, type PeaceAcceptanceObservation } from "../src/peace-acceptance.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "dist", "run-peace-acceptance-child.js");

function runChild(): PeaceAcceptanceObservation | { error: string } {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 180000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!) as PeaceAcceptanceObservation | { error: string };
}

describe("ProposePeace status-quo term on the production pack (issue #482)", () => {
  const obs = runPeaceAcceptance();

  it("ends the war and resets the pair to neutral tension 5", () => {
    expect(obs.propose.warStatus).toBe("ENDED");
    expect(obs.propose.relation).toBe("neutral");
    expect(obs.propose.tension).toBe(5);
  });

  it("hashes identically to the existing AcceptPeace flow", () => {
    expect(obs.accept.warStatus).toBe("ENDED");
    expect(obs.propose.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expect(obs.propose).toEqual(obs.accept);
  });

  it("cedes a whole priced area and replays to the same hash", () => {
    expect(obs.cede.warStatus).toBe("ENDED");
    expect(obs.cede.controllerBefore).toBe("italy");
    expect(obs.cede.controllerAfter).toBe("austria_hungary");
    expect(obs.cede.transferredPossessionIds.length).toBeGreaterThan(0);
    expect(obs.cede.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    expect(obs.cede.snapshotHash).not.toBe(obs.propose.snapshotHash);
  });

  it("is byte-identical across two clean processes", () => {
    const a = runChild();
    const b = runChild();
    expect(a).toEqual(b);
    expect(a).toEqual(obs);
  });
});
