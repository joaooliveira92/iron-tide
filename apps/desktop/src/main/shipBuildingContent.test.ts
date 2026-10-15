import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vite-plus/test";
import { hashWithContext } from "@bluewave/deterministic";
import { compileDraftFromParts } from "@bluewave/ship-design";

import { readContentArtifact } from "./contentArtifact.js";
import { resolveGeneratedContentDir } from "./contentPack.js";
import {
  armamentContentHash,
  loadShipBuildingContent,
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
    // Deterministic across repeated calls in the same process.
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
    // The wiring under test is the production one: the `partModel`-derived compatibility slots and a
    // `torpedoDiameterUm` that reads the compiled torpedo parts, both built by `buildShipBuildingContent`.
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
    // No main-process module imports the raw `yaml` parser at runtime.
    const sources = readdirSync(mainDir, { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
    for (const file of sources) {
      expect(readFileSync(join(mainDir, file), "utf8"), file).not.toMatch(/from "yaml"/);
    }
    // The content loaders read neither the filesystem nor the schema package.
    for (const file of ["./shipBuildingContent.ts", "./referenceDesigns.ts"]) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      expect(source).not.toMatch(/node:fs/);
      expect(source).not.toMatch(/@bluewave\/content-schema/);
    }
  });
});
