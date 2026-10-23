import { describe, expect, it } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const childScript = resolve(__dirname, "../../dist-harness/harness/run-submarines-child.js");

describe("AC-20: two-process determinism", () => {
  it("two separate child processes produce byte-identical output", () => {
    const opts = { encoding: "utf8" as const, timeout: 30_000 };
    const stdout1 = execFileSync(process.execPath, [childScript], opts);
    const stdout2 = execFileSync(process.execPath, [childScript], opts);
    expect(stdout1).toBe(stdout2);
  });
});
