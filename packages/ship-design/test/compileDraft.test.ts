// The production forward adapter and compile entry point (ship-part-model ticket 17a). A player
// design is carried as a `DesignDraft`; `draftToLoadout` turns it into the parts representation and
// `compileDraftFromParts` compiles it through the same barrier as the reference designs. The
// round-trip proof: the same draft compiles byte-identically through the barrier and through the
// legacy `compileDesign`.

import { canonicalSerialize } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  compileDesign,
  compileDraftFromParts,
  draftToLoadout,
  toLegacyCompileView,
  type DraftCompileContent,
} from "../src/index.js";
import {
  armamentContent,
  components,
  navalProfiles,
  nationalContext,
  plants,
  shipBalance,
} from "./helpers/earlyContext.js";
import { compatibility, designs, present } from "./helpers/gunReadPath.js";
import { torpedoDiameterUm } from "./helpers/torpedoModels.js";

const content: DraftCompileContent = {
  components,
  plants,
  navalProfiles,
  armament: armamentContent,
  armour: shipBalance.armour,
  compatibility,
  torpedoDiameterUm,
};

describe("draft → loadout → parts barrier (ticket 17a)", () => {
  it("compiles every reference draft identically through the forward adapter and the legacy path", () => {
    for (const design of designs) {
      const result = compileDraftFromParts({
        designId: design.id,
        draft: design.draft,
        month: design.month,
        content,
        ctx: nationalContext(design.month, design.draft.nationId),
        nation: { nationId: design.draft.nationId },
      });
      expect(result.status, design.id).toBe("ACCEPTED");
      if (result.status !== "ACCEPTED") continue;
      const legacy = compileDesign(
        design.draft,
        nationalContext(design.month, design.draft.nationId),
      );
      expect(canonicalSerialize(result.compiled), design.id).toBe(canonicalSerialize(legacy));
    }
  });

  it("translates a draft to a loadout that rebuilds its header and references its parts", () => {
    const design = present(designs[0], "a design");
    const forward = draftToLoadout({
      designId: design.id,
      draft: design.draft,
      month: design.month,
      content,
    });
    expect(forward.untranslated).toEqual([]);
    expect(forward.loadout.platform).toBe(design.draft.hull.hullFormId);
    expect(forward.loadout.entries.length).toBeGreaterThan(0);
    expect(forward.header.nation).toBe(design.draft.nationId);
    expect(forward.parts.length).toBeGreaterThan(0);
  });

  it("gates a part's technology by the context, so the barrier is never looser than the legacy path", () => {
    const design = present(
      designs.find((d) => d.month === "1880-01"),
      "an 1880-01 design",
    );
    const draft = {
      ...design.draft,
      machinery: { ...design.draft.machinery, plantId: "triple_expansion_watertube" },
    };
    const ctx = nationalContext(design.month, design.draft.nationId);
    const result = compileDraftFromParts({
      designId: design.id,
      draft,
      month: design.month,
      content,
      ctx,
      nation: { nationId: design.draft.nationId },
    });
    expect(result.status).toBe("REJECTED");
    if (result.status === "ACCEPTED") return;
    expect(result.findings.map((f) => f.id)).toContain("FIT_TECHNOLOGY_LOCKED");
    // The legacy compile rejects the same draft through the same technology ids, so the barrier is
    // at least as strict on this axis.
    const legacy = compileDesign(draft, ctx);
    expect(legacy.valid).toBe(false);
    expect(legacy.findings.map((f) => f.id)).toContain("TECH_UNAVAILABLE");
  });

  it("refuses a placement the forward adapter cannot translate, never passing it silently", () => {
    const design = present(designs[0], "a design");
    const draft = {
      ...design.draft,
      placements: [
        ...design.draft.placements,
        {
          instanceId: "ghost",
          componentId: "no_such_component",
          zoneId: "FORECASTLE" as const,
          stationPermille: 10,
        },
      ],
    };
    const result = compileDraftFromParts({
      designId: design.id,
      draft,
      month: design.month,
      content,
      ctx: nationalContext(design.month, design.draft.nationId),
      nation: { nationId: design.draft.nationId },
    });
    expect(result.status).toBe("UNTRANSLATED");
    if (result.status !== "UNTRANSLATED") return;
    expect(result.issues.length).toBeGreaterThan(0);
    expect(toLegacyCompileView(result).valid).toBe(false);
  });
});
