import { describe, expect, it } from "vite-plus/test";
import { runTimeSliced } from "./time-slice.js";

function harness(budgetMs: number) {
  let clock = 0;
  const queue: (() => void)[] = [];
  return {
    options: {
      budgetMs,
      now: () => clock,
      schedule: (resume: () => void) => queue.push(resume),
    },
    tick: (ms: number) => {
      clock += ms;
    },
    flush: () => {
      let slices = 0;
      while (queue.length > 0) {
        (queue.shift() as () => void)();
        slices += 1;
      }
      return slices;
    },
  };
}

describe("runTimeSliced", () => {
  it("returns the generator's result and splits work across slices", () => {
    const h = harness(5);
    function* work() {
      for (let i = 0; i < 6; i++) {
        h.tick(2); // each step costs 2 ms => 3 steps per 5 ms slice (2,4,6 >= 5)
        yield;
      }
      return "done";
    }
    const results: string[] = [];
    runTimeSliced(work(), h.options, (r) => results.push(r));
    const slices = h.flush();
    expect(results).toEqual(["done"]);
    expect(slices).toBeGreaterThan(1);
  });

  it("does not start until scheduled, and stops when cancelled", () => {
    const h = harness(5);
    let ran = 0;
    function* work() {
      ran += 1;
      yield;
      ran += 1;
      return 1;
    }
    const done: number[] = [];
    const handle = runTimeSliced(work(), h.options, (r) => done.push(r));
    expect(ran).toBe(0);
    handle.cancel();
    h.flush();
    expect(ran).toBe(0);
    expect(done).toEqual([]);
  });

  it("always makes progress even when one step exceeds the budget", () => {
    const h = harness(1);
    function* work() {
      h.tick(50);
      yield;
      h.tick(50);
      return "ok";
    }
    const out: string[] = [];
    runTimeSliced(work(), h.options, (r) => out.push(r));
    h.flush();
    expect(out).toEqual(["ok"]);
  });
});
