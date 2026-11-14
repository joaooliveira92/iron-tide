import type { WorkshopView } from "@bluewave/ship-design";
import { clamp, ribbon } from "./anatomy-helpers.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";
import type { PartDraft } from "./anatomy-types.js";
import { iso, lineOf } from "./iso.js";

export function floatRatio(view: WorkshopView): number | null {
  const flagged = view.compiled.hull.findings.some(
    (finding) => finding.id.startsWith("OVERWEIGHT_") || finding.id === "HULL_BUOYANCY_MISMATCH",
  );
  if (!flagged || view.buoyantKg <= 0 || view.totalKg <= 0) return null;
  return clamp(view.totalKg / view.buoyantKg, 0.5, 1.6);
}

export function drawWaterline(scene: AnatomyShipScene, view: WorkshopView): void {
  const { near, T, D, deckZ, halfAtZ, sidePoints, P, add, facts } = scene;
  const at = (z: number) =>
    sidePoints(
      0.02,
      0.98,
      () => z,
      (t) => near * halfAtZ(t, z),
    );
  const part: PartDraft = {
    id: "waterline",
    label: "Waterline",
    solids: [],
    inks: [],
    lines: [{ d: lineOf(at(T), P), tone: "hi", heavy: true }],
    dots: [],
  };
  const ratio = floatRatio(view);
  const floating = ratio === null ? T : clamp(T * ratio, 0.3 * T, deckZ(0.5) - 0.03 * D);
  if (Math.abs(floating - T) > 0.004 * D) {
    part.solids.push({
      paths: ribbon(
        at(T).map(([x, y, z]) => iso([x, y, z], P)),
        at(floating).map(([x, y, z]) => iso([x, y, z], P)),
      ),
      tone: "lo",
      crease: "none",
      fill: "plate",
      flat: true,
    });
    part.lines.push({ d: lineOf(at(floating), P), tone: "mid", dotted: true, heavy: true });
  }
  facts.set(
    "waterline",
    floating > T
      ? "Waterline: the ship floats lower than its design draught"
      : floating < T
        ? "Waterline: the ship floats higher than its design draught"
        : "Waterline at the design draught",
  );
  add(part);
}
