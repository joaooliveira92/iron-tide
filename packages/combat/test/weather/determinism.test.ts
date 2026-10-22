import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "child_process";
import { resolve } from "path";

const childScript = resolve(__dirname, "../../dist/simulation/run-weather-child.js");

interface ChildOutput {
  minuteHashes: string[];
  weatherEventCounts: number[];
}

function runChild(): ChildOutput {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 30000,
  });
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]!);
}

describe("AC-14: cross-process weather determinism", () => {
  it("two clean child processes produce identical minute hashes + weather events", () => {
    const a = runChild();
    const b = runChild();
    expect(a.minuteHashes).toEqual(b.minuteHashes);
    expect(a.weatherEventCounts).toEqual(b.weatherEventCounts);
  });

  it("each minute emits at least one weather event", () => {
    const result = runChild();
    for (const count of result.weatherEventCounts) {
      expect(count).toBeGreaterThanOrEqual(1);
    }
  });

  it("minute hashes are lowercase 64-character hex strings", () => {
    const result = runChild();
    for (const hash of result.minuteHashes) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("identical inputs produce identical minuteHash array (byte-identical across runs)", () => {
    const a = runChild();
    const b = runChild();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
