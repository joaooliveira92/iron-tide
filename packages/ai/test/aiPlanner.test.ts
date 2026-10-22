import { describe, it, expect, vi } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize } from "@bluewave/deterministic";
import { CommandIdempotencyMap } from "@bluewave/commands";

import { RandomEngine } from "@bluewave/random";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  MAX_HIGH_PRIORITY_FIELDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/content-schema";
import { AiPlanner } from "../src/aiPlanner";

function snap(overrides: Partial<any> = {}) {
  const base = {
    campaignId: "c1",
    turnNumber: SafeInt(10) as SafeInt,
    nations: new Map([
      [
        "usa",
        {
          treasury: SafeInt(100) as SafeInt,
          constructionProjects: [
            {
              id: "b",
              totalWork: SafeInt(50) as SafeInt,
              completedWork: SafeInt(0) as SafeInt,
              status: "ACTIVE",
            },
            {
              id: "a",
              totalWork: SafeInt(50) as SafeInt,
              completedWork: SafeInt(0) as SafeInt,
              status: "ACTIVE",
            },
          ],
        },
      ],
    ]),
    ...overrides,
  };
  return base as any;
}

describe("AiPlanner", () => {
  it("picks project deterministically sorted by id", () => {
    const engine = new RandomEngine("seed");
    const lifecycle = { process: vi.fn(() => ({ type: "success" })) } as any;
    const planner = new AiPlanner();
    const r1 = planner.generate(
      snap(),
      engine,
      lifecycle,
      { nationId: "usa", type: "AI" } as any,
      new CommandIdempotencyMap(),
    );
    const engine2 = new RandomEngine("seed");
    const r2 = planner.generate(
      snap(),
      engine2,
      lifecycle,
      { nationId: "usa", type: "AI" } as any,
      new CommandIdempotencyMap(),
    );
    expect(r1.envelopes.map((e) => e.body)).toEqual(r2.envelopes.map((e) => e.body));
    const snapReversed = snap({
      nations: new Map([
        [
          "usa",
          {
            treasury: SafeInt(100) as SafeInt,
            constructionProjects: [
              {
                id: "a",
                totalWork: SafeInt(50) as SafeInt,
                completedWork: SafeInt(0) as SafeInt,
                status: "ACTIVE",
              },
              {
                id: "b",
                totalWork: SafeInt(50) as SafeInt,
                completedWork: SafeInt(0) as SafeInt,
                status: "ACTIVE",
              },
            ],
          },
        ],
      ]),
    });
    const r3 = planner.generate(
      snapReversed,
      new RandomEngine("seed"),
      lifecycle,
      { nationId: "usa", type: "AI" } as any,
      new CommandIdempotencyMap(),
    );
    expect(r1.envelopes[0]!.body).toEqual(r3.envelopes[0]!.body);
  });

  it("returns diagnostic when nation missing", () => {
    const planner = new AiPlanner();
    const res = planner.generate(
      snap(),
      new RandomEngine("s"),
      { process: vi.fn() } as any,
      { nationId: "missing", type: "AI" } as any,
      new CommandIdempotencyMap(),
    );
    expect(res.diagnostics[0]!.code).toBe("AI_NATION_MISSING");
    expect(res.accepted.length).toBe(0);
  });

  it("no budget command when treasury negative or no legal projects", () => {
    const planner = new AiPlanner();
    const s = snap({
      nations: new Map([
        [
          "usa",
          {
            treasury: SafeInt(-5) as SafeInt,
            constructionProjects: [
              {
                id: "a",
                totalWork: SafeInt(10) as SafeInt,
                completedWork: SafeInt(0) as SafeInt,
                status: "ACTIVE",
              },
            ],
          },
        ],
      ]),
    });
    const res = planner.generate(
      s,
      new RandomEngine("s"),
      { process: vi.fn(() => ({ type: "success" })) } as any,
      { nationId: "usa", type: "AI" } as any,
      new CommandIdempotencyMap(),
    );
    expect(res.envelopes.filter((e) => (e.body as any).type === "budget_project").length).toBe(0);
  });

  it("research highCount clamped and uses integer RNG", () => {
    const planner = new AiPlanner();
    const lifecycle = { process: vi.fn(() => ({ type: "success" })) } as any;
    const res = planner.generate(
      snap(),
      new RandomEngine("seed2"),
      lifecycle,
      { nationId: "usa", type: "AI" } as any,
      new CommandIdempotencyMap(),
    );
    const research = res.envelopes.find((e) => (e.body as any).type === "SetResearchPriority")!;
    expect(research).toBeDefined();
    const priorities = (research.body as any).fieldPriorities;
    const highCount = Object.values(priorities).filter(
      (v) => v === RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
    ).length;
    expect(highCount).toBeGreaterThanOrEqual(1);
    expect(highCount).toBeLessThanOrEqual(MAX_HIGH_PRIORITY_FIELDS);
  });

  it("handles all lifecycle rejections as diagnostics", () => {
    const planner = new AiPlanner();
    const diag = {
      code: "STALE_SNAPSHOT_HASH",
      severity: "error",
      stage: "ai_planning",
      message: "stale",
      entityId: "usa",
    };
    const lifecycle = {
      process: vi.fn(() => ({ type: "stale_snapshot", diagnostic: diag })),
    } as any;
    const res = planner.generate(
      snap(),
      new RandomEngine("s"),
      lifecycle,
      { nationId: "usa", type: "AI" } as any,
      new CommandIdempotencyMap(),
    );
    expect(res.accepted.length).toBe(0);
    expect(res.diagnostics.length).toBe(2);
  });

  it("stream key encodes nationId with colon", () => {
    const engine = { stream: vi.fn(() => ({ next: () => 0.5 }) as any) } as any;
    const planner = new AiPlanner();
    const s = snap({
      nations: new Map([
        [
          "a:b",
          {
            treasury: SafeInt(100) as SafeInt,
            constructionProjects: [
              {
                id: "a",
                totalWork: SafeInt(50) as SafeInt,
                completedWork: SafeInt(0) as SafeInt,
                status: "ACTIVE",
              },
            ],
          },
        ],
      ]),
    });
    planner.generate(
      s,
      engine,
      { process: () => ({ type: "success" }) } as any,
      { nationId: "a:b", type: "AI" } as any,
      new CommandIdempotencyMap(),
    );
    expect(engine.stream).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent("a:b")));
  });

  it("never mutates snapshot", () => {
    const s = snap();
    const before = canonicalSerialize(s);
    const planner = new AiPlanner();
    planner.generate(
      s,
      new RandomEngine("x"),
      { process: () => ({ type: "success" }) } as any,
      { nationId: "usa", type: "AI" } as any,
      new CommandIdempotencyMap(),
    );
    expect(canonicalSerialize(s)).toBe(before);
  });

  it("uses a supplied national research allocation for the research command", () => {
    const planner = new AiPlanner();
    const lifecycle = { process: vi.fn(() => ({ type: "success" })) } as any;
    const allocation: Record<string, number> = {};
    for (const f of CANONICAL_RESEARCH_FIELD_IDS) allocation[f] = 2;
    allocation["MACHINERY"] = 4;
    allocation["GUNNERY"] = 4;
    const r = planner.generate(
      snap(),
      new RandomEngine("seed"),
      lifecycle,
      { nationId: "usa", type: "AI" } as any,
      new CommandIdempotencyMap(),
      allocation,
    );
    const research = r.envelopes.find(
      (e) => (e.body as { type?: string }).type === "SetResearchPriority",
    )!;
    const fp = (research.body as { fieldPriorities: Record<string, number> }).fieldPriorities;
    expect(fp["MACHINERY"]).toBe(4);
    expect(fp["GUNNERY"]).toBe(4);
    expect(fp["TORPEDOES"]).toBe(2);
    expect(fp["SUBMARINES"]).toBe(2);
  });

  it("ignores an incomplete allocation and falls back to the neutral randomisation", () => {
    const planner = new AiPlanner();
    const lifecycle = { process: vi.fn(() => ({ type: "success" })) } as any;
    const r = planner.generate(
      snap(),
      new RandomEngine("seed"),
      lifecycle,
      { nationId: "usa", type: "AI" } as any,
      new CommandIdempotencyMap(),
      { MACHINERY: 4 },
    );
    const research = r.envelopes.find(
      (e) => (e.body as { type?: string }).type === "SetResearchPriority",
    )!;
    const fp = (research.body as { fieldPriorities: Record<string, number> }).fieldPriorities;
    expect(Object.values(fp).every((v) => v === 4 || v === 2)).toBe(true);
  });
});
