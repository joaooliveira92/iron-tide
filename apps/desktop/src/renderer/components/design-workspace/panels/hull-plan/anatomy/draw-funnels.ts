import { circle, cylinder, discPath, iso, lineOf, loft } from "./iso.js";
import type { Point3 } from "./iso.js";
import { solid } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";

/** Funnels: tapered, raked, banded, with a dark mouth and a steam pipe. */
export function drawFunnels(scene: AnatomyShipScene): void {
  const { near, L, D, funnelMetrics, P, facts, add, text } = scene;
  for (const funnel of funnelMetrics) {
    const part: PartDraft = {
      id: funnel.instanceId,
      label: "Funnel",
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    const { t, radius, baseZ, topZ, rake } = funnel;
    const x = t * L;
    const topRadius = radius * 0.82;
    part.solids.push(
      solid(cylinder(x, 0, radius * 1.16, baseZ, 0.035 * D, P, 20), "mid"),
      solid(
        loft(
          circle(x + rake, 0, topRadius, 24).map(([px, py]) => [px, py, topZ] as Point3),
          circle(x, 0, radius, 24).map(([px, py]) => [px, py, baseZ] as Point3),
          P,
        ),
        "hi",
        { crease: "lo" },
      ),
    );
    const cap = discPath(x + rake, 0, topRadius * 0.78, topZ + 0.002 * D, P, 24);
    part.inks.push({ d: cap });
    part.lines.push({
      d: lineOf(
        circle(x + rake, 0, topRadius, 24).map(([px, py]) => [px, py, topZ] as Point3),
        P,
        true,
      ),
      tone: "mid",
    });
    for (const share of [0.32, 0.64]) {
      const cx = x + rake * share;
      const r = radius + (topRadius - radius) * share;
      part.lines.push({
        d: lineOf(
          circle(cx, 0, r, 20).map(
            ([px, py]) => [px, py, baseZ + (topZ - baseZ) * share] as Point3,
          ),
          P,
          true,
        ),
        tone: "lo",
      });
    }
    part.lines.push({
      d: lineOf(
        circle(x + rake, 0, topRadius * 1.06, 24).map(
          ([px, py]) => [px, py, topZ - 0.012 * D] as Point3,
        ),
        P,
        true,
      ),
      tone: "hi",
    });
    for (const side of [-1, 1]) {
      part.lines.push({
        d: lineOf(
          [
            [x + rake * 0.7, side * radius * 0.7, baseZ + (topZ - baseZ) * 0.78],
            [x + rake * 0.4 - radius * 1.4, side * radius * 2.4, baseZ],
          ],
          P,
        ),
        tone: "faint",
      });
    }
    const pipeX = x - radius * 0.2;
    const pipeY = near * radius * 1.02;
    part.solids.push(
      solid(cylinder(pipeX, pipeY, radius * 0.12, baseZ, (topZ - baseZ) * 0.84, P, 10), "mid", {
        crease: "none",
      }),
    );
    const [sx, sy] = iso([pipeX, pipeY, baseZ + (topZ - baseZ) * 0.86], P);
    part.dots.push({ x: sx, y: sy, r: 0.8, tone: "mid" });
    const [wx, wy] = iso([x + rake * 0.5, near * radius * 0.9, baseZ + (topZ - baseZ) * 0.72], P);
    part.dots.push({ x: wx, y: wy, r: 1.1, tone: "hi" });
    add(part, text(x, 0, baseZ + (topZ - baseZ) * 0.55, Math.max(14, radius * P.scale * 1.8)));
    facts.set(funnel.instanceId, `Funnel · ${Math.round(t * 1000)}‰ from the bow`);
  }
}
