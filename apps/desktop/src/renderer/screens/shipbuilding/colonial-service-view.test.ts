// S-5 04 (spec #73 R4/R12): the designer's colonial-service readout. The proportion below is a FIXTURE-CLASS value.
import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { formatFittingTonnes } from "../../lib/presentation-format/colonial-service.js";
import { colonialServiceModel } from "./colonial-service-view.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const env = content.environmentFor(ref.month, ref.draft.nationId);
const fitted = { ...ref.draft, colonialServiceFitted: true };
// The production pack now authors the section (ADR-0266), so the dormant state is a context without a fitting.
const { colonialFitting: _live, ...dormantCtx } = env.ctx;
const dormant = { ...env, ctx: dormantCtx };
const configured = {
  ...env,
  ctx: { ...env.ctx, colonialFitting: { displacementBp: 100 } },
};

describe("colonialServiceModel", () => {
  it("reports an unfitted design plainly", () => {
    const m = colonialServiceModel(buildWorkshopView(ref.draft, env));
    expect(m).toMatchObject({ fitted: false, status: "unfitted" });
  });

  it("says 'not configured' for a fitting while the ruleset section is dormant, never a number", () => {
    const m = colonialServiceModel(buildWorkshopView(fitted, dormant));
    expect(m.fitted).toBe(true);
    expect(m.status).toBe("not-configured");
    expect(m.text).toContain("not configured");
    expect(m.text).not.toMatch(/\d/);
  });

  it("states the displacement and share the fitting uses once configured", () => {
    const view = buildWorkshopView(fitted, configured);
    const m = colonialServiceModel(view);
    expect(m.status).toBe("configured");
    expect(m.text).toContain("1.00%");
    expect(m.text).toContain(
      `${formatFittingTonnes(view.compiled.colonialService!.displacementKg)} t`,
    );
  });
});
