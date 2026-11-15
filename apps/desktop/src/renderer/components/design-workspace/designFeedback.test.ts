import { describe, expect, it } from "vite-plus/test";
import {
  applyEdit,
  buildWorkshopView,
  type ArmourRegion,
  type DraftEdit,
  type WorkshopView,
} from "@bluewave/ship-design";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { loadDrawingBoardContent } from "./content.js";
import { diffViews, type AspectChange, type FeedbackAspect } from "./designFeedback.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const view = buildWorkshopView(ref.draft, env);
const viewAfter = (edit: DraftEdit): WorkshopView =>
  buildWorkshopView(applyEdit(ref.draft, edit), env);
const aspectOf = (changes: readonly AspectChange[], aspect: FeedbackAspect) =>
  changes.find((c) => c.aspect === aspect);

const BELT: ArmourRegion = {
  region: "BELT_UPPER",
  thicknessUm: 25_400,
  lengthMm: 20_000,
  heightMm: 1_000,
  materialId: "steel",
  cosObliquityBp: 10_000,
};

interface Row {
  readonly name: string;
  readonly edit: DraftEdit;
  readonly expect: Readonly<Partial<Record<FeedbackAspect, Partial<AspectChange>>>>;
}

const ROWS: readonly Row[] = [
  {
    name: "less engine power",
    edit: {
      kind: "set_machinery",
      patch: { installedKw: ref.draft.machinery.installedKw - 500 },
    },
    expect: {
      speed: { direction: "down", tone: "worse", section: "machinery", metricId: "speed" },
      displacement: { direction: "down", tone: "neutral", section: "hull" },
      cost: { direction: "down", tone: "better" },
    },
  },
  {
    name: "more engine power",
    edit: {
      kind: "set_machinery",
      patch: { installedKw: ref.draft.machinery.installedKw + 100 },
    },
    expect: {
      speed: { direction: "up", tone: "better" },
      displacement: { direction: "up", tone: "neutral" },
      cost: { direction: "up", tone: "worse" },
    },
  },
  {
    name: "power beyond what the plant can deliver",
    edit: {
      kind: "set_machinery",
      patch: { installedKw: ref.draft.machinery.installedKw + 500 },
    },
    expect: {
      speed: { direction: "down", tone: "worse" },
      range: { direction: "down", tone: "worse" },
    },
  },
  {
    name: "a gun removed",
    edit: { kind: "remove_placement", instanceId: "gun_12pdr" },
    expect: {
      firepower: { direction: "down", tone: "worse", section: "armament", parts: ["weapon"] },
      cost: { direction: "down", tone: "better" },
    },
  },
  {
    name: "a belt fitted",
    edit: { kind: "set_armour_region", region: BELT },
    expect: {
      protection: { direction: "up", section: "protection", parts: ["armour"] },
      displacement: { direction: "up", tone: "neutral" },
    },
  },
];

