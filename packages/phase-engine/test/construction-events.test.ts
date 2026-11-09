import type { ConstructionProject } from "@bluewave/campaign";
import type { ConstructionEvent } from "@bluewave/content-schema";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import { describe, expect, it } from "vite-plus/test";

import {
  CONSTRUCTION_EVENT_STREAM_FAMILY,
  resolveConstructionEvents,
} from "../src/constructionEvents.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET" as const,
  confidence: "LOW" as const,
  kind: "balance_adjustment" as const,
  sources: [],
  note: "PROVISIONAL test fixture",
};

const rule = (over: Partial<ConstructionEvent> = {}): ConstructionEvent => ({
  id: "steel_plate_shortage",
  kind: "DELAY",
  probabilityBp: 10_000,
  reasonCode: "STEEL_PLATE_SHORTAGE",
  causeKey: "construction.event.steel_plate_shortage",
  provenance,
  ...over,
});

const subject = (id: string, status: ConstructionProject["status"] = "ACTIVE") => ({ id, status });

const run = (
  rules: readonly ConstructionEvent[],
  projects: readonly { id: string; status: ConstructionProject["status"] }[],
  seed = "construction-events-seed",
  campaignMonth = "1885-03",
) => {
  const randomLedger = new RandomLedger();
  const result = resolveConstructionEvents({
    nationId: "gbr",
    campaignMonth,
    projects,
    rules,
    randomEngine: new RandomEngine(seed),
    randomLedger,
  });
  return { result, randomLedger };
};

describe("resolveConstructionEvents", () => {
  it("delays every eligible project when the probability is certain", () => {
    const { result } = run([rule()], [subject("p-b"), subject("p-a")]);
    expect(result.delays.map((d) => d.projectId)).toEqual(["p-a", "p-b"]);
    expect(result.delays[0]).toEqual({
      projectId: "p-a",
      eventId: "steel_plate_shortage",
      reasonCode: "STEEL_PLATE_SHORTAGE",
    });
  });

  it("never draws for projects that are not being built", () => {
    const statuses = [
      "PLANNED",
      "HALTED",
      "DELAYED",
      "AWAITING_CAPACITY",
      "IMPOUNDED",
      "COMPLETED",
      "CANCELLED",
    ] as const;
    const { result, randomLedger } = run(
      [rule()],
      statuses.map((status) => subject(`p-${status}`, status)),
    );
    expect(result.delays).toEqual([]);
    expect(randomLedger.all).toEqual([]);
  });

  it("delays accelerated projects too", () => {
    const { result } = run([rule()], [subject("p-1", "ACCELERATED")]);
    expect(result.delays).toHaveLength(1);
  });

  it("applies one event per project per month, the first by id", () => {
    const { result } = run(
      [
        rule({ id: "b_event", reasonCode: "B_EVENT" }),
        rule({ id: "a_event", reasonCode: "A_EVENT" }),
      ],
      [subject("p-1")],
    );
    expect(result.delays).toEqual([
      { projectId: "p-1", eventId: "a_event", reasonCode: "A_EVENT" },
    ]);
  });

  it("skips an event outside its era window", () => {
    const windowed = rule({ eraWindow: { fromMonth: "1890-01", toMonth: "1899-12" } });
    expect(run([windowed], [subject("p-1")]).result.delays).toEqual([]);
    expect(run([windowed], [subject("p-1")], "s", "1890-01").result.delays).toHaveLength(1);
    expect(run([windowed], [subject("p-1")], "s", "1899-12").result.delays).toHaveLength(1);
    expect(run([windowed], [subject("p-1")], "s", "1900-01").result.delays).toEqual([]);
  });

  it("records each draw with its stream family, project and outcome", () => {
    const { randomLedger } = run([rule()], [subject("p-1")]);
    expect(randomLedger.all).toHaveLength(1);
    const decision = randomLedger.all[0]!;
    expect(decision.streamId).toBe(CONSTRUCTION_EVENT_STREAM_FAMILY);
    expect(decision.entityKey).toBe("p-1");
    expect(decision.outcome).toBe("DELAYED");
    expect(decision.reasonCode).toBe("STEEL_PLATE_SHORTAGE");
  });

  it("records a continued outcome when the draw misses", () => {
    const projects = Array.from({ length: 200 }, (_, i) =>
      subject(`p-${String(i).padStart(3, "0")}`),
    );
    const { result, randomLedger } = run([rule({ probabilityBp: 100 })], projects);
    const missed = randomLedger.all.filter((d) => d.outcome === "CONTINUED");
    expect(missed.length).toBeGreaterThan(0);
    expect(result.delays.length + missed.length).toBe(200);
    expect(result.delays.length).toBeLessThan(20);
  });

  it("is identical across runs with the same seed and differs across seeds", () => {
    const projects = Array.from({ length: 100 }, (_, i) =>
      subject(`p-${String(i).padStart(3, "0")}`),
    );
    const rules = [rule({ probabilityBp: 1_500 })];
    const first = run(rules, projects, "seed-one");
    const again = run(rules, projects, "seed-one");
    const other = run(rules, projects, "seed-two");
    expect(again.result).toEqual(first.result);
    expect(again.randomLedger.hash()).toBe(first.randomLedger.hash());
    expect(other.randomLedger.hash()).not.toBe(first.randomLedger.hash());
  });

  it("does not depend on the order projects or rules are supplied", () => {
    const projects = Array.from({ length: 50 }, (_, i) =>
      subject(`p-${String(i).padStart(3, "0")}`),
    );
    const rules = [
      rule({ id: "a_event", probabilityBp: 800, reasonCode: "A_EVENT" }),
      rule({ id: "b_event", probabilityBp: 800, reasonCode: "B_EVENT" }),
    ];
    const forward = run(rules, projects);
    const reversed = run([...rules].reverse(), [...projects].reverse());
    expect(reversed.result).toEqual(forward.result);
    expect(reversed.randomLedger.hash()).toBe(forward.randomLedger.hash());
  });

  it("is a no-op without rules", () => {
    const { result, randomLedger } = run([], [subject("p-1")]);
    expect(result.delays).toEqual([]);
    expect(randomLedger.all).toEqual([]);
  });
});
