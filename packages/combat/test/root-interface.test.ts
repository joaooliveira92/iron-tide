import { describe, expect, it } from "vite-plus/test";
import { advance, generate, resolve } from "@bluewave/combat";
import { resolveBattleAuto } from "@bluewave/combat/battleResolution";
import { generateBattles } from "@bluewave/combat/generation";
import { advanceMinute } from "@bluewave/combat/simulation";

describe("@bluewave/combat root interface", () => {
  it("exposes exactly resolve, advance, and generate at runtime", async () => {
    const root = await import("@bluewave/combat");
    expect(Object.keys(root).sort()).toEqual(["advance", "generate", "resolve"]);
  });

  it("wires each root verb to its subsystem seam", () => {
    expect(resolve).toBe(resolveBattleAuto);
    expect(advance).toBe(advanceMinute);
    expect(generate).toBe(generateBattles);
  });
});
