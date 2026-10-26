import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const SRC = join(import.meta.dirname, "..", "src");
const AMBIENT = /\b(Date\.now|new Date|randomUUID)\b/u;

describe("persistence ambient sources", () => {
  it("reads the clock and uuid only inside clock.ts", () => {
    const offenders = readdirSync(SRC)
      .filter((name) => name.endsWith(".ts") && name !== "clock.ts")
      .filter((name) => AMBIENT.test(readFileSync(join(SRC, name), "utf8")));
    expect(offenders).toEqual([]);
  });
});
