import { buildWorkshopView } from "@bluewave/ship-design";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { content } from "../test-fixtures.js";
import { planModel } from "../planModel.js";
import { AnatomyShipFigure } from "./AnatomyShipFigure.js";
import { buildAnatomyShip, type AnatomyShip } from "./ship-anatomy.js";

const reference = content.references.find((entry) => entry.id === "majestic_like")!;
const view = buildWorkshopView(reference.draft, content.environmentFor(reference.month));
const model = planModel(reference.draft, content, view, reference.month);
const ship = (azimuth = 135, draft = reference.draft): AnatomyShip =>
  buildAnatomyShip({ draft, view, model, azimuth });

describe("buildAnatomyShip", () => {
  it("detailing: laid planking lanes, a deck rail, a catted anchor and a rudder", () => {
    const plate = ship();
    const deck = plate.parts.find((part) => part.id === "deck")!;
    const hull = plate.parts.find((part) => part.id === "hull")!;
    expect(deck.lines.length).toBeGreaterThan(20);
    expect(deck.dots.length).toBeGreaterThan(10);
    expect(hull.lines.filter((line) => line.heavy).length).toBeGreaterThanOrEqual(2);
    expect(hull.solids.length).toBeGreaterThanOrEqual(4);
  });

  it("draws a part and an anchor for every placed fitting, including funnels", () => {
    const plate = ship();
    for (const placement of reference.draft.placements) {
      expect(plate.anchors.has(placement.instanceId), placement.instanceId).toBe(true);
      expect(
        plate.parts.some((part) => part.id === placement.instanceId),
        placement.instanceId,
      ).toBe(true);
    }
  });

  it("adapts the hull and the plate facts to the current draft", () => {
    const short = ship(135);
    const lengthWl = Number(reference.draft.hull.lengthWl);
    const longerDraft = {
      ...reference.draft,
      hull: {
        ...reference.draft.hull,
        lengthWl: (lengthWl * 1.3) as typeof reference.draft.hull.lengthWl,
      },
    };
    const longerModel = planModel(longerDraft, content, view, reference.month);
    const longer = buildAnatomyShip({
      draft: longerDraft,
      view,
      model: longerModel,
      azimuth: 135,
    });
    expect(longer.facts.get("hull")).not.toBe(short.facts.get("hull"));
    expect(longer.parts[0]!.solids[0]!.paths.fill).not.toBe(short.parts[0]!.solids[0]!.paths.fill);
  });

  it("rotates the plate so a port fitting can be seen", () => {
    const starboard = ship(135);
    const port = ship(225);
    expect(starboard.azimuth).toBe(135);
    expect(port.azimuth).toBe(225);
    expect(port.parts.map((part) => part.solids[0]?.paths.fill).join("")).not.toBe(
      starboard.parts.map((part) => part.solids[0]?.paths.fill).join(""),
    );
  });

  it("rebuilds the armour band and a fitting's position from the draft", () => {
    const gun = reference.draft.placements.find((placement) =>
      placement.componentId.includes("gun"),
    )!;
    const armoured = {
      ...reference.draft,
      armour: {
        ...reference.draft.armour,
        citadelLengthMm: 40_000,
        regions: [
          {
            region: "BELT_MAIN" as const,
            thicknessUm: 200_000,
            lengthMm: 50_000,
            heightMm: 3_000,
            materialId: "steel",
            cosObliquityBp: 10_000,
          },
        ],
      },
    };
    const belt = buildAnatomyShip({
      draft: armoured,
      view,
      model: planModel(armoured, content, view, reference.month),
      azimuth: 135,
    });
    expect(belt.facts.get("armour:belt")).toContain("200 mm");
    expect(belt.parts.some((part) => part.id === "armour:citadel")).toBe(true);

    const moved = {
      ...armoured,
      placements: armoured.placements.map((placement) =>
        placement.instanceId === gun.instanceId
          ? { ...placement, stationPermille: 820 }
          : placement,
      ),
    };
    const at = (draft: typeof armoured) =>
      buildAnatomyShip({
        draft,
        view,
        model: planModel(draft, content, view, reference.month),
        azimuth: 135,
      })
        .parts.find((part) => part.id === gun.instanceId)!
        .solids.map((shape) => shape.paths.fill)
        .join("");
    expect(at(moved)).not.toBe(at(armoured));
  });

  it("names the main battery from the compiled mount data", () => {
    const plate = ship();
    const gun = reference.draft.placements.find((placement) =>
      placement.componentId.includes("gun"),
    )!;
    expect(plate.facts.get(gun.instanceId)).toMatch(/gun|barrel|in/i);
  });

  it("draws the ship type: a torpedo boat has one mast and no boats, a liner four boats", () => {
    const build = (hullFormId: string) => {
      const draft = { ...reference.draft, hull: { ...reference.draft.hull, hullFormId } };
      return buildAnatomyShip({
        draft,
        view,
        model: planModel(draft, content, view, reference.month),
        azimuth: 135,
      });
    };
    const ids = (plate: AnatomyShip) => plate.parts.map((part) => part.id);
    const boat = build("torpedo_boat_form");
    const liner = build("merchant_liner_form");
    expect(ids(boat).filter((id) => id.startsWith("mast:")).length).toBeLessThanOrEqual(1);
    expect(ids(boat).filter((id) => id.startsWith("boat:"))).toHaveLength(0);
    expect(ids(liner).filter((id) => id.startsWith("boat:"))).toHaveLength(4);
    expect(boat.facts.get("ship")).toContain("Torpedo boat");
    expect(liner.facts.get("ship")).toContain("Liner");
  });

  it("changes the rig with the era", () => {
    const rig = (era: "VICTORIAN" | "DREADNOUGHT") =>
      JSON.stringify(
        buildAnatomyShip({
          draft: reference.draft,
          view,
          model: { ...model, look: { ...model.look, era } },
          azimuth: 135,
        }).parts.find((part) => part.id === "mast:fore"),
      );
    expect(rig("VICTORIAN")).not.toBe(rig("DREADNOUGHT"));
  });

  it("puts a port fitting on the port side and a starboard one on the starboard side", () => {
    const gun = reference.draft.placements.find((placement) =>
      placement.componentId.includes("gun"),
    )!;
    const at = (side: "PORT" | "STBD") => {
      const draft = {
        ...reference.draft,
        placements: reference.draft.placements.map((placement) =>
          placement.instanceId === gun.instanceId ? { ...placement, side } : placement,
        ),
      };
      const plate = buildAnatomyShip({
        draft,
        view,
        model: planModel(draft, content, view, reference.month),
        azimuth: 135,
      });
      return plate.anchors.get(gun.instanceId)!.at;
    };
    expect(at("PORT")).not.toEqual(at("STBD"));
  });

  it("shows armour thickness on the belt and the upper belt", () => {
    const region = (name: "BELT_MAIN" | "BELT_UPPER", thicknessUm: number) => ({
      region: name,
      thicknessUm,
      lengthMm: 50_000,
      heightMm: 2_000,
      materialId: "steel",
      cosObliquityBp: 10_000,
    });
    const draft = {
      ...reference.draft,
      armour: {
        ...reference.draft.armour,
        regions: [region("BELT_MAIN", 350_000), region("BELT_UPPER", 120_000)],
      },
    };
    const plate = buildAnatomyShip({
      draft,
      view,
      model: planModel(draft, content, view, reference.month),
      azimuth: 135,
    });
    expect(plate.facts.get("armour:belt")).toContain("350 mm");
    expect(plate.facts.get("armour:belt-upper")).toContain("120 mm");
  });

  it("is deterministic", () => {
    expect(JSON.stringify(ship())).toBe(JSON.stringify(ship()));
  });
});

describe("AnatomyShipFigure", () => {
  it("renders the plate, lights the hovered part and rings its anchor", () => {
    const plate = ship();
    const target = reference.draft.placements.find((placement) =>
      placement.componentId.includes("gun"),
    )!;
    const { container } = render(<AnatomyShipFigure ship={plate} highlight={target.instanceId} />);
    expect(container.querySelector("[data-testid='anatomy-ship']")).not.toBeNull();
    expect(container.querySelector(`[data-part='${target.instanceId}'][data-lit]`)).not.toBeNull();
    expect(container.querySelector("[data-testid='anatomy-highlight']")).not.toBeNull();
  });

  it("rings nothing when the highlight is not on the plate", () => {
    const { container } = render(<AnatomyShipFigure ship={ship()} highlight="not-a-fitting" />);
    expect(container.querySelector("[data-testid='anatomy-highlight']")).toBeNull();
  });
});
