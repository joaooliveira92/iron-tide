import { describe, it, expect } from "vite-plus/test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import {
  discoverShipBuildingFiles,
  nodeDirectoryReader,
  type DirectoryReader,
} from "../src/shipBuildingDiscovery.js";

const reversedReader: DirectoryReader = {
  ...nodeDirectoryReader,
  readdir: (path) => [...nodeDirectoryReader.readdir(path)].reverse(),
};

function writeShipBuildingTree(root: string): void {
  const files = [
    "ship-building/reference-designs/germany/extra-b.ts",
    "ship-building/parts/zeta.json",
    "ship-building/naval-profiles/sub/d.json",
    "ship-building/reference-designs/uk/zulu.ts",
    "ship-building/naval-profiles/c.json",
    "ship-building/reference-designs/germany/historical.ts",
    "ship-building/balance.ts",
    "ship-building/reference-designs/france/starters.json",
    "ship-building/parts/alpha.ts",
    "ship-building/reference-designs/uk/historical.ts",
    "ship-building/naval-profiles/a.ts",
    "ship-building/reference-designs/germany/extra-a.json",
    "ship-building/components/equipment.ts",
    "ship-building/components/guns/british-rml.ts",
    "ship-building/reference-designs/uk/starters.ts",
    "ship-building/ship-types.ts",
    "ship-building/naval-profiles/sub/b.ts",
    "ship-building/reference-designs/germany/starters.ts",
  ];
  for (const rel of files) {
    const full = join(root, rel);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, "x", "utf8");
  }
}

const EXPECTED = {
  shipComponentFiles: [
    "ship-building/components/equipment.ts",
    "ship-building/components/guns/british-rml.ts",
  ],
  propulsionPlantFiles: [],
  hullFormFiles: [],
  shipBalanceFiles: ["ship-building/balance.ts"],
  gunFamilyFiles: [],
  gunModelFiles: [],
  gunMountFiles: [],
  ammunitionFiles: [],
  navalProfileFiles: [
    "ship-building/naval-profiles/a.ts",
    "ship-building/naval-profiles/c.json",
    "ship-building/naval-profiles/sub/b.ts",
    "ship-building/naval-profiles/sub/d.json",
  ],
  referenceDesignFiles: [
    "ship-building/reference-designs/uk/starters.ts",
    "ship-building/reference-designs/uk/historical.ts",
    "ship-building/reference-designs/uk/zulu.ts",
    "ship-building/reference-designs/france/starters.json",
    "ship-building/reference-designs/germany/starters.ts",
    "ship-building/reference-designs/germany/historical.ts",
    "ship-building/reference-designs/germany/extra-a.json",
    "ship-building/reference-designs/germany/extra-b.ts",
  ],
  partFiles: ["ship-building/parts/alpha.ts", "ship-building/parts/zeta.json"],
  slotTemplateFiles: [],
  platformFiles: [],
  shipTypeFiles: ["ship-building/ship-types.ts"],
  designLoadoutFiles: [],
};

describe("discoverShipBuildingFiles", () => {
  it("returns host-order-independent groups (INC-1)", () => {
    const dir = mkdtempSync(join(tmpdir(), "bw-ship-building-discovery-"));
    try {
      writeShipBuildingTree(dir);

      const natural = discoverShipBuildingFiles(dir);
      expect(natural).toEqual(EXPECTED);

      const reversed = discoverShipBuildingFiles(dir, reversedReader);
      expect(reversed).toEqual(EXPECTED);
      expect(reversed).toEqual(natural);
    } finally {
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
