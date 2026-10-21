import { buildWorkshopView, type AluminiumBalance, type DesignDraft } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { aluminiumModel } from "./aluminium-view.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const balance: AluminiumBalance = { fromMonth: "1930-01", hullWeightSavingBp: 1_000 };

const modelFor = (draft: DesignDraft, month: string, section: AluminiumBalance | undefined) => {
  const env = content.environmentFor(month, draft.nationId);
  const withSection = {
    ...env,
    ctx: { ...env.ctx, balance: { ...env.ctx.balance, aluminiumSuperstructure: section } },
  };
  return aluminiumModel(buildWorkshopView(draft, withSection), section, month);
};
const asking: DesignDraft = { ...ref.draft, aluminiumSuperstructure: true };

describe("aluminiumModel", () => {
  it("is not offered before the option's date, or without a ruleset section", () => {
    expect(modelFor(ref.draft, "1895-06", balance)).toMatchObject({
      offered: false,
      fitted: false,
    });
    expect(modelFor(ref.draft, "1935-01", undefined)).toMatchObject({ offered: false });
  });
  it("is offered, unfitted, once available, and states the configured saving and the fire risk", () => {
    const m = modelFor(ref.draft, "1935-01", balance);
    expect(m).toMatchObject({ offered: true, fitted: false, status: "unfitted" });
    expect(m.text).toMatch(/10% of the hull weight/);
    expect(m.text).toMatch(/fire damage/);
  });
  it("shows a fitted design's saving", () => {
    expect(modelFor(asking, "1935-01", balance)).toMatchObject({
      offered: true,
      fitted: true,
      status: "fitted",
    });
  });
  it("keeps showing a request the date cannot honour, and says the hull stays steel", () => {
    const m = modelFor(asking, "1895-06", balance);
    expect(m).toMatchObject({ offered: true, fitted: true, status: "unavailable" });
    expect(m.text).toMatch(/steel/);
  });
});
