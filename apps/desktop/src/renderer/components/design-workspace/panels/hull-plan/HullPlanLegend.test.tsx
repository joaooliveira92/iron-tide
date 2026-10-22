import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../../../lib/presentation-format/index.js";
import type { DrawingFacts } from "./describe.js";
import { HullPlanLegend } from "./HullPlanLegend.js";
import { legendEntries } from "./legend.js";

/** The default presentation: en-US, full scale, imperial, Naval Credits. */
const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const facts: DrawingFacts = {
  hullFormId: "protected_cruiser_form",
  lengthM: 100,
  beamM: 14,
  depthM: 8,
  draughtM: 5,
  bow: "ram",
  stern: "counter",
  fittings: 9,
  funnels: 2,
  superstructure: { startPermille: 520, endPermille: 640 },
};
const entries = legendEntries(
  {
    facts,
    waterplaneCoeffBp: 7400,
    lcbPermille: 500,
    sheerBp: 11000,
    funnels: [{ instanceId: "f1", stationPermille: 560 }],
  },
  FORMAT,
);
const draw = () => render(<HullPlanLegend entries={entries} />);

describe("HullPlanLegend", () => {
  it("renders one keyboard-reachable chip per entry, each named by its title and label", () => {
    draw();
    const group = screen.getByRole("group", { name: "Drawing legend" });
    expect(group.querySelectorAll("button")).toHaveLength(entries.length);
    const bow = screen.getByRole("button", { name: /^Ram bow \(Bow: ram\), explain$/ });
    expect(bow.tagName).toBe("BUTTON");
  });

  it("opens a details popover with the source badge, rows and note on activation", async () => {
    draw();
    fireEvent.click(screen.getByRole("button", { name: /^Ram bow / }));
    expect(await screen.findByText(/drawing choice per hull form/i)).toBeTruthy();
    expect(screen.getByText("Drawing convention")).toBeTruthy();
    expect(screen.getByText("Chosen for")).toBeTruthy();
  });

  it("labels a hull-form entry as data", async () => {
    draw();
    fireEvent.click(screen.getByRole("button", { name: /^Hull lines / }));
    expect(await screen.findByText("Hull-form data")).toBeTruthy();
    expect(screen.getByText("Waterplane coefficient")).toBeTruthy();
  });
});
