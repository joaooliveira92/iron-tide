import { buildWorkshopView, mm, type DesignDraft } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { boardFindings, type BoardFinding } from "../../../validation/boardFindings.js";
import { planModel } from "../planModel.js";
import { content } from "../test-fixtures.js";
import { anatomyPartStates } from "./part-state.js";
import { buildAnatomyShip } from "./ship-anatomy.js";

const reference = content.references.find((entry) => entry.id === "majestic_like")!;

const compose = (draft: DesignDraft) => {
  const view = buildWorkshopView(draft, content.environmentFor(reference.month));
  const model = planModel(draft, content, view, reference.month);
  const ship = buildAnatomyShip({ draft, view, model, azimuth: 135 });
  const findings = boardFindings(view, draft, []);
  return { view, ship, findings, states: anatomyPartStates(ship.parts, findings, view) };
};

const withHull = (key: "draught" | "lengthWl", factor: number): DesignDraft => ({
  ...reference.draft,
  hull: {
    ...reference.draft.hull,
    [key]: mm(Math.round(Number(reference.draft.hull[key]) * factor)),
  },
});

describe("anatomyPartStates", () => {
  it("states every part and flags only what a finding or metric names", () => {
    const { states, ship, view } = compose(reference.draft);
    expect(states.size).toBe(ship.parts.length);
    expect(view.compiled.findings.some((f) => f.id === "ARC_OBSTRUCTED")).toBe(true);
    expect(states.get("qf6_p1")).toBe("warn");
    expect(states.get("hull")).toBe("warn");
    for (const id of ["slipway", "deck", "mast:fore", "superstructure", "armour:belt"])
      expect(states.get(id), id).toBe("ok");
  });

  it("marks the hull and the waterline bad when the ledger outweighs the buoyancy", () => {
    const { view, states } = compose(withHull("draught", 0.6));
    expect(view.compiled.hull.findings.some((f) => f.id.startsWith("OVERWEIGHT_"))).toBe(true);
    expect(states.get("hull")).toBe("bad");
    expect(states.get("waterline")).toBe("bad");
  });

  it("marks a hull that floats high with a warning", () => {
    const { view, states } = compose(withHull("draught", 1.4));
    expect(view.compiled.hull.findings.some((f) => f.id === "HULL_BUOYANCY_MISMATCH")).toBe(true);
    expect(states.get("hull")).toBe("warn");
  });

  it("marks the deck when the topside capacity is exceeded", () => {
    const { states } = compose(withHull("lengthWl", 0.5));
    expect(states.get("deck")).not.toBe("ok");
  });

  it("marks a fitting named by a finding with the finding's tone", () => {
    const { findings, view, ship } = compose(withHull("draught", 0.6));
    const gun = ship.parts.find((part) => part.kind === "weapon")!;
    const conflict: BoardFinding = {
      ...findings[0]!,
      severity: "WARNING",
      entities: [{ kind: "fitting", instanceId: gun.id }],
    };
    const states = anatomyPartStates(ship.parts, [conflict], view);
    expect(states.get(gun.id)).toBe("warn");
    const worse = anatomyPartStates(
      ship.parts,
      [conflict, { ...conflict, severity: "CRITICAL" }],
      view,
    );
    expect(worse.get(gun.id)).toBe("bad");
    const advisory = anatomyPartStates(ship.parts, [{ ...conflict, severity: "ADVISORY" }], view);
    expect(advisory.get(gun.id)).toBe("ok");
  });

  it("marks the belt when the citadel is left uncovered", () => {
    const base = reference.draft;
    const draft: DesignDraft = {
      ...base,
      armour: {
        ...base.armour,
        citadelLengthMm: 60_000,
        regions: [
          {
            region: "BELT_MAIN",
            thicknessUm: 200_000,
            lengthMm: 10_000,
            heightMm: 3_000,
            materialId: "steel",
            cosObliquityBp: 10_000,
          },
        ],
      },
    };
    const { view, states } = compose(draft);
    expect(view.compiled.armour?.findings.some((f) => f.id === "CITADEL_INCOMPLETE")).toBe(true);
    expect(states.get("armour:belt")).not.toBe("ok");
  });
});
