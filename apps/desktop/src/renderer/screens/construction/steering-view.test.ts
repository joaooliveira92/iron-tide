import { describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { accelerateView, haltView } from "./steering-view.js";
import { accelerationPreview, haltPreview } from "./steering-test-fixtures.js";

const format = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

describe("steering view model", () => {
  it("builds the accelerate tip from the months saved, the premium and the risk", () => {
    const view = accelerateView("Havock class", accelerationPreview(), format);
    expect(view.tip).toBe(
      `Saves 3 months for a premium of ${format.money(1_200)}. Delay risk: ${format.percent(1_500, 1)} a month for each accelerated ship.`,
    );
    expect(view.title).toBe("Accelerate Havock class?");
    expect(view.rows.map((row) => row.label)).toEqual([
      "Months left now",
      "Months left accelerated",
      "Months saved",
      "Premium",
      "Delay risk",
    ]);
  });

  it("uses the singular month and names the absent risk", () => {
    const view = accelerateView(
      "Havock class",
      accelerationPreview({ monthsSaved: 1, delayRisk: "NONE", delayChanceBp: 0 }),
      format,
    );
    expect(view.tip).toContain("Saves 1 month for");
    expect(view.tip).toContain("Delay risk: None at the current load.");
  });

  it("says plainly when the treasury leaves no saving, and never prints a negative month count", () => {
    const view = accelerateView(
      "Havock class",
      accelerationPreview({
        monthsNow: 10,
        monthsAccelerated: 11,
        monthsSaved: -1,
        fundsLimited: true,
      }),
      format,
    );
    expect(view.tip).toContain("Would not finish sooner: 11 months against 10 months now.");
    expect(view.rows.find((row) => row.label === "Months saved")?.value).toBe(
      "None; it would not finish sooner",
    );
    expect(view.notes).toHaveLength(2);
    expect(view.tip).not.toContain("-1");
  });

  it("flags a funds-limited saving in the tip and as a note", () => {
    const view = accelerateView(
      "Havock class",
      accelerationPreview({ fundsLimited: true }),
      format,
    );
    expect(view.tip).toContain("best case");
    expect(view.notes).toHaveLength(1);
  });

  it("carries each accelerate figure's own explanation tree", () => {
    const preview = accelerationPreview();
    const view = accelerateView("Havock class", preview, format);
    const trees = view.rows.flatMap((row) => (row.explanation ? [row.explanation.tree] : []));
    expect(trees).toEqual([
      preview.monthsExplanation,
      preview.premiumExplanation,
      preview.delayExplanation,
    ]);
  });

  it("builds the halt tip from the carrying cost and the resume outcome", () => {
    const view = haltView("Havock class", haltPreview(), format);
    expect(view.tip).toBe(
      `Stops work. Carrying cost ${format.money(80)} a month. On resume: Building again at once.`,
    );
    expect(view.notes).toEqual([]);
  });

  it("says a halted ship waits for capacity and that acceleration ends", () => {
    const preview = haltPreview({ resumeStatus: "AWAITING_CAPACITY", losesAcceleration: true });
    const view = haltView("Havock class", preview, format);
    expect(view.tip).toContain("On resume: Waits for yard capacity.");
    expect(view.notes).toHaveLength(1);
    expect(view.rows[0]?.explanation?.tree).toBe(preview.carryingExplanation);
  });
});
