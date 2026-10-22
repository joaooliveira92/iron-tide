import { describe, it, expect, vi } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const fsControl = vi.hoisted(() => ({ reverseDirectoryReads: false }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const realReaddir = actual.readdirSync as (path: string) => string[];
  return {
    ...actual,
    readdirSync: (path: string): string[] => {
      const entries = realReaddir(path);
      return fsControl.reverseDirectoryReads ? [...entries].reverse() : entries;
    },
  };
});

import { discoverShipBuildingFiles } from "../src/shipBuildingDiscovery.js";

function writeShipBuildingTree(root: string): void {
  const files = [
    "ship-building/reference-designs/germany/extra-b.yaml",
    "ship-building/parts/zeta.yaml",
    "ship-building/naval-profiles/sub/d.yaml",
    "ship-building/reference-designs/uk/zulu.yaml",
    "ship-building/naval-profiles/c.yaml",
    "ship-building/reference-designs/germany/historical.yaml",
    "ship-building/balance.yaml",
    "ship-building/reference-designs/france/starters.yaml",
    "ship-building/parts/alpha.yaml",
    "ship-building/reference-designs/uk/historical.yaml",
    "ship-building/naval-profiles/a.yaml",
    "ship-building/reference-designs/germany/extra-a.yaml",
    "ship-building/components.yaml",
    "ship-building/reference-designs/uk/starters.yaml",
    "ship-building/ship-types.yaml",
    "ship-building/naval-profiles/sub/b.yaml",
    "ship-building/reference-designs/germany/starters.yaml",
  ];
  for (const rel of files) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, "x", "utf8");
  }
}

const EXPECTED = {
  shipComponentFiles: ["ship-building/components.yaml"],
  propulsionPlantFiles: [],
  hullFormFiles: [],
  shipBalanceFiles: ["ship-building/balance.yaml"],
  gunFamilyFiles: [],
  gunModelFiles: [],
  gunMountFiles: [],
  ammunitionFiles: [],
  navalProfileFiles: [
    "ship-building/naval-profiles/a.yaml",
    "ship-building/naval-profiles/c.yaml",
    "ship-building/naval-profiles/sub/b.yaml",
    "ship-building/naval-profiles/sub/d.yaml",
  ],
  referenceDesignFiles: [
    "ship-building/reference-designs/uk/starters.yaml",
    "ship-building/reference-designs/uk/historical.yaml",
    "ship-building/reference-designs/uk/zulu.yaml",
    "ship-building/reference-designs/france/starters.yaml",
    "ship-building/reference-designs/germany/starters.yaml",
    "ship-building/reference-designs/germany/historical.yaml",
    "ship-building/reference-designs/germany/extra-a.yaml",
    "ship-building/reference-designs/germany/extra-b.yaml",
  ],
  partFiles: ["ship-building/parts/alpha.yaml", "ship-building/parts/zeta.yaml"],
  slotTemplateFiles: [],
  platformFiles: [],
  shipTypeFiles: ["ship-building/ship-types.yaml"],
  designLoadoutFiles: [],
};

describe("discoverShipBuildingFiles", () => {
  it("returns host-order-independent groups (INC-1)", () => {
    const dir = mkdtempSync(join(tmpdir(), "bw-ship-building-discovery-"));
    try {
      writeShipBuildingTree(dir);

      fsControl.reverseDirectoryReads = false;
      const natural = discoverShipBuildingFiles(dir);
      expect(natural).toEqual(EXPECTED);

      fsControl.reverseDirectoryReads = true;
      const reversed = discoverShipBuildingFiles(dir);
      expect(reversed).toEqual(EXPECTED);
      expect(reversed).toEqual(natural);
    } finally {
      fsControl.reverseDirectoryReads = false;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("yields empty groups when no ship-building tree exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "bw-ship-building-absent-"));
    try {
      expect(discoverShipBuildingFiles(dir)).toEqual({
        shipComponentFiles: [],
        propulsionPlantFiles: [],
        hullFormFiles: [],
        shipBalanceFiles: [],
        gunFamilyFiles: [],
        gunModelFiles: [],
        gunMountFiles: [],
        ammunitionFiles: [],
        navalProfileFiles: [],
        referenceDesignFiles: [],
        partFiles: [],
        slotTemplateFiles: [],
        platformFiles: [],
        shipTypeFiles: [],
        designLoadoutFiles: [],
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
