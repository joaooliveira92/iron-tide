import { describe, expect, it } from "vite-plus/test";
import { nextTheme, THEME_SEQUENCE } from "./theme-cycle.js";

describe("nextTheme", () => {
  it("cycles light → dark → system → light", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
    expect(nextTheme("system")).toBe("light");
  });

  it("visits every theme in the sequence exactly once before repeating", () => {
    const visited = new Set<string>();
    let theme = THEME_SEQUENCE[0] ?? "light";

    for (let step = 0; step < THEME_SEQUENCE.length; step += 1) {
      visited.add(theme);
      theme = nextTheme(theme);
    }

    expect(visited.size).toBe(THEME_SEQUENCE.length);
    expect(theme).toBe(THEME_SEQUENCE[0]);
  });
});
