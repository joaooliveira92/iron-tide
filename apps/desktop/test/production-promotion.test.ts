import { describe, it, expect } from "vite-plus/test";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { InvalidShipType, promoteTacticalUnit } from "@bluewave/combat";
import { compileProductionCampaignFromArtifact } from "../src/main/compiler.js";
import { resolveGeneratedContentDir } from "../src/main/contentPack.js";

// AC-1/AC-14: the promotion mechanism is deterministic and carries the design
// data the tactical layer needs. This test proves the mechanism end-to-end on
// the compiled production design registry. Every 1880 starting ship now carries
// a `designVersionId` resolving to a real `CompiledDesignVersion` (N-2 tickets
// 29/30 closed the last two, aut_custoza and gbr_temeraire).
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

    // Prove the mechanism for any ship that carries a designVersionId: identical
    // inputs produce identical units (purity + determinism). Under-construction
    // ships carry a design but cannot be promoted (TACTICAL_UNIT_PROMOTION_INVALID),
    // so the determinism check runs on commissioned linked ships only. A design
    // that fails DESIGN-22 classification is counted and reported (code
    // INVALID_SHIP_TYPE) rather than fabricated; after N-2/ADR-0228 every
    // commissioned linked 1880 ship classifies, so `blocked` must stay 0.
    let linked = 0;
    let promoted = 0;
    let blocked = 0;
    for (const [, nation] of snapshot.nations) {
      for (const fleet of nation.fleets) {
        for (const ship of fleet.ships) {
          if (!ship.designVersionId) continue; // unlinked: deferred content item
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
          expect(a).toEqual(b); // determinism
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

    // Design registry itself is present and promotes (guards the content path).
    expect(designs.size).toBeGreaterThan(0);
    expect(linked).toBeGreaterThan(0);
    // ADR-0037: compiled designs carry µm/µm·s⁻¹ and the classifier's opening
    // band matches the 1880 ruleset (ADR-0228), so every commissioned linked
    // 1880 ship classifies and promotes deterministically with nothing blocked.
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
            // every linked ship must resolve a real compiled design
            expect(snapshot.designs.has(ship.designVersionId)).toBe(true);
          } else {
            unlinkedIds.push(ship.id);
          }
        }
      }
    }

    expect(totalShips).toBeGreaterThan(0);
    // N-2 (tickets 29/30) authored a design for every remaining design-less
    // class, so no starting ship is unlinked: each resolves a real compiled design.
    expect(linked).toBeGreaterThan(0);
    expect(linked).toBe(totalShips);
    expect(unlinkedIds).toEqual([]);
  });
});
