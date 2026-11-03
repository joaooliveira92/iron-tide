import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";
import { hashWithContext } from "@bluewave/deterministic";
import { presenceFromRulesets } from "@bluewave/content-compiler";
import { compileDraftFromParts } from "@bluewave/ship-design";

import { readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";
import {
  armamentContentHash,
  loadShipBuildingContent,
  loadShipBuildingData,
  shipBuildingContentHash,
} from "./shipBuildingContent.js";

const mainDir = dirname(fileURLToPath(import.meta.url));

describe("ship-building runtime content (ADR-0093 Step 3, ADR-0123)", () => {
  it("loads first-class armament content into the runtime context", () => {
    const content = loadShipBuildingContent();
    expect(content.armament).not.toBeNull();
    const env = content.environmentFor("1880-01", "uk");
    expect(env.ctx.armamentContent).toBe(content.armament);
  });

  it("keeps the legacy content hash and adds a separate deterministic armament hash", () => {
    const legacy = shipBuildingContentHash();
    const armament = armamentContentHash();
    expect(legacy).toMatch(/^[0-9a-f]{64}$/);
    expect(armament).toMatch(/^[0-9a-f]{64}$/);
    expect(armament).not.toBe(legacy);
    expect(shipBuildingContentHash()).toBe(legacy);
    expect(armamentContentHash()).toBe(armament);
  });

  it("derives the recorded identity from the artifact body hash, not raw file bytes", () => {
    const { manifest } = readContentArtifact(resolveGeneratedContentDir());
    expect(shipBuildingContentHash()).toBe(
      hashWithContext(manifest.bodyHash, "ship-building-content"),
    );
    expect(armamentContentHash()).toBe(hashWithContext(manifest.bodyHash, "armament-content"));
  });

  it("round-trips a shipped reference design through the production parts barrier", () => {
    const content = loadShipBuildingContent();
    const parts = content.draftCompileContent;
    expect(parts).toBeDefined();
    expect(content.starterDesigns.length).toBeGreaterThan(0);
    if (parts === undefined) return;
    const design = content.starterDesigns[0]!;
    const result = compileDraftFromParts({
      designId: design.id,
      draft: design.draft,
      month: design.month,
      content: parts,
      ctx: content.environmentFor(design.month, design.draft.nationId).ctx,
      nation: { nationId: design.draft.nationId },
    });
    expect(result.status, design.id).toBe("ACCEPTED");
  });

  it("reads no raw ship-building or reference-design YAML in the main process", () => {
    const sources = readdirSync(mainDir, { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    for (const file of sources) {
      expect(readFileSync(join(mainDir, file), "utf8"), file).not.toMatch(/from "yaml"/);
    }
    for (const file of ["./shipBuildingContent.ts", "./referenceDesigns.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/node:fs/);
      expect(source).not.toMatch(/@bluewave\/content-schema/);
    }
  });
});

describe("S-5 presence ruleset section reaching ship-building content", () => {
  const fixture = {
    colonialServiceDisplacementBp: 137,
    requiredTonsPerPossessionWeight: 100,
    noPortValueWeight: 1,
    crampedOrShortRangeCountBp: 5_000,
    provenance: {
      sourceStatus: "BALANCE_TARGET",
      confidence: "LOW",
      kind: "balance_adjustment",
      sources: [],
    },
  };

  it("is live in production content: the ADR-0266 values reach the colonial fitting", () => {
    expect(loadShipBuildingData().presence).toMatchObject({
      colonialServiceDisplacementBp: 1_500,
      requiredTonsPerPossessionWeight: 150,
      noPortValueWeight: 2,
      crampedOrShortRangeCountBp: 5_000,
    });
    expect(loadShipBuildingContent().environmentFor("1880-01").ctx.colonialFitting).toBeDefined();
  });

  it("reads the one ruleset that carries a section, and nothing when none does", () => {
    expect(presenceFromRulesets([{ id: "core" }])).toBeUndefined();
    expect(presenceFromRulesets([{ id: "core", presence: fixture }])).toEqual({
      colonialServiceDisplacementBp: 137,
      requiredTonsPerPossessionWeight: 100,
      noPortValueWeight: 1,
      crampedOrShortRangeCountBp: 5_000,
    });
    expect(() => presenceFromRulesets([{ id: "core", presence: { provenance: {} } }])).toThrow(
      /presence section is invalid/,
    );
  });
});