describe("diffViews", () => {
  it("reports nothing and equal hashes for identical views", () => {
    const feedback = diffViews(view, view, FORMAT);
    expect(feedback.aspects).toEqual([]);
    expect(feedback.findings).toEqual([]);
    expect(feedback.hashBefore).toBe(view.compiled.hash);
    expect(feedback.hashAfter).toBe(view.compiled.hash);
  });

  for (const row of ROWS) {
    it(`${row.name}: reports the aspects it moves with the right tone`, () => {
      const after = viewAfter(row.edit);
      const feedback = diffViews(view, after, FORMAT);
      expect(feedback.hashBefore).toBe(view.compiled.hash);
      expect(feedback.hashAfter).toBe(after.compiled.hash);
      for (const [aspect, want] of Object.entries(row.expect)) {
        expect(aspectOf(feedback.aspects, aspect as FeedbackAspect), aspect).toMatchObject(want);
      }
    });
  }

  it("is deterministic and orders aspects by the contract order", () => {
    const after = viewAfter({
      kind: "set_machinery",
      patch: { installedKw: ref.draft.machinery.installedKw + 100 },
    });
    const first = diffViews(view, after, FORMAT);
    expect(diffViews(view, after, FORMAT)).toEqual(first);
    const order = [
      "speed",
      "range",
      "displacement",
      "buoyancy",
      "stability",
      "protection",
      "firepower",
      "cost",
      "build-time",
      "maintenance",
    ];
    const seen = first.aspects.map((a) => order.indexOf(a.aspect));
    expect(seen).toEqual([...seen].sort((x, y) => x - y));
  });

  it("formats units: knots, tonnes and money carry their unit", () => {
    const after = viewAfter({
      kind: "set_machinery",
      patch: { installedKw: ref.draft.machinery.installedKw - 500 },
    });
    const { aspects } = diffViews(view, after, FORMAT);
    expect(aspectOf(aspects, "speed")!.text).toMatch(/^-.* kn$/);
    expect(aspectOf(aspects, "displacement")!.text).toMatch(/^-.* t$/);
    expect(aspectOf(aspects, "cost")!.text).toMatch(/^-/);
  });
});

