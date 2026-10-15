import { describe, expect, it } from "vite-plus/test";
import type { DrawingFacts } from "./describe.js";
import { planLabel, profileLabel } from "./describe.js";
import { legendEntries } from "./legend.js";

const facts = (over: Partial<DrawingFacts> = {}): DrawingFacts => ({
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
  ...over,
});
const base = (f: DrawingFacts) => ({
  facts: f,
  waterplaneCoeffBp: 7400,
  lcbPermille: 500,
  sheerBp: 11000,
  funnels: [
    { instanceId: "f2", stationPermille: 580 },
    { instanceId: "f1", stationPermille: 560 },
  ],
});

describe("legendEntries", () => {
  it("separates data from drawing convention", () => {
    const byId = Object.fromEntries(legendEntries(base(facts())).map((e) => [e.id, e]));
    expect(byId["hull-lines"]!.source).toBe("data");
    expect(byId["bow"]!.source).toBe("convention");
    expect(byId["stern"]!.source).toBe("convention");
    expect(byId["sheer"]!.source).toBe("mixed");
  });

  it("lists funnels by real station in stable order, with metres from the bow", () => {
    const funnels = legendEntries(base(facts())).find((e) => e.id === "funnels")!;
    expect(funnels.label).toBe("Funnels: 2");
    expect(funnels.rows.map((r) => r[0])).toEqual(["f1", "f2"]);
    expect(funnels.rows[0]![1]).toContain("56.0 m");
  });

  it("says plainly when there are no funnels or no superstructure zone", () => {
    const none = legendEntries({
      ...base(facts({ funnels: 0, superstructure: undefined })),
      funnels: [],
    });
    expect(none.find((e) => e.id === "funnels")!.rows).toEqual([]);
    expect(none.find((e) => e.id === "funnels")!.note).toMatch(/none is drawn/);
    expect(none.find((e) => e.id === "superstructure")!.label).toBe("Superstructure: none");
  });

  it("omits hull-form entries when the form is unknown", () => {
    const entries = legendEntries({
      facts: facts({ hullFormId: undefined }),
      waterplaneCoeffBp: undefined,
      lcbPermille: undefined,
      sheerBp: undefined,
      funnels: [],
    });
    expect(entries.map((e) => e.id)).toEqual(["bow", "stern", "funnels", "superstructure"]);
  });
});

describe("accessible names", () => {
  it("are distinct, start with their view, and describe the generated content", () => {
    const plan = planLabel(facts());
    const profile = profileLabel(facts());
    expect(plan).not.toBe(profile);
    expect(plan.startsWith("Top-down plan")).toBe(true);
    expect(profile.startsWith("Side profile")).toBe(true);
    for (const label of [plan, profile]) {
      expect(label).toMatch(/protected cruiser form/);
      expect(label).toMatch(/ram bow/);
      expect(label).toMatch(/2 funnels/);
      expect(label).toMatch(/superstructure from 52% to 64%/);
      expect(label).toMatch(/schematic/);
    }
  });
  it("handles zero and one funnel and a missing zone", () => {
    expect(planLabel(facts({ funnels: 0 }))).toMatch(/no funnels/);
    expect(profileLabel(facts({ funnels: 1, superstructure: undefined }))).toMatch(
      /1 funnel, no superstructure zone/,
    );
  });

  it("explains masts as a drawing convention in the design's style and era", () => {
    const masts = legendEntries({
      ...base(facts()),
      masts: { count: 2, style: "B", era: "VICTORIAN", partId: "x-victorian-mast", step: 2 },
    }).find((e) => e.id === "masts")!;
    expect(masts.source).toBe("convention");
    expect(masts.label).toBe("Masts: 2");
    expect(masts.rows).toEqual([
      ["Style", "B (British)"],
      ["Era", "Victorian (to 1895)"],
      ["Drawing", "x-victorian-mast (universal)"],
    ]);
    expect(masts.note).toMatch(/bridge.*aft end of the superstructure/);
  });

  it("omits the masts chip when none is drawn", () => {
    expect(legendEntries(base(facts())).some((e) => e.id === "masts")).toBe(false);
  });
});
