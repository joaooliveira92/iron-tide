import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildWorkshopView } from "@bluewave/ship-design";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { planModel } from "../planModel.js";
import { content } from "../test-fixtures.js";
import { AnatomyShipFigure } from "./AnatomyShipFigure.js";
import { buildAnatomyShip } from "./ship-anatomy.js";

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

  describe("hull section ambient motion", () => {
    const HULL_KEYFRAMES = ["an-plating", "an-sheen", "an-glint"] as const;

    it.each(HULL_KEYFRAMES)("defines %s only inside the no-preference block", (name) => {
      const definition = `@keyframes ${name}`;
      expect(motion).toContain(definition);
      expect(css.replace(motion, "")).not.toContain(definition);
    });

    it.each(HULL_KEYFRAMES)("loops %s from a hull-section selector", (name) => {
      const rule = withoutKeyframes(motion)
        .split("}")
        .find((candidate) => candidate.includes(`animation: ${name} `));
      expect(rule, name).toBeDefined();
      expect(rule).toContain('.an-ship[data-section="hull"] .an-part[data-kind="hull"]');
      expect(rule).toContain("infinite");
    });

    it("renders the hull markup the loops select", () => {
      const reference = content.references.find((entry) => entry.id === "majestic_like")!;
      const view = buildWorkshopView(reference.draft, content.environmentFor(reference.month));
      const model = planModel(reference.draft, content, view, reference.month);
      const ship = buildAnatomyShip({ draft: reference.draft, view, model, azimuth: 135 });
      const markup = renderToStaticMarkup(
        createElement(AnatomyShipFigure, { ship, section: "hull" }),
      );
      expect(markup).toContain('data-section="hull"');
      const hull = markup
        .split('<g class="an-part"')
        .find((part) => part.includes('data-kind="hull"'))!;
      expect(hull).toContain('class="an-top"');
      expect(hull.match(/class="an-line"/g)?.length ?? 0).toBeGreaterThan(1);
      expect(hull.match(/class="an-dot"/g)?.length ?? 0).toBeGreaterThan(1);
    });
  });

  describe("machinery section ambient motion", () => {
    const MACHINERY_KEYFRAMES = ["an-mach-cap", "an-mach-heat", "an-mach-drift"] as const;

    it.each(MACHINERY_KEYFRAMES)("defines %s only inside the no-preference block", (name) => {
      const definition = `@keyframes ${name}`;
      expect(motion).toContain(definition);
      expect(css.replace(motion, "")).not.toContain(definition);
    });

    it.each(MACHINERY_KEYFRAMES)("loops %s from a machinery-section selector", (name) => {
      const rule = withoutKeyframes(motion)
        .split("}")
        .find((candidate) => new RegExp(`${name}\\s`).test(candidate));
      expect(rule, name).toBeDefined();
      expect(rule).toContain('.an-ship[data-section="machinery"]');
      expect(rule).toContain("infinite");
    });

    it("renders the machinery markup the loops select", () => {
      const reference = content.references.find((entry) => entry.id === "majestic_like")!;
      const view = buildWorkshopView(reference.draft, content.environmentFor(reference.month));
      const model = planModel(reference.draft, content, view, reference.month);
      const ship = buildAnatomyShip({ draft: reference.draft, view, model, azimuth: 135 });
      const markup = renderToStaticMarkup(
        createElement(AnatomyShipFigure, { ship, section: "machinery" }),
      );
      expect(markup).toContain('data-section="machinery"');
      const funnel = markup
        .split('<g class="an-part"')
        .find((part) => part.includes('data-kind="funnel"'))!;
      expect(funnel).toContain('class="an-ink-fill"');
      expect(funnel).toContain('class="an-top"');
      expect(funnel.match(/class="an-smoke"/g)?.length ?? 0).toBe(3);
      expect(funnel.match(/class="an-line"/g)?.length ?? 0).toBeGreaterThan(1);
    });
  });

  describe("protection section ambient motion", () => {
    const PROTECTION_KEYFRAMES = [
      "an-prot-rivet",
      "an-prot-seam",
      "an-prot-ridge",
      "an-prot-temper",
    ] as const;

    it.each(PROTECTION_KEYFRAMES)("defines %s only inside the no-preference block", (name) => {
      const definition = `@keyframes ${name}`;
      expect(motion).toContain(definition);
      expect(css.replace(motion, "")).not.toContain(definition);
    });

    it.each(PROTECTION_KEYFRAMES)("loops %s from a protection-section selector", (name) => {
      const rule = withoutKeyframes(motion)
        .split("}")
        .find((candidate) => new RegExp(`${name}\\s`).test(candidate));
      expect(rule, name).toBeDefined();
      expect(rule).toContain('.an-ship[data-section="protection"]');
      expect(rule).toContain("infinite");
    });

    it("renders the armour markup the loops select", () => {
      const reference = content.references.find((entry) => entry.id === "majestic_like")!;
      const view = buildWorkshopView(reference.draft, content.environmentFor(reference.month));
      const model = planModel(reference.draft, content, view, reference.month);
      const ship = buildAnatomyShip({ draft: reference.draft, view, model, azimuth: 135 });
      const markup = renderToStaticMarkup(
        createElement(AnatomyShipFigure, { ship, section: "protection" }),
      );
      expect(markup).toContain('data-section="protection"');
      const armour = markup
        .split('<g class="an-part"')
        .filter((part) => part.includes('data-kind="armour"'));
      const belt = armour.find((part) => part.includes('data-part="armour:belt"'))!;
      expect(belt.match(/class="an-dot"/g)?.length ?? 0).toBe(8);
      expect(belt.match(/class="an-line" data-tone="faint"/g)?.length ?? 0).toBeGreaterThan(1);
      expect(belt).toContain("data-heavy");
      const slabs = armour.filter((part) => !part.includes('data-part="armour:belt"'));
      expect(slabs.length).toBeGreaterThan(1);
      for (const slab of slabs) expect(slab).toContain('class="an-top"');
    });
  });
});
