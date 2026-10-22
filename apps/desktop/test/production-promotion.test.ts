import { describe, it, expect } from "vite-plus/test";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { InvalidShipType, promoteTacticalUnit } from "@bluewave/combat/tactical";
import { compileProductionCampaignFromArtifact } from "../src/main/compiler.js";
import { resolveGeneratedContentDir } from "../src/main/contentPack.js";

describe("production-pack ship promotion (AC-1/AC-14)", () => {
  it("deterministically promotes any ship carrying a resolvable designVersionId", () => {
    const collector = new DiagnosticCollector();
    const signal = new AbortController().signal;

    const output = compileProductionCampaignFromArtifact(
      resolveGeneratedContentDir(),
      signal,
      collector,
    );

    expect(collector.hasErrors).toBe(false);
    expect(output).toBeDefined();
    if (!output) return;

    const snapshot = output.state.snapshot;
    const designs = snapshot.designs;

    let linked = 0;
    let promoted = 0;
    let blocked = 0;
    for (const [, nation] of snapshot.nations) {
      for (const fleet of nation.fleets) {
        for (const ship of fleet.ships) {
          if (!ship.designVersionId) continue;
          const design = designs.get(ship.designVersionId);
          expect(design).toBeDefined();
          if (!design) continue;
          linked++;
          if (ship.isUnderConstruction) continue;
          let a: ReturnType<typeof promoteTacticalUnit>;
          try {
            a = promoteTacticalUnit(ship, design, {
              sideId: "ATTACKER",
              preBattleStateHash: "pack-promotion",
            });
          } catch (err) {
            blocked++;
            const bwErr = err as { name?: string; context?: Record<string, unknown> };
            expect(bwErr.name).toBe("BluewaveError");
            expect(bwErr.context?.["code"]).toBe(InvalidShipType);
            continue;
          }
          const b = promoteTacticalUnit(ship, design, {
            sideId: "ATTACKER",
            preBattleStateHash: "pack-promotion",
          });
          expect(a).toEqual(b);
          expect(a.armorBeltUm).toBe(design.normalizedArmorUm);
          expect(a.mainGunsCaliberUm).toBe(design.mainGunsCaliber);
          expect(a.mainGunsCount).toBe(design.mainGunsCount);
          expect(a.crewComplement).toBe(design.crewComplement);
          expect(a.displacementKg).toBe(design.normalizedDisplacementKg);
          expect(a.designedSpeedUms).toBe(design.normalizedSpeedUms);
          expect(a.shipType).toBeTruthy();
          promoted++;
        }
      }
    }

    expect(designs.size).toBeGreaterThan(0);
    expect(linked).toBeGreaterThan(0);
    expect(promoted).toBeGreaterThan(0);
    expect(blocked).toBe(0);
  });

  it("links every starting ship to a real compiled design", () => {
    const collector = new DiagnosticCollector();
    const signal = new AbortController().signal;

    const output = compileProductionCampaignFromArtifact(
      resolveGeneratedContentDir(),
      signal,
      collector,
    );

    expect(output).toBeDefined();
    if (!output) return;

    const snapshot = output.state.snapshot;
    let totalShips = 0;
    let linked = 0;
    const unlinkedIds: string[] = [];
    for (const [, nation] of snapshot.nations) {
      for (const fleet of nation.fleets) {
        totalShips += fleet.ships.length;
        for (const ship of fleet.ships) {
          if (ship.designVersionId) {
            linked++;
            expect(snapshot.designs.has(ship.designVersionId)).toBe(true);
          } else {
            unlinkedIds.push(ship.id);
          }
        }
      }
    }

    expect(totalShips).toBeGreaterThan(0);
    expect(linked).toBeGreaterThan(0);
    expect(linked).toBe(totalShips);
    expect(unlinkedIds).toEqual([]);
  });
});
