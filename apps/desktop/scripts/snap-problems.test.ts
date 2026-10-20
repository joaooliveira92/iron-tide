import { describe, expect, it } from "vite-plus/test";
import { createProblemLog } from "./snap-problems.ts";

describe("createProblemLog", () => {
  it("starts empty and succeeds", () => {
    const log = createProblemLog();
    expect(log.list()).toEqual([]);
    expect(log.exitCode(true)).toBe(0);
    expect(log.summary()).toBeUndefined();
  });

  it("fails only under strict", () => {
    const log = createProblemLog();
    log.record("page error: boom");
    expect(log.exitCode(false)).toBe(0);
    expect(log.exitCode(true)).toBe(1);
  });

  it("collapses escalating reports for one key into the latest, most specific one", () => {
    const log = createProblemLog();
    log.record("no accessible match", "click:Go");
    log.record("never stabilised", "click:Go");
    log.record("click failed: timeout", "click:Go");
    log.record("page error: boom");
    expect(log.list()).toEqual(["click failed: timeout", "page error: boom"]);
  });

  it("keeps unkeyed duplicates distinct but drops exact repeats", () => {
    const log = createProblemLog();
    log.record("console error: a");
    log.record("console error: a");
    log.record("console error: b");
    expect(log.list()).toEqual(["console error: a", "console error: b"]);
  });

  it("summarises the count and each problem", () => {
    const log = createProblemLog();
    log.record("one");
    log.record("two");
    expect(log.summary()).toBe("snap --strict: 2 problem(s)\n  - one\n  - two");
  });
});
