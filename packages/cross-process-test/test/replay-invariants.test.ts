import type { CampaignSnapshot } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";

import { productionStartSnapshot } from "../src/replay-corpus/corpus.js";
import { FUZZ_CASES, runFuzzCase } from "../src/replay-corpus/index.js";
import {
  monthInvariantViolations,
  snapshotInvariantViolations,
  turnAdvanceViolations,
} from "../src/replay-corpus/invariants.js";

function codes(snapshot: CampaignSnapshot): string[] {
  return snapshotInvariantViolations(snapshot).map((v) => v.code);
}

function clone(): CampaignSnapshot {
  const base = productionStartSnapshot();
  return {
    ...base,
    slots: base.slots.map((s) => ({ ...s })),
    world: {
      ...base.world,
      areas: base.world.areas.map((a) => ({ ...a })),
      routes: base.world.routes.map((r) => ({ ...r })),
      ports: base.world.ports.map((p) => ({ ...p })),
    },
    nations: new Map([...base.nations].map(([id, n]) => [id, { ...n }])),
  };
}

describe("snapshot invariants", () => {
  it("holds for the production start snapshot", () => {
    expect(snapshotInvariantViolations(productionStartSnapshot())).toEqual([]);
  });

  it("flags a slot that references a missing nation", () => {
    const snapshot = clone();
    snapshot.slots.push({ nationId: "no-such-nation", type: "ai" });
    expect(codes(snapshot)).toContain("SLOT_NATION_MISSING");
  });

  it("flags a nation stored under a key that is not its id", () => {
    const snapshot = clone();
    const [id, nation] = [...snapshot.nations][0]!;
    snapshot.nations.delete(id);
    snapshot.nations.set("wrong-key", nation);
    expect(codes(snapshot)).toContain("NATION_KEY_MISMATCH");
  });

  it("flags a duplicated entity identifier", () => {
    const snapshot = clone();
    const area = snapshot.world.areas[0]!;
    snapshot.world.areas.push({ ...area });
    expect(codes(snapshot)).toContain("DUPLICATE_ID");
  });

  it("flags a port that references a missing area", () => {
    const snapshot = clone();
    const port = snapshot.world.ports[0];
    if (port === undefined) throw new Error("fixture has no ports");
    snapshot.world.ports[0] = { ...port, areaId: "no-such-area" };
    expect(codes(snapshot)).toContain("PORT_AREA_MISSING");
  });

  it("flags a route that references a missing area", () => {
    const snapshot = clone();
    const route = snapshot.world.routes[0];
    if (route === undefined) throw new Error("fixture has no routes");
    snapshot.world.routes[0] = { ...route, to: "no-such-area" };
    expect(codes(snapshot)).toContain("ROUTE_AREA_MISSING");
  });

  it("flags a non-integer authoritative number", () => {
    const snapshot = clone();
    const [id, nation] = [...snapshot.nations][0]!;
    snapshot.nations.set(id, { ...nation, treasury: 1.5 as SafeInt });
    expect(codes(snapshot)).toContain("NOT_SAFE_INTEGER");
  });

  it("flags construction work that exceeds its total", () => {
    const snapshot = clone();
    const [id, nation] = [...snapshot.nations][0]!;
    snapshot.nations.set(id, {
      ...nation,
      constructionProjects: [
        {
          id: "p-1",
          type: "ship",
          projectType: "NEW_CONSTRUCTION",
          targetId: "t",
          designVersionId: "d",
          totalWork: SafeInt(10),
          completedWork: SafeInt(11),
          paidWork: SafeInt(0),
          status: "IN_PROGRESS" as never,
          startedAt: "1880-01",
        },
      ],
    });
    expect(codes(snapshot)).toContain("WORK_EXCEEDS_TOTAL");
  });
});

describe("turn advance invariants", () => {
  it("accepts consecutive turns and flags a repeat or a skip", () => {
    expect(turnAdvanceViolations([1, 2, 3])).toEqual([]);
    expect(turnAdvanceViolations([1, 1]).map((v) => v.code)).toEqual(["TURN_NOT_MONOTONIC"]);
    expect(turnAdvanceViolations([1, 3]).map((v) => v.code)).toEqual(["TURN_NOT_MONOTONIC"]);
  });
});

describe("month invariants over fuzzed campaigns", () => {
  for (const fuzzCase of FUZZ_CASES) {
    it(`hold at every month of ${fuzzCase.seed}`, () => {
      const run = runFuzzCase(fuzzCase);
      expect(run.invariantViolations).toEqual([]);
      expect(turnAdvanceViolations(run.months.map((m) => m.turnNumber))).toEqual([]);
    });
  }

  it("exports a ledger check", () => {
    expect(typeof monthInvariantViolations).toBe("function");
  });
});