describe("diffViews tone overrides", () => {
  const speedTone = (v: WorkshopView, tone: "ok" | "warn" | "bad" | "neutral"): WorkshopView => ({
    ...v,
    metrics: v.metrics.map((m) => (m.id === "speed" ? { ...m, tone } : m)),
  });
  const withMachinery = (
    v: WorkshopView,
    patch: { readonly maxSpeedMilliKnots?: number; readonly rangeNmAtCruise?: number },
  ): WorkshopView => ({
    ...v,
    compiled: {
      ...v.compiled,
      machinery: v.compiled.machinery === null ? null : { ...v.compiled.machinery, ...patch },
    },
  });

  it("a speed requirement that starts failing is worse even though speed rose", () => {
    const base = speedTone(view, "warn");
    const after = withMachinery(speedTone(view, "ok"), {
      maxSpeedMilliKnots: view.compiled.machinery!.maxSpeedMilliKnots + 1000,
    });
    const speed = aspectOf(diffViews(after, base, FORMAT).aspects, "speed")!;
    expect(speed.direction).toBe("down");
    expect(speed.tone).toBe("worse");
    const flipped = aspectOf(
      diffViews(
        speedTone(view, "ok"),
        withMachinery(speedTone(view, "warn"), {
          maxSpeedMilliKnots: view.compiled.machinery!.maxSpeedMilliKnots + 1000,
        }),
        FORMAT,
      ).aspects,
      "speed",
    )!;
    expect(flipped.direction).toBe("up");
    expect(flipped.tone).toBe("worse");
  });

  it("a requirement check flipping pass to fail overrides the direction", () => {
    const flip = (met: boolean): WorkshopView => ({
      ...view,
      requirements:
        view.requirements.status === "CLASSIFIED"
          ? {
              status: "CLASSIFIED",
              checks: view.requirements.checks.map((c) =>
                c.field === "speed" ? { ...c, met } : c,
              ),
            }
          : view.requirements,
    });
    const faster = withMachinery(flip(false), {
      maxSpeedMilliKnots: view.compiled.machinery!.maxSpeedMilliKnots + 1000,
    });
    const speed = aspectOf(diffViews(flip(true), faster, FORMAT).aspects, "speed")!;
    expect(speed.direction).toBe("up");
    expect(speed.tone).toBe("worse");
    const recovered = aspectOf(
      diffViews(faster, withMachinery(flip(true), { maxSpeedMilliKnots: 1 }), FORMAT).aspects,
      "speed",
    )!;
    expect(recovered.direction).toBe("down");
    expect(recovered.tone).toBe("better");
  });

  const withStability = (gmDeltaMm: number, tone: "ok" | "bad"): WorkshopView => ({
    ...view,
    compiled: {
      ...view.compiled,
      stability:
        view.compiled.stability === null
          ? null
          : { ...view.compiled.stability, gmMm: view.compiled.stability.gmMm + gmDeltaMm },
    },
    metrics: view.metrics.map((m) => (m.id === "stability" ? { ...m, tone } : m)),
  });

  it("GM moving out of the safe band is worse and moving within it is neutral", () => {
    const out = aspectOf(diffViews(view, withStability(-900, "bad"), FORMAT).aspects, "stability")!;
    expect(out).toMatchObject({ direction: "down", tone: "worse", metricId: "stability" });
    expect(out.text).toMatch(/^-.* m GM$/);
    const back = aspectOf(
      diffViews(withStability(-900, "bad"), view, FORMAT).aspects,
      "stability",
    )!;
    expect(back).toMatchObject({ direction: "up", tone: "better" });
    const within = aspectOf(
      diffViews(view, withStability(300, "ok"), FORMAT).aspects,
      "stability",
    )!;
    expect(within).toMatchObject({ direction: "up", tone: "neutral" });
  });

  const withForecast = (patch: Partial<WorkshopView["forecast"]>): WorkshopView => ({
    ...view,
    forecast: { ...view.forecast, ...patch },
  });

  it("build time, cost and maintenance rising are worse", () => {
    const after = withForecast({
      months: view.forecast.months! + 2,
      costMicro: view.forecast.costMicro + 1_000_000,
      monthlyMaintenanceMicro: view.forecast.monthlyMaintenanceMicro + 1_000_000,
    });
    const { aspects } = diffViews(view, after, FORMAT);
    expect(aspectOf(aspects, "build-time")).toMatchObject({
      direction: "up",
      tone: "worse",
      text: "+2 months",
    });
    expect(aspectOf(aspects, "cost")).toMatchObject({ direction: "up", tone: "worse" });
    expect(aspectOf(aspects, "maintenance")).toMatchObject({ direction: "up", tone: "worse" });
    const back = diffViews(after, view, FORMAT).aspects;
    expect(aspectOf(back, "build-time")).toMatchObject({ tone: "better", text: "-2 months" });
  });

  it("losing the build schedule is worse and gaining one is better", () => {
    const lost = aspectOf(
      diffViews(view, withForecast({ months: null }), FORMAT).aspects,
      "build-time",
    )!;
    expect(lost).toMatchObject({ direction: "flat", tone: "worse" });
    expect(lost.text).toMatch(/no schedule/i);
    const gained = aspectOf(
      diffViews(withForecast({ months: null }), view, FORMAT).aspects,
      "build-time",
    )!;
    expect(gained).toMatchObject({ direction: "flat", tone: "better" });
  });
});

describe("diffViews findings", () => {
  it("lists a resolved finding once even when its id repeats on other targets", () => {
    expect(view.compiled.findings.filter((f) => f.id === "MAGAZINE_UNPROTECTED")).toHaveLength(2);
    const after = viewAfter({ kind: "remove_placement", instanceId: "mag_fwd" });
    const { findings } = diffViews(view, after, FORMAT);
    const resolved = findings.filter(
      (f) => f.id === "MAGAZINE_UNPROTECTED" && f.change === "resolved",
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.severity).toBe("ADVISORY");
    expect(resolved[0]!.message.length).toBeGreaterThan(0);
  });

  it("lists a new finding as new and orders by severity then id", () => {
    const { findings } = diffViews(
      viewAfter({ kind: "remove_placement", instanceId: "mag_fwd" }),
      view,
      FORMAT,
    );
    expect(findings.some((f) => f.id === "MAGAZINE_UNPROTECTED" && f.change === "new")).toBe(true);
    const rank = ["BLOCKING", "CRITICAL", "WARNING", "ADVISORY"];
    const sev = findings.map((f) => rank.indexOf(f.severity));
    expect(sev).toEqual([...sev].sort((x, y) => x - y));
  });
});
