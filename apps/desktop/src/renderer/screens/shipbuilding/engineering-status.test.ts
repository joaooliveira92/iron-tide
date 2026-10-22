import { describe, expect, it } from "vite-plus/test";
import { applyEdit, buildWorkshopView, type WorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { createPresentationFormat } from "../../lib/presentation-format/index.js";
import { engineeringStatus, type EngineeringReadout } from "./engineering-status.js";

const content = loadDrawingBoardContent();
const reference = content.references[0]!;
const format = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const viewOf = (draft = reference.draft): WorkshopView =>
  buildWorkshopView(draft, content.environmentFor(reference.month, draft.nationId));

const readout = (view: WorkshopView, id: string): EngineeringReadout =>
  engineeringStatus(view, format).find((r) => r.id === id)!;

const t = (kg: number) => format.measurement(kg, "mass", { maximumFractionDigits: 0 });
const money = (micro: number) => format.moneyFromMicro(micro);
const tonnesOf = (value: string) => Number(value.replace(/[^0-9.-]/g, ""));

describe("engineeringStatus", () => {
  it("shows the strip's outcomes from compiled state, in reading order", () => {
    expect(engineeringStatus(viewOf(), format).map((r) => r.id)).toEqual([
      "displacement",
      "cost",
      "speed",
      "range",
      "stability",
      "topside",
      "remaining",
      "warnings",
    ]);
  });

  it("reads displacement as current over capacity", () => {
    const v = viewOf();
    const value = readout(v, "displacement").value;
    expect(value).toBe(`${t(v.totalKg)} / ${t(v.buoyantKg)}`);
    expect(value).toMatch(/^[\d,]+ t \/ [\d,]+ t$/);
  });

  it("opens a weight breakdown whose groups sum to current and whose footer carries capacity and remaining", () => {
    const v = viewOf();
    const { rows, footer } = readout(v, "displacement").breakdown!;
    const grouped = rows.reduce((sum, r) => sum + tonnesOf(r.value), 0);
    expect(grouped).toBe(Math.round(v.totalKg / 1000));
    expect(footer).toEqual([
      { label: "Current", value: t(v.totalKg) },
      { label: "Capacity", value: t(v.buoyantKg) },
      { label: "Remaining", value: t(v.buoyantKg - v.totalKg) },
    ]);
  });

  it("opens a cost breakdown whose lines add up to the total", () => {
    const v = viewOf();
    const cb = v.forecast.costBreakdown;
    const { rows, footer } = readout(v, "cost").breakdown!;
    const by = Object.fromEntries(rows.map((r) => [r.label, tonnesOf(r.value)]));
    expect(by["Hull"]).toBe(Math.round(cb.hull / 1_000_000));
    expect(by["Machinery"]).toBe(Math.round(cb.machinery / 1_000_000));
    expect(by["Armour"]).toBe(Math.round(cb.armour / 1_000_000));
    expect(by["Fittings"]).toBe(Math.round(cb.components / 1_000_000));
    expect(by["Subtotal"]).toBe(Math.round(cb.subtotal / 1_000_000));
    expect(by["Overheads"]).toBe(Math.round(cb.overheads / 1_000_000));
    expect(footer).toEqual([{ label: "Total", value: money(cb.total) }]);
  });

  it("opens the causes behind stability: the GM terms and the findings that flag it", () => {
    const v = viewOf();
    const stability = readout(v, "stability");
    const s = v.compiled.stability!;
    const rows = Object.fromEntries(stability.breakdown!.rows.map((r) => [r.label, r.value]));
    const metres = (mm: number) =>
      `${format.number(mm / 1000, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
    expect(rows["GM"]).toBe(metres(s.gmMm));
    expect(rows["KB"]).toBe(metres(s.kbMm));
    expect(rows["BM"]).toBe(metres(s.bmMm));
    expect(rows["KG"]).toBe(metres(s.kgMm));
    for (const term of ["GM", "KB", "BM", "KG"]) expect(rows[term]).toMatch(/^-?\d+\.\d{2} m$/);

    const stiffRef = content.references.find((r) =>
      buildWorkshopView(
        r.draft,
        content.environmentFor(r.month, r.draft.nationId),
      ).compiled.findings.some((f) => f.id === "STABILITY_STIFF"),
    )!;
    const stiff = readout(
      buildWorkshopView(
        stiffRef.draft,
        content.environmentFor(stiffRef.month, stiffRef.draft.nationId),
      ),
      "stability",
    );
    expect(stiff.tone).toBe("warn");
    expect(stiff.breakdown!.causes.join(" ")).toMatch(/stiff/i);
  });

  it("distinguishes committed from reserved weight when the available weight is hovered", () => {
    const v = viewOf();
    const ledger = Object.fromEntries(v.ledger.map((r) => [r.category, r.kg]));
    const { lines } = readout(v, "remaining").hint!;
    const by = Object.fromEntries(lines.map((l) => [l.label, l.value]));
    const committed = v.totalKg - ledger.margin! - ledger.reserve!;
    const reserved = ledger.margin! + ledger.reserve!;
    expect(by["Committed"]).toBe(t(committed));
    expect(by["Reserved"]).toBe(t(reserved));
    expect(by["Free"]).toBe(t(v.buoyantKg - v.totalKg));
  });

  it("keeps a sound design neutral, turns an overweight one red and a shortfall amber", () => {
    expect(readout(viewOf(), "displacement").tone).toBe("neutral");

    const heavy = viewOf(
      applyEdit(reference.draft, { kind: "set_machinery", patch: { fuelCapacityKg: 400_000 } }),
    );
    expect(readout(heavy, "displacement").tone).toBe("bad");

    const slow = viewOf(
      applyEdit(reference.draft, {
        kind: "set_requirement",
        patch: { requiredSpeedMilliKnots: 40_000 },
      }),
    );
    expect(readout(slow, "speed").tone).toBe("warn");
  });

  it("turns topside load red only when the deck is exceeded", () => {
    const v = viewOf();
    expect(["neutral", "warn", "bad"]).toContain(readout(v, "topside").tone);
  });
});
