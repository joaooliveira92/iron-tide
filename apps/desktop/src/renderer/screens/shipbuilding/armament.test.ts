import { describe, expect, it } from "vite-plus/test";
import { buildWorkshopView, type DesignDraft } from "@bluewave/ship-design";
import { loadDrawingBoardContent } from "../../components/design-workspace/index.js";
import { batteryCards } from "../../components/design-workspace/batteryView.js";
import { boardFindings } from "../../components/design-workspace/validation/boardFindings.js";
import { createPresentationFormat } from "../../lib/presentation-format/index.js";
import {
  armamentEntries,
  allMounts,
  barrelWord,
  conflictsFor,
  layoutOf,
  mirrorOf,
  oppositeSide,
  positionOf,
} from "./armament.js";

const content = loadDrawingBoardContent();
const ref = content.references[0]!;
const view = buildWorkshopView(ref.draft, content.environmentFor(ref.month, ref.draft.nationId));
const draft: DesignDraft = ref.draft;
const cards = batteryCards(view, draft);
const findings = boardFindings(view, draft, cards);
const format = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

describe("armament view model", () => {
  it("words barrel counts and mount positions", () => {
    expect(barrelWord(1)).toBe("Single");
    expect(barrelWord(2)).toBe("Twin");
    expect(barrelWord(3)).toBe("Triple");
    expect(barrelWord(4)).toBe("Quadruple");
    expect(barrelWord(5)).toBe("5-barrel");
    expect(positionOf("CENTRE", 100)).toBe("Fore");
    expect(positionOf("CENTRE", 900)).toBe("Aft");
    expect(positionOf("PORT", 500)).toBe("Port wing");
    expect(positionOf("STBD", 500)).toBe("Starboard wing");
  });

  it("labels a mount's layout with name, armament and position", () => {
    expect(layoutOf({ name: "A", barrels: 2, caliberUm: 330_200, position: "Fore" }, format)).toBe(
      "A Twin 13.0-inch Fore",
    );
    expect(layoutOf({ name: "P1", barrels: 3, caliberUm: 0, position: "Port wing" }, format)).toBe(
      "P1 3-tube Port wing",
    );
  });

  it("enriches each battery's mounts from the compiled design", () => {
    const entries = armamentEntries("SECONDARY", cards, draft, view, content, format);
    const mounts = entries.flatMap((e) => e.mounts);
    expect(mounts.length).toBeGreaterThan(0);
    for (const m of mounts) {
      expect(m.instanceId).not.toBe("");
      expect(m.zoneId).not.toBe("");
      expect(m.displayName).not.toBe("");
      expect(m.weightKg).toBeGreaterThan(0);
      expect(m.costMicro).toBeGreaterThan(0);
      expect(m.layout).toContain(m.name);
      // Barrels and rounds come from the compiled parameters, never invented.
      const summary = view.compiled.components.find((c) => c.instanceId === m.instanceId)!;
      expect(m.barrels).toBe(summary.params.barrels ?? summary.params.tubes ?? 1);
    }
  });

  it("finds the opposite wing as a mirror and leaves the centreline unpaired", () => {
    const wing = allMounts(armamentEntries("SECONDARY", cards, draft, view, content, format)).find(
      (m) => m.side === "PORT",
    );
    if (wing !== undefined) {
      const entries = armamentEntries("SECONDARY", cards, draft, view, content, format);
      const mirror = mirrorOf(wing, entries);
      if (mirror !== null) {
        expect(oppositeSide(wing.side)).toBe(mirror.side);
      }
    }
    const centre = allMounts(armamentEntries("MAIN", cards, draft, view, content, format)).find(
      (m) => m.side === "CENTRE",
    );
    if (centre !== undefined) {
      expect(
        mirrorOf(centre, armamentEntries("MAIN", cards, draft, view, content, format)),
      ).toBeNull();
    }
  });

  it("reports the findings about one mount", () => {
    const mount = allMounts(armamentEntries("SECONDARY", cards, draft, view, content, format))[0]!;
    for (const f of conflictsFor(mount.instanceId, findings)) {
      expect(
        f.entities.some((e) => e.kind === "fitting" && e.instanceId === mount.instanceId),
      ).toBe(true);
    }
  });
});
