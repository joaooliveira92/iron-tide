import { describe, expect, it } from "vite-plus/test";
import {
  applyEdit,
  armourMaterialOptions,
  buildWorkshopView,
  type WorkshopView,
} from "@bluewave/ship-design";
import { createPresentationFormat } from "../../lib/presentation-format/profile.js";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { diffViews, type AspectChange } from "../../components/design-workspace/designFeedback.js";
import { protectionModel, schemeEdit } from "./protection-view.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const content = loadDrawingBoardContent();
const starter = content.references.find((r) => r.id === "starter_torpedo_gunboat_1880")!;
const env = content.environmentFor(starter.month, starter.draft.nationId);

describe("armour scheme feedback on the torpedo gunboat starter", () => {
  it("names the requirement a heavier scheme breaks, when its tone is worse", () => {
    const before = buildWorkshopView(starter.draft, env);
    const materials = armourMaterialOptions(
      env.ctx.balance.armour,
      starter.month,
      env.ctx.unlockedTechs,
    );
    const model = protectionModel(
      starter.draft,
      before,
      materials,
      Number(starter.month.slice(0, 4)),
    );
    const edit = schemeEdit(model, "PROTECTED_CRUISER");
    expect(edit).not.toBeNull();
    const after: WorkshopView = buildWorkshopView(applyEdit(starter.draft, edit!), env);
    const protection: AspectChange | undefined = diffViews(before, after, FORMAT).aspects.find(
      (a) => a.aspect === "protection",
    );
    expect(protection?.tone).toBe("worse");
    expect(protection?.text).toContain("breaks Armour below 2 in");
  });
});
