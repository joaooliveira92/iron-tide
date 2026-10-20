import {
  buildWorkshopView,
  type AntiAircraftBalance,
  type DesignDraft,
} from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { antiAircraftModel } from "./anti-aircraft-view.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
// Fixture values, not game values.
const balance: AntiAircraftBalance = {
  fromMonth: "1915-01",
  lightGunWeightKg: 100,
  mediumGunWeightKg: 1_000,
  directorWeightKg: 500,
  lightGunFootprintMm2: 10,
  mediumGunFootprintMm2: 100,
  directorFootprintMm2: 1_000,
};

const modelFor = (draft: DesignDraft, month: string, section: AntiAircraftBalance | undefined) => {
  const env = content.environmentFor(month, draft.nationId);
  const withSection = {
    ...env,
    ctx: { ...env.ctx, balance: { ...env.ctx.balance, antiAircraft: section } },
  };
  return antiAircraftModel(draft, buildWorkshopView(draft, withSection), section, month);
};
const asking: DesignDraft = {
  ...ref.draft,
  antiAircraft: { lightGuns: 4, mediumGuns: 2, directors: 1 },
};

describe("antiAircraftModel", () => {
  it("is not offered before the fit's date, or without a ruleset section", () => {
    expect(modelFor(ref.draft, "1895-06", balance).offered).toBe(false);
    expect(modelFor(ref.draft, "1930-01", undefined).offered).toBe(false);
  });
  it("is offered, empty, once available, with the manual's director limit", () => {
    const m = modelFor(ref.draft, "1930-01", balance);
    expect(m).toMatchObject({
      offered: true,
      status: "empty",
      maxDirectors: 4,
      fit: { lightGuns: 0, mediumGuns: 0, directors: 0 },
    });
  });
  it("shows a fitted design's counts and says battle does not read them", () => {
    const m = modelFor(asking, "1930-01", balance);
    expect(m).toMatchObject({ offered: true, status: "fitted" });
    expect(m.fit).toEqual({ lightGuns: 4, mediumGuns: 2, directors: 1 });
    expect(m.text).toMatch(/Battle does not yet read/);
  });
  it("keeps showing a request the date cannot honour, and says it adds nothing", () => {
    const m = modelFor(asking, "1895-06", balance);
    expect(m).toMatchObject({ offered: true, status: "unavailable" });
    expect(m.text).toMatch(/adds no weight/);
  });
});
