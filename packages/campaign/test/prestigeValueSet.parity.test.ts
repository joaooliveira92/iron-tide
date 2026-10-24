import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { observePrestige, PRESTIGE_CASES, type ObservedPrestige } from "./prestigeCases.js";

const RECORDED = JSON.parse(
  readFileSync(new URL("./fixtures/prestige.legacy.json", import.meta.url), "utf8"),
) as Record<string, ObservedPrestige>;

describe("prestige value set parity with the recorded legacy decoder", () => {
  it("covers every recorded case", () => {
    expect(Object.keys(RECORDED)).toEqual(PRESTIGE_CASES.map((c) => c.name));
  });

  for (const { name, input } of PRESTIGE_CASES) {
    it(name, () => {
      expect(observePrestige(input)).toEqual(RECORDED[name]);
    });
  }
});
