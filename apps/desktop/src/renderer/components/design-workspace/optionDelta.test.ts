import { describe, expect, it } from "vite-plus/test";
import { applyEdit, buildWorkshopView } from "@bluewave/ship-design";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { loadDrawingBoardContent } from "./content.js";
import { previewOptionDeltas, viewDeltas } from "./optionDelta.js";

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

describe("viewDeltas", () => {
  it("reports only the engineering values an edit changes, signed and unit-aware", () => {
    const after = buildWorkshopView(
      applyEdit(ref.draft, {
        kind: "set_machinery",
        patch: { installedKw: ref.draft.machinery.installedKw - 500 },
      }),
      env,
    );
    const deltas = viewDeltas(view, after, FORMAT);
    const byId = Object.fromEntries(deltas.map((d) => [d.id, d]));
    expect(byId.displacement).toBeDefined();
    expect(byId.displacement!.direction).toBe("down");
    expect(byId.displacement!.text).toMatch(/^-/);
    expect(byId.displacement!.text).toMatch(/ t$/);
    expect(byId.speed).toBeDefined();
    expect(byId.speed!.direction).toBe("down");
    expect(byId.speed!.text).toMatch(/ kn$/);
  });

  it("is empty when the two views are identical", () => {
    expect(viewDeltas(view, view, FORMAT)).toEqual([]);
  });
});

describe("previewOptionDeltas", () => {
  it("previews an edit without committing it and rejects an invalid one with null", () => {
    const before = ref.draft.machinery.installedKw;
    const deltas = previewOptionDeltas(
      ref.draft,
      env,
      view,
      {
        kind: "set_machinery",
        patch: { installedKw: before - 500 },
      },
      FORMAT,
    );
    expect(deltas).not.toBeNull();
    expect(deltas!.some((d) => d.id === "displacement")).toBe(true);
    expect(ref.draft.machinery.installedKw).toBe(before);

    expect(
      previewOptionDeltas(
        ref.draft,
        env,
        view,
        {
          kind: "remove_placement",
          instanceId: "no-such-instance",
        },
        FORMAT,
      ),
    ).toBeNull();
  });
});
