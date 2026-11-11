import type { ConstructionProject } from "@bluewave/campaign";
import type { ConstructionEvent, ConstructionOverrunEvent } from "@bluewave/content-schema";
import { RandomEngine, RandomLedger } from "@bluewave/random";
import { describe, expect, it } from "vite-plus/test";

import {
  CONSTRUCTION_EVENT_STREAM_FAMILY,
  resolveConstructionEvents,
  type ConstructionEventSubject,
} from "../src/constructionEvents.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET" as const,
  confidence: "LOW" as const,
  kind: "balance_adjustment" as const,
  sources: [],
  note: "PROVISIONAL test fixture",
};

const rule = (
  over: Partial<Extract<ConstructionEvent, { kind: "DELAY" }>> = {},
): ConstructionEvent => ({
  id: "steel_plate_shortage",
  kind: "DELAY",
  probabilityBp: 10_000,
  minMonths: 2,
  maxMonths: 2,
  pressureMultiplierBp: 20_000,
  reasonCode: "STEEL_PLATE_SHORTAGE",
  causeKey: "construction.event.steel_plate_shortage",
  provenance,
  ...over,
});

const overrunRule = (over: Partial<ConstructionOverrunEvent> = {}): ConstructionOverrunEvent => ({
  id: "design_change_rework",
  kind: "OVERRUN",
  probabilityBp: 10_000,
  minBp: 200,
  maxBp: 1_000,
  capBp: 3_000,
  reasonCode: "DESIGN_CHANGE_REWORK",
  causeKey: "construction.event.design_change_rework",
  provenance,
  ...over,
});

const subject = (
  id: string,
  status: ConstructionProject["status"] = "ACTIVE",
  over: Partial<ConstructionEventSubject> = {},
): ConstructionEventSubject => ({
  id,
  status,
  homeBuild: true,
  remainingWork: 10_000,
  originalWork: 10_000,
  overrunWork: 0,
  ...over,
});

