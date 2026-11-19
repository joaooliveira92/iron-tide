import { DEFAULT_AREA_BBOX } from "@bluewave/combat/battleResolution";
import { computeInitialMovementStates } from "@bluewave/combat/simulation";
import { pointInNoGoZone } from "@bluewave/combat/terrain";
import { describe, expect, it } from "vite-plus/test";

import { compileProductionBattleTerrain } from "../src/production-pack.js";
import { fleetManagementOptions } from "../src/replay-corpus/corpus.js";

const SIDE_SIZES = [1, 2, 3, 5, 8, 12] as const;

function spawnPositions(attackers: number, defenders: number): [number, number][] {
  const unit = (assetId: string, sideId: "ATTACKER" | "DEFENDER") => ({
    assetId,
    sideId,
    orderedSpeedBpKnots: 1,
    designedSpeedBpKnots: 1,
    turningRateMdegS: 1_000,
  });
  const units = [
    ...Array.from({ length: attackers }, (_, i) => unit(`a${String(i)}`, "ATTACKER")),
    ...Array.from({ length: defenders }, (_, i) => unit(`d${String(i)}`, "DEFENDER")),
  ];
  return Object.values(computeInitialMovementStates(DEFAULT_AREA_BBOX, units)).map(
    (state) => state.position,
  );
}

describe("production battle terrain placement", () => {
  const terrain = compileProductionBattleTerrain();

  it("covers the Cyprus, Gibraltar and Malta areas", () => {
    expect(Object.keys(terrain ?? {}).sort()).toEqual(["med_cyprus", "med_gibraltar", "med_malta"]);
  }, 60_000);

  it("supplies the placed terrain to every replay corpus engine", () => {
    expect(Object.keys(fleetManagementOptions("austria_hungary").terrain ?? {}).sort()).toEqual([
      "med_cyprus",
      "med_gibraltar",
      "med_malta",
    ]);
  }, 60_000);

  it("never places a spawn point on land or inside a base exclusion", () => {
    for (const [areaId, view] of Object.entries(terrain ?? {})) {
      for (const attackers of SIDE_SIZES) {
        for (const defenders of SIDE_SIZES) {
          for (const position of spawnPositions(attackers, defenders)) {
            expect(pointInNoGoZone(view, position), `${areaId} ${String(position)}`).toBe(false);
          }
        }
      }
    }
  }, 60_000);

  it("keeps some terrain inside the battle box so placement is not vacuous", () => {
    const inBox = (xM: number, yM: number) => xM >= 0 && xM <= 20_000 && yM >= 0 && yM <= 10_000;
    for (const [areaId, view] of Object.entries(terrain ?? {})) {
      const landVertex = view.land.some((p) => p.vertices.some((v) => inBox(v.xM, v.yM)));
      const exclusion = view.exclusions.some((e) => inBox(e.xM, e.yM));
      expect(landVertex || exclusion, areaId).toBe(true);
    }
  }, 60_000);
});
