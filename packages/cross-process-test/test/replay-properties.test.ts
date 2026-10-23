import type { MonthResult } from "@bluewave/phase-engine";
import fc from "fast-check";
import { describe, expect, it } from "vite-plus/test";

import {
  PICK_SCALE,
  runCommandPlan,
  type CommandKind,
  type CommandPick,
  type CommandPlan,
} from "../src/replay-corpus/index.js";

const SEED = "property-scenarios-1880";
const FAST_CHECK_SEED = 0x1880;
const RUNS = 12;
const KINDS: readonly CommandKind[] = [
  "SetBudgetAllocation",
  "SetResearchPriority",
  "OrderConstruction",
];

const pickArbitrary: fc.Arbitrary<CommandPick> = fc.record({
  kind: fc.constantFrom(...KINDS),
  draws: fc.array(fc.integer({ min: 0, max: PICK_SCALE - 1 }), { minLength: 1, maxLength: 4 }),
});

const planArbitrary: fc.Arbitrary<CommandPlan> = fc.array(
  fc.array(pickArbitrary, { maxLength: 3 }),
  { minLength: 1, maxLength: 3 },
);

interface Perturbation {
  readonly month: number;
  readonly afterExecute: (result: MonthResult) => void;
}

function extraDraw(month: number): Perturbation {
  return {
    month,
    afterExecute: (result) => {
      result.randomLedger.record({
        streamId: "mutation",
        entityKey: "mutation",
        phase: "mutation",
        rulesetVersion: "0.1.0",
        inputHash: "0".repeat(64),
        draw: 1,
        outcome: "mutation",
        reasonCode: "MUTATION",
      });
    },
  };
}

function violations(plan: CommandPlan, secondRun?: Perturbation): string[] {
  const first = runCommandPlan(SEED, plan);
  const second = runCommandPlan(SEED, plan, secondRun === undefined ? {} : { perturb: secondRun });
  const tripped = runCommandPlan(SEED, plan, { roundTrip: {} });
  const found: string[] = [];
  if (first.digest !== second.digest) found.push("repeatability");
  if (tripped.roundTripDivergence !== undefined || tripped.digest !== first.digest) {
    found.push("roundtrip");
  }
  if (first.invariantViolations.length > 0) found.push("invariants");
  return found;
}

const parameters = { seed: FAST_CHECK_SEED, numRuns: RUNS };

describe("generated command plans", () => {
  it("are repeatable, survive save/load every month, and keep every invariant", () => {
    fc.assert(
      fc.property(planArbitrary, (plan) => {
        expect(violations(plan)).toEqual([]);
      }),
      parameters,
    );
  });

  it("run the same plan to the same digest", () => {
    fc.assert(
      fc.property(planArbitrary, (plan) => {
        expect(runCommandPlan(SEED, plan).digest).toBe(runCommandPlan(SEED, plan).digest);
      }),
      parameters,
    );
  });

  it("generate every command kind and have the engine accept each issued command", () => {
    const accepted = new Set<CommandKind>();
    fc.assert(
      fc.property(planArbitrary, (plan) => {
        const run = runCommandPlan(SEED, plan);
        expect(run.commandsAccepted).toBe(run.commandsIssued);
        for (const picks of plan) for (const pick of picks) accepted.add(pick.kind);
        return true;
      }),
      { ...parameters, numRuns: 40 },
    );
    expect([...accepted].sort()).toEqual([...KINDS].sort());
  });

  it("change the digest when a command is added", () => {
    const withCommand: CommandPlan = [[{ kind: "SetBudgetAllocation", draws: [500, 900] }]];
    expect(runCommandPlan(SEED, withCommand).digest).not.toBe(runCommandPlan(SEED, [[]]).digest);
  });
});

describe("the property harness itself", () => {
  it("detects an injected nondeterminism and shrinks it to the smallest plan", () => {
    const outcome = fc.check(
      fc.property(planArbitrary, (plan) => violations(plan, extraDraw(1)).length === 0),
      { ...parameters, numRuns: 5 },
    );
    expect(outcome.failed).toBe(true);
    expect(outcome.counterexample?.[0]).toEqual([[]]);
  });

  it("reports the seed needed to reproduce a failure", () => {
    const outcome = fc.check(
      fc.property(planArbitrary, (plan) => violations(plan, extraDraw(1)).length === 0),
      { ...parameters, numRuns: 5 },
    );
    expect(outcome.seed).toBe(FAST_CHECK_SEED);
  });
});
