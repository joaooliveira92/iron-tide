import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildWorkshopView } from "@bluewave/ship-design";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { boardFindings } from "../../../validation/boardFindings.js";
import { planModel } from "../planModel.js";
import { content } from "../test-fixtures.js";
import { AnatomyShipFigure } from "./AnatomyShipFigure.js";
import { anatomyPartStates } from "./part-state.js";
import { buildAnatomyShip } from "./ship-anatomy.js";

const css = readFileSync(
  join(
    process.cwd(),
    "src/renderer/components/design-workspace/panels/hull-plan/anatomy/anatomy-feedback.css",
  ),
  "utf8",
);

const MOTION = "@media (prefers-reduced-motion: no-preference)";
const motionStart = css.indexOf(MOTION);
const motion = css.slice(motionStart);
const staticCss = css.slice(0, motionStart);

describe("anatomy feedback stylesheet", () => {
  it("keeps every animation and keyframe inside one no-preference block", () => {
    expect(motionStart).toBeGreaterThan(0);
    expect(css.indexOf(MOTION, motionStart + 1)).toBe(-1);
    expect(staticCss).not.toMatch(/animation|@keyframes/);
    for (const name of ["an-state-bad", "an-state-lap"])
      expect(motion).toContain(`@keyframes ${name}`);
  });

  it("gives reduced-motion users a static marker for each state", () => {
    for (const state of ["warn", "bad"])
      expect(staticCss).toContain(`.an-part[data-state="${state}"] .an-solid .an-edge`);
    expect(staticCss).toContain('.an-part[data-kind="waterline"][data-state="bad"]');
  });

  it("uses no timers or randomness", () => {
    expect(css).not.toMatch(/random|Math\.|setTimeout/);
  });
});

describe("AnatomyShipFigure part state", () => {
  const reference = content.references.find((entry) => entry.id === "majestic_like")!;
  const view = buildWorkshopView(reference.draft, content.environmentFor(reference.month));
  const model = planModel(reference.draft, content, view, reference.month);
  const ship = buildAnatomyShip({ draft: reference.draft, view, model, azimuth: 135 });

  it("renders no data-state without states, as before", () => {
    expect(renderToStaticMarkup(createElement(AnatomyShipFigure, { ship }))).not.toContain(
      "data-state",
    );
  });

  it("is a pure function of its props", () => {
    const states = anatomyPartStates(ship.parts, boardFindings(view, reference.draft, []), view);
    const render = () => renderToStaticMarkup(createElement(AnatomyShipFigure, { ship, states }));
    expect(render()).toBe(render());
  });

  it("emits the state on each part and carries the waterline", () => {
    const states = anatomyPartStates(ship.parts, boardFindings(view, reference.draft, []), view);
    const markup = renderToStaticMarkup(createElement(AnatomyShipFigure, { ship, states }));
    expect(markup).toContain('data-part="waterline" data-kind="waterline" data-state="');
    expect(markup).toContain('data-part="hull" data-kind="hull" data-state="warn"');
    expect(markup).toContain('data-part="deck" data-kind="deck" data-state="ok"');
  });
});
