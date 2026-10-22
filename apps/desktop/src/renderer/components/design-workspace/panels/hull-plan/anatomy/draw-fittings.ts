import { extrude, iso, lineOf, roundedPlan } from "./iso.js";
import { clamp, solid } from "./anatomy-helpers.js";
import type { PartDraft } from "./anatomy-types.js";
import type { AnatomyShipScene } from "./anatomy-scene.js";
import { CATEGORY_LABEL } from "./ship-profile.js";

export function drawFittings(scene: AnatomyShipScene): void {
  const {
    draft,
    model,
    L,
    B,
    D,
    halfAt,
    deckZ,
    hasHouse,
    houseT0,
    houseT1,
    lowerTop,
    P,
    facts,
    add,
    text,
    compiled,
    drawn,
  } = scene;
  for (const placement of draft.placements) {
    if (drawn.has(placement.instanceId)) continue;
    const component = compiled.get(placement.instanceId);
    if (component === undefined) continue;
    const t = clamp(placement.stationPermille / 1000, 0.02, 0.98);
    const x = t * L;
    const side = placement.side ?? "CENTRE";
    const y = side === "PORT" ? -halfAt(t) * 0.52 : side === "STBD" ? halfAt(t) * 0.52 : 0;
    const inHouseNow = hasHouse && t >= houseT0 && t <= houseT1;
    const z = inHouseNow ? lowerTop + 0.01 * D : deckZ(t) + 0.005 * D;
    const name = model.targets.get(placement.instanceId)?.name ?? component.componentId;
    const part: PartDraft = {
      id: placement.instanceId,
      label: name,
      solids: [],
      inks: [],
      lines: [],
      dots: [],
    };
    const plan = {
      x: x - 0.016 * L,
      y: y - 0.05 * B,
      w: 0.032 * L,
      d: 0.1 * B,
      r: 0.004 * L,
    };
    part.solids.push(solid(extrude(roundedPlan(plan, 3), z, 0.02 * D, P), "mid", { crease: "lo" }));
    part.lines.push({
      d: lineOf(
        [
          [plan.x + 0.005 * L, plan.y + plan.d * 0.25, z + 0.02 * D],
          [plan.x + plan.w - 0.005 * L, plan.y + plan.d * 0.25, z + 0.02 * D],
        ],
        P,
      ),
      tone: "faint",
    });
    const [px, py] = iso([x, y, z + 0.02 * D], P);
    part.dots.push({ x: px, y: py, r: 0.7, tone: "lo" });
    add(part, text(x, y, z + 0.03 * D, 12));
    facts.set(
      placement.instanceId,
      `${CATEGORY_LABEL[component.category] ?? component.category} · ${Math.round(t * 1000)}‰`,
    );
  }
}
