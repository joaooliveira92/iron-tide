import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { batteryCards } from "../../components/design-workspace/batteryView.js";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { designPriceView } from "../../components/design-workspace/design-price-view.js";
import { TERMS } from "../../components/design-workspace/design-terms.js";
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
  const threats = content.environmentFor(ref.month, ref.draft.nationId).ctx.threats;
  const model = overviewModel(
    ref.draft,
    view,
    batteries,
    ref.month,
    format,
    designPriceView(view.forecast, content.treasuryUnitMicro, null, format),
    threats,
  );
  const value = (id: string) => model.values.find((v) => v.id === id)?.value ?? "";
  const RAW_ID = /[a-z]+_[a-z0-9]+/;

  it("prints no raw content id in any value", () => {
    for (const v of model.values) expect(v.value, v.id).not.toMatch(RAW_ID);
  });

  it("names every production threat so the expected enemy gun is never an id", () => {
    expect(threats.length).toBeGreaterThan(0);
    for (const t of threats) expect(t.name, t.id).toMatch(/\S/);
  });

  it("shows the expected enemy gun by its display name", () => {
    const threat = threats.find((t) => t.id === ref.draft.requirement.designThreatId);
    expect(threat?.name).toBeDefined();
    expect(value("technology")).toContain(threat?.name ?? "");
  });

  it("falls back to a neutral label, never the id, when a threat has no name", () => {
    const unnamed = overviewModel(
      ref.draft,
      view,
      batteries,
      ref.month,
      format,
      designPriceView(view.forecast, content.treasuryUnitMicro, null, format),
      threats.map((t) => ({ id: t.id, penetrationUm: t.penetrationUm })),
    );
    const technology = unnamed.values.find((v) => v.id === "technology")?.value ?? "";
    expect(technology).not.toMatch(RAW_ID);
    expect(technology).toContain("unnamed threat");
  });

  it("uses the shared glossary terms for the rows Brief and Overview both show", () => {
    expect(model.values.find((v) => v.id === "type")?.label).toBe(TERMS.shipType);
    expect(model.values.find((v) => v.id === "role")?.label).toBe(TERMS.naturalClass);
  });

  it("summarises the design from compiled state", () => {
    expect(model.values.length).toBeGreaterThanOrEqual(8);
    expect(value("displacement")).toContain(
      format.measurement(view.buoyantKg, "mass", { maximumFractionDigits: 0 }),
    );
    expect(value("cost")).toContain(format.moneyFromMicro(view.forecast.costMicro));
    expect(value("cost")).toContain("unit");
    expect(value("year")).toBe(ref.month.slice(0, 4));
    expect(value("type")).toContain(ref.draft.requirement.category);
    expect(value("accommodation")).toBe(
      { SPARTAN: "Spartan", STANDARD: "Standard", GENEROUS: "Generous" }[
        ref.draft.requirement.accommodationStandard
      ],
    );
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

  it("uses plain type names with no bare type code in the qualification row", () => {
    expect(value("role")).not.toMatch(/^[A-Z]{1,4}$/);
    expect(value("role")).not.toBe("");
  });

  it("glosses every severity for screen readers", () => {
    const gloss = (s: string) => model.warnings.find((w) => w.severity === s)?.gloss;
    expect(gloss("BLOCKING")).toBe("cannot be built");
    expect(gloss("CRITICAL")).toBe("can be built but will fail in play");
    expect(gloss("WARNING")).toBe("can be built; worth reviewing before submission");
    expect(gloss("ADVISORY")).toBe("does not prevent submission");
  });
});
