import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { batteryCards } from "../../components/design-workspace/batteryView.js";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { overviewModel } from "./overview.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month, ref.draft.nationId));
const batteries = batteryCards(view, ref.draft);
const format = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

describe("overview view model", () => {
  const model = overviewModel(ref.draft, view, batteries, ref.month, format);
  const value = (id: string) => model.values.find((v) => v.id === id)?.value ?? "";

  it("summarises the design from compiled state", () => {
    expect(model.values.length).toBeGreaterThanOrEqual(8);
    expect(value("displacement")).toContain(
      format.measurement(view.buoyantKg, "mass", { maximumFractionDigits: 0 }),
    );
    expect(value("cost")).toContain(format.moneyFromMicro(view.forecast.costMicro));
    expect(value("year")).toBe(ref.month.slice(0, 4));
    expect(value("type")).toContain(view.classCode);
    expect(value("accommodation")).not.toBe("");
    if (view.compiled.armour !== null) {
      expect(value("armour")).toContain(format.percent(view.compiled.armour.coverageBp, 0));
    }
  });

  it("shows the same severity counts as the Review validation", () => {
    for (const w of model.warnings) expect(w.count).toBe(view.counts[w.severity]);
    expect(model.warnings.map((w) => w.severity)).toEqual([
      "BLOCKING",
      "CRITICAL",
      "WARNING",
      "ADVISORY",
    ]);
  });

  it("summarises the main battery or says there is none", () => {
    expect(value("armament")).not.toBe("");
  });
});
