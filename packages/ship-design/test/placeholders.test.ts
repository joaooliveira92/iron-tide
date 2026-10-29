import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const CEILING: Record<string, number> = {
  "balance.ts": 5,
  components: 49,
  "plants.ts": 1,
  "hull-forms.ts": 0,
  "reference-designs": 0,
};
const dir = join(process.cwd(), "..", "..", "content", "production", "1880", "ship-building");
const countFile = (path: string) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => /PLACEHOLDER|status: "placeholder"/u.test(line)).length;
const count = (rel: string): number => {
  const path = join(dir, rel);
  if (!statSync(path).isDirectory()) return countFile(path);
  return readdirSync(path).reduce((n, entry) => {
    const child = join(path, entry);
    if (statSync(child).isDirectory()) return n + count(join(rel, entry));
    return entry.endsWith(".ts") ? n + countFile(child) : n;
  }, 0);
};

describe("unsourced content values (PLACEHOLDER ratchet)", () => {
  for (const [file, ceiling] of Object.entries(CEILING)) {
    it(`${file} has no more than ${String(ceiling)} placeholder markers`, () => {
      expect(count(file)).toBeLessThanOrEqual(ceiling);
    });
  }
  it("the ceilings are tight: a removed placeholder lowers its ceiling", () => {
    for (const [file, ceiling] of Object.entries(CEILING)) expect(count(file)).toBe(ceiling);
  });
  it("the revision constants are decided design values, not placeholders", () => {
    const text = readFileSync(join(dir, "balance.ts"), "utf8");
    const block = text.slice(
      text.indexOf(`
{
  "revision": null
}
`),
    );
    expect(block).not.toContain("PLACEHOLDER");
  });
});
