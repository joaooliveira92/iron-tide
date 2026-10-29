import { readdirSync } from "node:fs";
import { join } from "node:path";
import { FlattenedPartSchema, decodeStrict, type FlattenedPart } from "@bluewave/content-schema";
import { canonicalSerialize } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { compileDesign, compileDraftFromParts, toLegacyCompileView } from "../src/index.js";
import { draftToLoadout, type DraftCompileContent } from "../src/compileDraft.js";
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
import { readAuthoredFile } from "@bluewave/test-support";

const partsDir = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "content",
  "production",
  "1880",
  "ship-building",
  "parts",
);
const productionParts: readonly FlattenedPart[] = readdirSync(partsDir)
  .filter((name) => name.endsWith(".ts"))
  .flatMap((name) => {
    const file = readAuthoredFile(join(partsDir, name)) as { parts: unknown[] };
    return file.parts.map((record) => decodeStrict(FlattenedPartSchema, record));
  });

const content: DraftCompileContent = {
  components,
  plants,
  navalProfiles,
  armament: armamentContent,
  armour: shipBalance.armour,
  compatibility,
  torpedoDiameterUm,
  parts: productionParts,
};

function stripCompiledTorpedo(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCompiledTorpedo);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (key === "compiledTorpedo" || key === "hash") continue;
      out[key] = stripCompiledTorpedo(inner);
    }
    return out;
  }
  return value;
}

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
      expect(canonicalSerialize(stripCompiledTorpedo(result.compiled)), design.id).toBe(
        canonicalSerialize(stripCompiledTorpedo(legacy)),
      );
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
