import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import { runS5Acceptance, type S5Observation } from "../src/s5-acceptance.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "dist", "run-s5-acceptance-child.js");

function runChild(): S5Observation | { error: string } {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!) as S5Observation | { error: string };
}

describe("S-5 acceptance (ticket 11): foreign stations and presence on the production pack", () => {
  const obs = runS5Acceptance();

  it("assigns and clears foreign-station status by command, rejecting an ineligible clear", () => {
    expect(obs.assignment.assignedReason).toBe("ASSIGNED");
    expect(obs.assignment.assignedValue).toBe("FOREIGN_STATION");
    expect(obs.assignment.clearedReason).toBe("CLEARED_BY_COMMAND");
    expect(obs.assignment.clearedValue).toBe("undefined");
    expect(obs.assignment.rejectedCount).toBe(1);
  });

  it("counts a colonial-service ship on foreign station at exactly 1.5x, in the rows and in the shortfall event", () => {
    const w = obs.weighting;
    expect(w.shipTons).toBeGreaterThan(0);
    expect(w.colonialFsPresentTons).toBeGreaterThan(w.plainPresentTons);
    expect(w.colonialFsPresentTons - w.plainPresentTons).toBe(Math.floor(w.shipTons / 2));
    expect(w.colonialFsEventShortfallTons).toBe(w.colonialFsRowShortfallTons);
  });

  it("excludes reserve and mothballed ships from presence", () => {
    const e = obs.exclusion;
    expect(e.activePresentTons).toBeGreaterThan(e.reservePresentTons);
    expect(e.reservePresentTons).toBe(e.mothballedPresentTons);
  });

  it("suspends every shortfall output for a blockaded nation at war, resumes when the war ends, and does not exempt base limits", () => {
    const x = obs.exemption;
    expect(x.eventsBeforeBlockade).toBeGreaterThan(0);
    expect(x.eventsWhileBlockaded).toBe(0);
    expect(x.eventsAfterWarEnds).toBe(x.eventsBeforeBlockade);
    expect(x.baseLimitsUnaffectedWhileBlockaded).toBe(true);
  });

  it("routes a foreign-station ship one hop toward the largest shortfall", () => {
    const r = obs.routing;
    expect(r.targetAreaId).toBe(r.expectedTargetAreaId);
    expect(r.fromAreaId).not.toBe(r.toAreaId);
    expect(r.routeAdjacent).toBe(true);
  });

  it("emits shortfall events with one prestige and one revolt request each, and mutates no state", () => {
    expect(obs.requests.dormantShortfalls).toBe(0);
    expect(obs.requests.shortfalls).toBeGreaterThan(0);
    expect(obs.requests.prestige).toBe(obs.requests.shortfalls);
    expect(obs.requests.revolt).toBe(obs.requests.shortfalls);
    expect(obs.requests.stateUnchangedByRequests).toBe(true);
  });

  it("flags ships beyond the base limit with S-1 consequences, and only when the block is authored", () => {
    expect(obs.overBase.flagged.length).toBeGreaterThan(0);
    expect(obs.overBase.crewReduced).toBe(true);
    expect(obs.overBase.flaggedWithoutBlock).toBe(0);
  });

  it("moves authoritative output only under a configured section (old and new hashes differ)", () => {
    expect(obs.newHashes.snapshot).not.toBe(obs.oldHashes.snapshot);
    expect(obs.newHashes.eventLedger).not.toBe(obs.oldHashes.eventLedger);
  });

  it("is byte-identical across the in-process run and two clean processes", () => {
    const a = runChild();
    const b = runChild();
    expect("error" in a ? a.error : undefined).toBeUndefined();
    expect(b).toEqual(a);
    expect(a).toEqual(obs);
  });
});
