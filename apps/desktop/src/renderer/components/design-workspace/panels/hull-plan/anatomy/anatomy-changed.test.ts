import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildWorkshopView } from "@bluewave/ship-design";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { AspectChange, DesignFeedback } from "../../../designFeedback.js";
import { planModel } from "../planModel.js";
import { content } from "../test-fixtures.js";
import { AnatomyShipFigure } from "./AnatomyShipFigure.js";
import { changedKinds } from "./changed-parts.js";
import { buildAnatomyShip } from "./ship-anatomy.js";

const css = readFileSync(
  join(
    process.cwd(),
    "src/renderer/components/design-workspace/panels/hull-plan/anatomy/anatomy-changed.css",
  ),
  "utf8",
);

const MOTION = "@media (prefers-reduced-motion: no-preference)";
const motionStart = css.indexOf(MOTION);
const staticCss = css.slice(0, motionStart);
const motion = css.slice(motionStart);

const change = (parts: AspectChange["parts"]): AspectChange => ({
  aspect: "protection",
  label: "Protection",
  text: "",
  direction: "up",
  tone: "better",
  parts,
  section: "protection",
});

const feedback = (aspects: readonly AspectChange[]): DesignFeedback => ({
  aspects,
  findings: [],
  hashBefore: "a",
  hashAfter: "b",
});

describe("changedKinds", () => {
  it("is empty without feedback", () => {
    expect(changedKinds(null).size).toBe(0);
  });

  it("unions the parts of every aspect change", () => {
    const kinds = changedKinds(
      feedback([change(["armour"]), change(["hull", "deck"]), change([])]),
    );
    expect([...kinds].sort()).toEqual(["armour", "deck", "hull"]);
  });
});

describe("anatomy changed stylesheet", () => {
  it("keeps every animation inside one no-preference block", () => {
    expect(motionStart).toBeGreaterThan(0);
    expect(css.indexOf(MOTION, motionStart + 1)).toBe(-1);
    expect(staticCss).not.toMatch(/animation|@keyframes/);
    expect(motion).toContain("@keyframes an-changed-0");
    expect(motion).toContain("@keyframes an-changed-1");
  });

  it("marks changed parts statically and runs the flash once", () => {
    expect(staticCss).toContain(".an-part[data-changed]");
    expect(motion).toMatch(/animation:[^;]*an-changed-0[^;]*1;/);
    expect(motion).toMatch(/animation:[^;]*an-changed-1[^;]*1;/);
    expect(css).not.toMatch(/infinite|random|Math\.|setTimeout/);
  });
});

describe("AnatomyShipFigure changed parts", () => {
  const reference = content.references.find((entry) => entry.id === "majestic_like")!;
  const view = buildWorkshopView(reference.draft, content.environmentFor(reference.month));
  const model = planModel(reference.draft, content, view, reference.month);
  const ship = buildAnatomyShip({ draft: reference.draft, view, model, azimuth: 135 });
  const kinds = new Set(["armour" as const]);
  const render = (props: object) =>
    renderToStaticMarkup(createElement(AnatomyShipFigure, { ship, ...props }));

  it("renders no data-changed by default", () => {
    expect(render({})).not.toContain("data-changed");
  });

  it("flags only parts of the named kinds, carrying the phase", () => {
    const markup = render({ changed: { kinds, phase: 1 } });
    const flagged = [...markup.matchAll(/data-kind="([a-z]+)" [^>]*data-changed="1"/g)].map(
      (m) => m[1],
    );
    expect(flagged.length).toBeGreaterThan(0);
    expect(new Set(flagged)).toEqual(new Set(["armour"]));
  });

  it("marks a previewed part with the static value, which no keyframe animates", () => {
    const markup = render({ changed: { kinds, phase: "preview" } });
    expect(markup).toMatch(/data-kind="armour" [^>]*data-changed="preview"/);
    expect(css).not.toMatch(/data-changed="preview"/);
    expect(motion).not.toMatch(/data-changed\]\s*\{[^}]*animation/);
  });

  it("is a pure function of its props", () => {
    expect(render({ changed: { kinds, phase: 0 } })).toBe(render({ changed: { kinds, phase: 0 } }));
  });
});