const run = (
  rules: readonly ConstructionEvent[],
  projects: readonly ConstructionEventSubject[],
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
      months: 2,
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
      { projectId: "p-1", eventId: "a_event", reasonCode: "A_EVENT", months: 2 },
    ]);
  });

  describe("delay length", () => {
    it("draws the months inside the authored range from its own stream and records it", () => {
      const projects = Array.from({ length: 80 }, (_, i) =>
        subject(`p-${String(i).padStart(3, "0")}`),
      );
      const { result, randomLedger } = run([rule({ minMonths: 1, maxMonths: 3 })], projects);
      const lengths = new Set(result.delays.map((d) => d.months));
      expect(result.delays).toHaveLength(80);
      expect([...lengths].sort((a, b) => a - b)).toEqual([1, 2, 3]);
      const recorded = randomLedger.all.filter((d) => d.outcome === "DELAY_MONTHS");
      expect(recorded).toHaveLength(80);
      expect(recorded.map((d) => d.draw)).toEqual(result.delays.map((d) => d.months));
    });

    it("does not move the hit draw when the length range changes", () => {
      const projects = Array.from({ length: 60 }, (_, i) =>
        subject(`p-${String(i).padStart(3, "0")}`),
      );
      const narrow = run([rule({ probabilityBp: 1_500, minMonths: 1, maxMonths: 1 })], projects);
      const wide = run([rule({ probabilityBp: 1_500, minMonths: 1, maxMonths: 3 })], projects);
      expect(wide.result.delays.map((d) => d.projectId)).toEqual(
        narrow.result.delays.map((d) => d.projectId),
      );
    });
  });

  describe("eligibility", () => {
    it("never delays a foreign contract, a dock expansion or any non-home build", () => {
      const { result, randomLedger } = run(
        [rule()],
        [subject("p-foreign", "ACTIVE", { homeBuild: false })],
      );
      expect(result.delays).toEqual([]);
      expect(randomLedger.all).toEqual([]);
    });

    it("still delays a home build beside a foreign one", () => {
      const { result } = run(
        [rule()],
        [subject("p-a", "ACTIVE", { homeBuild: false }), subject("p-b")],
      );
      expect(result.delays.map((d) => d.projectId)).toEqual(["p-b"]);
    });
  });

  describe("capacity pressure", () => {
    const projects = Array.from({ length: 400 }, (_, i) =>
      subject(`p-${String(i).padStart(3, "0")}`),
    );
    const withPressure = (capacityPressureBp: number, rules: readonly ConstructionEvent[]) => {
      const randomLedger = new RandomLedger();
      const result = resolveConstructionEvents({
        nationId: "gbr",
        campaignMonth: "1885-03",
        projects,
        rules,
        capacityPressureBp,
        randomEngine: new RandomEngine("pressure-seed"),
        randomLedger,
      });
      return { result, randomLedger };
    };
    const base = rule({ probabilityBp: 1_000 });

    it("doubles the delay chance only above one hundred percent", () => {
      const calm = withPressure(10_000, [base]).result.delays.length;
      const strained = withPressure(10_001, [base]).result.delays.length;
      expect(calm).toBe(withPressure(0, [base]).result.delays.length);
      expect(strained).toBeGreaterThan(calm * 1.5);
      expect(strained).toBeLessThan(calm * 2.6);
    });

    it("hits every strained project when the multiplied chance reaches certainty", () => {
      const sure = rule({ probabilityBp: 6_000, pressureMultiplierBp: 20_000 });
      expect(withPressure(15_000, [sure]).result.delays).toHaveLength(400);
    });

    it("leaves overrun chances alone", () => {
      const over = overrunRule({ probabilityBp: 1_000 });
      expect(withPressure(20_000, [over]).result.overruns).toEqual(
        withPressure(0, [over]).result.overruns,
      );
    });

    it("records the effective chance in the decision input", () => {
      const calm = withPressure(0, [base]).randomLedger.all[0]!;
      const strained = withPressure(20_000, [base]).randomLedger.all[0]!;
      expect(strained.inputHash).not.toBe(calm.inputHash);
    });
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
    expect(randomLedger.all.map((d) => d.outcome)).toEqual(["DELAYED", "DELAY_MONTHS"]);
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
    expect(result.overruns).toEqual([]);
    expect(randomLedger.all).toEqual([]);
  });

  describe("overruns", () => {
    it("adds a share of remaining work inside the authored range, with cause and amount", () => {
      const projects = Array.from({ length: 60 }, (_, i) =>
        subject(`p-${String(i).padStart(3, "0")}`),
      );
      const { result } = run([overrunRule()], projects);
      expect(result.delays).toEqual([]);
      expect(result.overruns).toHaveLength(60);
      for (const overrun of result.overruns) {
        expect(overrun.reasonCode).toBe("DESIGN_CHANGE_REWORK");
        expect(overrun.eventId).toBe("design_change_rework");
        expect(overrun.percentBp).toBeGreaterThanOrEqual(200);
        expect(overrun.percentBp).toBeLessThanOrEqual(1_000);
        expect(overrun.amount).toBe(Math.floor((10_000 * overrun.percentBp) / 10_000));
      }
      expect(new Set(result.overruns.map((o) => o.percentBp)).size).toBeGreaterThan(1);
    });

    it("takes its share of remaining work only, never of work already done", () => {
      const { result } = run(
        [overrunRule({ minBp: 1_000, maxBp: 1_000 })],
        [subject("p-1", "ACTIVE", { remainingWork: 2_000, originalWork: 10_000 })],
      );
      expect(result.overruns).toEqual([
        {
          projectId: "p-1",
          eventId: "design_change_rework",
          reasonCode: "DESIGN_CHANGE_REWORK",
          percentBp: 1_000,
          amount: 200,
        },
      ]);
    });

    it("trims the amount to the room left under the cumulative cap", () => {
      const { result } = run(
        [overrunRule({ minBp: 1_000, maxBp: 1_000, capBp: 3_000 })],
        [
          subject("p-1", "ACTIVE", {
            remainingWork: 10_000,
            originalWork: 10_000,
            overrunWork: 2_800,
          }),
        ],
      );
      expect(result.overruns.map((o) => o.amount)).toEqual([200]);
    });

    it("draws nothing once the cumulative cap is reached", () => {
      const { result, randomLedger } = run(
        [overrunRule()],
        [subject("p-1", "ACTIVE", { overrunWork: 3_000 })],
      );
      expect(result.overruns).toEqual([]);
      expect(randomLedger.all).toEqual([]);
    });

    it("counts a hit that rounds to no work as a miss", () => {
      const { result, randomLedger } = run(
        [overrunRule({ minBp: 200, maxBp: 200 })],
        [subject("p-1", "ACTIVE", { remainingWork: 10, originalWork: 10_000 })],
      );
      expect(result.overruns).toEqual([]);
      expect(randomLedger.all.map((d) => d.outcome)).toEqual(["CONTINUED"]);
    });

    it("never draws for a foreign contract or any status that is not being built", () => {
      const statuses = ["PLANNED", "HALTED", "DELAYED", "COMPLETED", "CANCELLED"] as const;
      const { result, randomLedger } = run(
        [overrunRule()],
        [
          ...statuses.map((status) => subject(`p-${status}`, status)),
          subject("p-foreign", "ACTIVE", { homeBuild: false }),
        ],
      );
      expect(result.overruns).toEqual([]);
      expect(randomLedger.all).toEqual([]);
    });

    it("hits an accelerated project too", () => {
      const { result } = run([overrunRule()], [subject("p-1", "ACCELERATED")]);
      expect(result.overruns).toHaveLength(1);
    });

    it("hits a project at most once per month across delay and overrun kinds", () => {
      const { result } = run(
        [rule({ id: "z_delay" }), overrunRule({ id: "a_overrun" })],
        [subject("p-1")],
      );
      expect(result.overruns).toHaveLength(1);
      expect(result.delays).toEqual([]);
      const flipped = run(
        [rule({ id: "a_delay" }), overrunRule({ id: "z_overrun" })],
        [subject("p-1")],
      );
      expect(flipped.result.delays).toHaveLength(1);
      expect(flipped.result.overruns).toEqual([]);
    });

    it("records the hit and the magnitude draw in the random ledger", () => {
      const { result, randomLedger } = run([overrunRule()], [subject("p-1")]);
      expect(randomLedger.all.map((d) => d.outcome)).toEqual(["OVERRUN", "OVERRUN_MAGNITUDE"]);
      expect(randomLedger.all[0]!.reasonCode).toBe("DESIGN_CHANGE_REWORK");
      expect(randomLedger.all[1]!.draw).toBe(result.overruns[0]!.percentBp);
      expect(randomLedger.all.every((d) => d.streamId === CONSTRUCTION_EVENT_STREAM_FAMILY)).toBe(
        true,
      );
    });

    it("is identical across runs, differs across seeds and ignores supply order", () => {
      const projects = Array.from({ length: 100 }, (_, i) =>
        subject(`p-${String(i).padStart(3, "0")}`),
      );
      const rules = [
        overrunRule({ id: "a_overrun", probabilityBp: 900 }),
        rule({ id: "b_delay", probabilityBp: 900, reasonCode: "B_DELAY" }),
      ];
      const first = run(rules, projects, "seed-one");
      const again = run(rules, projects, "seed-one");
      const other = run(rules, projects, "seed-two");
      const reversed = run([...rules].reverse(), [...projects].reverse(), "seed-one");
      expect(first.result.overruns.length).toBeGreaterThan(0);
      expect(again.result).toEqual(first.result);
      expect(again.randomLedger.hash()).toBe(first.randomLedger.hash());
      expect(reversed.randomLedger.hash()).toBe(first.randomLedger.hash());
      expect(other.randomLedger.hash()).not.toBe(first.randomLedger.hash());
    });
  });
});
