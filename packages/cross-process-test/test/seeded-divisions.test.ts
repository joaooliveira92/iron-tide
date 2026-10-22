import { describe, expect, it } from "vite-plus/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertDivisionInvariants,
  type CanonicalShipType,
  type CompiledDesignVersion,
  type DivisionAssetView,
  type FleetState,
  isShipOperational,
  type PermanentDivision,
  VACANT,
} from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import { classifyShip } from "@bluewave/combat/tactical";
import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";

const thisDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(thisDir, "..", "..", "..");
const PRODUCTION_PACK = resolve(REPO_ROOT, "content", "production", "1880");

function compileProductionPack() {
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const input = buildFullSurfaceInput(
    resolve(PRODUCTION_PACK, "pack.json"),
    PRODUCTION_PACK,
    collector,
  );
  const artifact = input ? buildContentBundleArtifact(input, signal, collector) : undefined;
  if (!artifact || collector.hasErrors) {
    throw new Error(`Content build failed: ${collector.all.map((d) => d.message).join("; ")}`);
  }
  const output = new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    },
    signal,
    collector,
  );
  if (!output || collector.hasErrors) {
    throw new Error(`Compile failed: ${collector.all.map((d) => d.message).join("; ")}`);
  }
  return output.state.snapshot;
}

function divisionAssets(
  fleets: readonly FleetState[],
  designs: ReadonlyMap<string, CompiledDesignVersion>,
  division: PermanentDivision,
): DivisionAssetView[] {
  const byId = new Map(fleets.flatMap((fleet) => fleet.ships).map((ship) => [ship.id, ship]));
  return division.shipOrder.map((shipId) => {
    const ship = byId.get(shipId);
    if (ship === undefined) throw new Error(`division references unknown ship ${shipId}`);
    const design =
      ship.designVersionId === undefined ? undefined : designs.get(ship.designVersionId);
    let shipType: CanonicalShipType = "BB";
    if (design !== undefined) {
      try {
        shipType = classifyShip(design);
      } catch {
        shipType = "BB";
      }
    }
    return {
      shipId,
      shipType,
      locationAreaId: ship.locationAreaId,
      isUnderConstruction: !isShipOperational(ship),
    };
  });
}

describe("seeded 1880 divisions load from the compiled snapshot (N-1 ticket 07)", () => {
  const snapshot = compileProductionPack();
  const nations = [...snapshot.nations.values()];

  it("seeds divisions for the organised nations and none for the rest", () => {
    const seeded = nations.filter((n) => n.divisions.length > 0).map((n) => n.id);
    expect(seeded).toContain("uk");
    expect(seeded).toContain("france");
    expect(seeded).toContain("netherlands");
    expect(seeded).not.toContain("usa");
    expect(seeded).not.toContain("qing");
    expect(nations.flatMap((n) => n.divisions).length).toBeGreaterThan(0);
  });

  it("every seeded division satisfies assertDivisionInvariants", () => {
    for (const nation of nations) {
      for (const division of nation.divisions) {
        const assets = divisionAssets(nation.fleets, snapshot.designs, division);
        expect(
          () => assertDivisionInvariants(division, assets, { nationId: nation.id }),
          `division ${division.divisionId}`,
        ).not.toThrow();
      }
    }
  });

  it("stamps the campaign start month and a real or vacant commander", () => {
    for (const nation of nations) {
      const officerIds = new Set((nation.officers ?? []).map((o) => o.id));
      for (const division of nation.divisions) {
        expect(division.creationMonth).toBe("1880-01");
        expect(division.lastReorganizationMonth).toBe("1880-01");
        expect(division.rulesetVersion).toBe("1.0");
        expect(division.flagshipShipId).toBe(division.shipOrder[0]);
        expect(division.aggregateHash.length).toBeGreaterThan(0);
        if (division.commanderOfficerId !== VACANT) {
          expect(officerIds.has(division.commanderOfficerId)).toBe(true);
        }
      }
    }
  });
});
