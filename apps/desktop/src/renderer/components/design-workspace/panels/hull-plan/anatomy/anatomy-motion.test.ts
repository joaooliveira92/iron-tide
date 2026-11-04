import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const css = readFileSync(
  join(
    process.cwd(),
    "src/renderer/components/design-workspace/panels/hull-plan/anatomy/anatomy.css",
  ),
  "utf8",
);

const SECTIONS = [
  "overview",
  "hull",
  "machinery",
  "protection",
  "armament",
  "systems",
  "review",
] as const;

const blockAfter = (source: string, opener: string): string => {
  const start = source.indexOf(opener);
  expect(start).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}") depth--;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error("unbalanced braces");
};

const withoutKeyframes = (source: string): string => {
  let rest = source;
  for (;;) {
    const start = rest.indexOf("@keyframes");
    if (start < 0) return rest;
    const open = rest.indexOf("{", start);
    let depth = 0;
    let end = open;
    for (; end < rest.length; end++) {
      if (rest[end] === "{") depth++;
      if (rest[end] === "}") depth--;
      if (depth === 0) break;
    }
    rest = rest.slice(0, start) + rest.slice(end + 1);
  }
};

describe("anatomy motion stylesheet", () => {
  const motion = blockAfter(css, "@media (prefers-reduced-motion: no-preference)");

  it.each(SECTIONS)("animates the %s section inside the no-preference block", (section) => {
    expect(motion).toContain(`.an-ship[data-section="${section}"]`);
  });

  it("applies animations only inside the no-preference block", () => {
    const outside = withoutKeyframes(css.replace(motion, ""));
    expect(outside).not.toMatch(/animation(-name)?\s*:/);
  });

  it("uses no timers or randomness in the stylesheet", () => {
    expect(css).not.toMatch(/random|Math\.|setTimeout/);
  });
});
