import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { ProfileFittingsLayer, ProfileHullLayer, ProfileWaterlineLayer } from "./profile-layers.js";
import { funnelShapes, houseMasses, profileFrame } from "./profile-geometry.js";

const frame = profileFrame(
  { lengthWl: 85_000, beam: 12_000, draught: 4_200, depthToMainDeck: 7_000 } as never,
  13_000,
  "ram",
  "counter",
);
const zone = { startPermille: 520, endPermille: 640 };
const houses = houseMasses(frame, zone)!;
const funnels = funnelShapes(frame, [{ instanceId: "f", stationPermille: 580 }], houses);
const draw = (ui: React.ReactNode) => render(<svg>{ui}</svg>);

describe("ProfileHullLayer", () => {
  it("draws the closed silhouette and a deck-edge line just below it", () => {
    const { container } = draw(<ProfileHullLayer frame={frame} />);
    const hull = container.querySelector("[data-testid='profile-hull']")!;
    expect(hull.tagName.toLowerCase()).toBe("path");
    expect(hull.getAttribute("d")!.endsWith("Z")).toBe(true);
    expect(container.querySelector("[data-testid='profile-deck-edge']")).not.toBeNull();
  });
});

describe("ProfileFittingsLayer", () => {
  it("draws the stepped superstructure when the hull form has a zone", () => {
    const { container } = draw(<ProfileFittingsLayer houses={houses} funnels={[]} />);
    expect(container.querySelector("[data-testid='profile-superstructure']")).not.toBeNull();
    expect(container.querySelector("[data-testid='profile-bridge']")).not.toBeNull();
  });

  it("draws nothing structural without a zone", () => {
    const { container } = draw(<ProfileFittingsLayer houses={undefined} funnels={[]} />);
    expect(container.querySelector("[data-testid='profile-superstructure']")).toBeNull();
    expect(container.querySelector("[data-testid='profile-bridge']")).toBeNull();
  });

  it("draws each funnel as a raked trapezoid with a cap, keyed by instance", () => {
    const { container } = draw(<ProfileFittingsLayer houses={houses} funnels={funnels} />);
    const funnel = container.querySelector("[data-testid='profile-funnel']")!;
    expect(funnel.getAttribute("data-instance")).toBe("f");
    expect(funnel.querySelector("polygon")).not.toBeNull();
    expect(funnel.querySelector("line")).not.toBeNull();
    expect(funnel.querySelector("title")!.textContent).toContain("580‰");
  });
});

describe("ProfileWaterlineLayer", () => {
  it("draws the waterline, its perpendiculars and the centre of buoyancy", () => {
    const { container } = draw(<ProfileWaterlineLayer frame={frame} lcbPermille={520} />);
    const layer = container.querySelector("[data-testid='profile-waterline-layer']")!;
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    const waterline = container.querySelector("[data-testid='profile-waterline']")!;
    expect(Number(waterline.getAttribute("y1"))).toBeCloseTo(frame.waterlineY, 6);
    expect(waterline.getAttribute("x1")).toBe(String(frame.x(0) - 12));
    const lcb = container.querySelector("[data-testid='profile-lcb']")!;
    expect(Number(lcb.querySelector("circle")!.getAttribute("cx"))).toBeCloseTo(frame.x(520), 6);
    const ticks = Array.from(container.querySelectorAll("line")).filter(
      (l) => l.getAttribute("x1") === l.getAttribute("x2"),
    );
    expect(ticks.map((t) => t.getAttribute("x1"))).toEqual(
      expect.arrayContaining([String(frame.x(0)), String(frame.x(1000))]),
    );
  });
});
