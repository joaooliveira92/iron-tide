import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { loadDrawingBoardContent } from "./content.js";
import { aspectExplanation } from "./aspectExplanation.js";
import { diffViews } from "./designFeedback.js";
import type { FeedbackAspect } from "./designFeedbackTypes.js";
import { feedbackDeltas } from "./feedbackDeltas.js";
import { METRIC_NOTES } from "./metricNotes.js";
import { viewDeltas } from "./optionDelta.js";

const ASPECTS: readonly FeedbackAspect[] = [
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

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

describe("aspectExplanation", () => {
  it("explains every feedback aspect with a non-empty sentence", () => {
    for (const aspect of ASPECTS) {
      expect(aspectExplanation({ aspect }).trim().length, aspect).toBeGreaterThan(20);
    }
  });

  it("reuses the readout note when the aspect names a metric", () => {
    expect(aspectExplanation({ aspect: "buoyancy", metricId: "reserve" })).toBe(
      METRIC_NOTES["reserve"],
    );
    expect(aspectExplanation({ aspect: "speed", metricId: "speed" })).toBe(METRIC_NOTES["speed"]);
  });

  it("gives the five unmetered aspects their own explanation of the underlying value", () => {
    const own = ["protection", "firepower", "cost", "build-time", "maintenance"] as const;
    const texts = new Set(own.map((aspect) => aspectExplanation({ aspect })));
    expect(texts.size).toBe(own.length);
  });
});

describe("feedback deltas carry their explanation", () => {
  const content = loadDrawingBoardContent();
  const ref = content.references[0]!;
  const env = content.environmentFor(ref.month, ref.draft.nationId);
  const before = buildWorkshopView(ref.draft, env);
  const after = buildWorkshopView(
    {
      ...ref.draft,
      machinery: { ...ref.draft.machinery, installedKw: ref.draft.machinery.installedKw - 500 },
    },
    env,
  );

  it("attaches the aspect explanation to each picker preview delta", () => {
    const feedback = diffViews(before, after, FORMAT);
    const deltas = feedbackDeltas(feedback);
    expect(deltas.length).toBeGreaterThan(0);
    for (const delta of deltas) {
      const aspect = feedback.aspects.find((a) => a.aspect === delta.id)!;
      expect(delta.explanation).toBe(aspectExplanation(aspect));
    }
  });

  it("attaches the explanation to the legacy view deltas too", () => {
    const { aspects } = diffViews(before, after, FORMAT);
    const deltas = viewDeltas(before, after, FORMAT);
    expect(deltas.length).toBeGreaterThan(0);
    for (const delta of deltas) {
      expect(delta.explanation).toBe(
        aspectExplanation(aspects.find((a) => a.aspect === delta.id)!),
      );
    }
  });
});
