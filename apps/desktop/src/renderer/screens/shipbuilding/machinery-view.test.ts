import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView, type WorkshopEnvironment } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { formatPowerBoth } from "../../lib/presentation-format/index.js";
import { machineryModel, plantDeltas } from "./machinery-view.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const view = buildWorkshopView(ref.draft, env);

describe("machinery view model", () => {
  it("mirrors the draft's performance targets and configuration as inputs", () => {
    const model = machineryModel(ref.draft, view, env);
    expect(model.inputs.targetSpeedMilliKnots).toBe(ref.draft.requirement.requiredSpeedMilliKnots);
    expect(model.inputs.cruiseSpeedMilliKnots).toBe(ref.draft.requirement.cruiseSpeedMilliKnots);
    expect(model.inputs.rangeNm).toBe(ref.draft.requirement.requiredRangeNm);
    expect(model.inputs.plantId).toBe(ref.draft.machinery.plantId);
    expect(model.inputs.installedKw).toBe(ref.draft.machinery.installedKw);
    expect(model.inputs.fuelCapacityKg).toBe(ref.draft.machinery.fuelCapacityKg);
    expect(model.inputs.plantOptions.length).toBe(content.plants.length);
  });

  it("shows power in both kW and horsepower (#168 step 6)", () => {
    const model = machineryModel(ref.draft, view, env);
    const kwPerShpBp = env.ctx.balance.machinery.kwPerShpBp;
    const required = view.compiled.machinery!.requiredKwAtMax;
    expect(model.outputs.find((o) => o.id === "required-power")!.value).toBe(
      formatPowerBoth(required, kwPerShpBp),
    );
    expect(model.inputs.installedPowerText).toBe(
      formatPowerBoth(ref.draft.machinery.installedKw, kwPerShpBp),
    );
    expect(model.inputs.installedPowerText).toMatch(/ kW \([\d,]+ hp\)$/);
  });

  it("reports the calculated results from the compiled design", () => {
    const model = machineryModel(ref.draft, view, env);
    const ids = model.outputs.map((o) => o.id);
    for (const id of ["required-power", "max-speed", "machinery-weight", "cost", "reliability"])
      expect(ids).toContain(id);
    const machinery = view.compiled.machinery!;
    expect(model.outputs.find((o) => o.id === "required-power")!.value).toContain(
      machinery.requiredKwAtMax.toLocaleString("en-US"),
    );
    expect(model.outputs.find((o) => o.id === "max-speed")!.value).toBe(
      `${(machinery.maxSpeedMilliKnots / 1000).toFixed(1)} kn`,
    );
  });

  it("keeps no value both an input and an output, and states what is not modelled", () => {
    const model = machineryModel(ref.draft, view, env);
    // Input labels and output labels are disjoint: no pair silently overrides the other.
    const inputLabels = new Set([
      "Target speed",
      "Cruising speed",
      "Range",
      "Installed power",
      "Fuel capacity",
    ]);
    for (const o of model.outputs) expect(inputLabels.has(o.label)).toBe(false);
    expect(model.notes.join(" ")).toMatch(/acceleration/i);
  });

  it("gates plant options by the environment's date and technology", () => {
    const model = machineryModel(
      ref.draft,
      view,
      content.environmentFor("1880-01", ref.draft.nationId),
    );
    for (const p of model.inputs.plantOptions) {
      if (p.disabled) expect(p.reason).not.toBeNull();
    }
  });

  it("converts power with the environment it is given, not one it derives", () => {
    const altered: WorkshopEnvironment = {
      ...env,
      ctx: {
        ...env.ctx,
        balance: {
          ...env.ctx.balance,
          machinery: {
            ...env.ctx.balance.machinery,
            kwPerShpBp: env.ctx.balance.machinery.kwPerShpBp + 1,
          },
        },
      },
    };
    const model = machineryModel(ref.draft, view, altered);
    expect(model.inputs.installedPowerText).toBe(
      formatPowerBoth(ref.draft.machinery.installedKw, altered.ctx.balance.machinery.kwPerShpBp),
    );
  });
});

describe("plant deltas", () => {
  const current = content.plants.find((p) => p.id === ref.draft.machinery.plantId)!;

  it("previews what each alternative plant would change, and nothing for the chosen one", () => {
    const map = plantDeltas(ref.draft, env, view);
    expect(map.size).toBe(content.plants.length);
    expect(map.get(current.id)).toEqual([]);

    const alternative = content.plants.find((p) => p.reliabilityBp !== current.reliabilityBp)!;
    const deltas = map.get(alternative.id)!;
    const reliability = deltas.find((d) => d.id === "reliability");
    expect(reliability).toBeDefined();
    expect(reliability!.direction).toBe(
      alternative.reliabilityBp > current.reliabilityBp ? "up" : "down",
    );
    // Every other plant has a different introduction date, so the required year is previewed too.
    const year = deltas.find((d) => d.id === "year");
    if (alternative.introduction?.fromMonth !== current.introduction?.fromMonth) {
      expect(year).toBeDefined();
      expect(year!.text).toContain(alternative.introduction!.fromMonth);
    }
  });
});
