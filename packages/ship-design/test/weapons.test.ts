import { describe, it, expect } from "vite-plus/test";
import {
  compileWeapons,
  type ArcObstacle,
  type GunMount,
  type WeaponBalance,
} from "../src/weapons.js";
import { checkFindingShape } from "../src/findings.js";
import { lintCatalogue } from "../src/component.js";
import { evaluate } from "../src/formula/eval.js";
import { parseFormula } from "../src/formula/parse.js";
import { type ComponentDef } from "../src/index.js";

const bal: WeaponBalance = {
  feedFactor: {
    points: [
      [0, 10_000],
      [200, 9_000],
      [600, 5_000],
    ],
  },
  stowageBp: 12_000,
  blastLoadBp: 3_000,
  minBeamArcDeg: 30,
  arcWarnLossDeg: 20,
};
const gun = (o: Partial<GunMount> = {}): GunMount => ({
  instanceId: "g1",
  stationPermille: 100,
  side: "CENTRE",
  barrels: 2,
  roundsPerBarrel: 60,
  shellMassG: 400_000,
  chargeBp: 3_000,
  roundVolumeMl: 120_000,
  rofBaseX100: 100,
  beamArcDeg: 120,
  feedDistancePermille: 0,
  ...o,
});
const funnel: ArcObstacle = {
  id: "funnel",
  fromPermille: 500,
  toPermille: 560,
  reachPermille: 60,
  blockedDeg: 40,
};

describe("compileWeapons", () => {
  it("computes ammunition mass/volume with rounding up", () => {
    const r = compileWeapons([gun()], [], 10_000, bal);
    expect(r.ammoMassKg).toBe(62_400);
    expect(r.ammoVolumeLitre).toBe(17_280);
  });
  it("broadside counts a centreline mount on both sides, a side mount on one", () => {
    const r = compileWeapons(
      [gun(), gun({ instanceId: "g2", side: "PORT", barrels: 1 })],
      [],
      10_000,
      bal,
    );
    expect(r.broadsidePortKg).toBe(1_200);
    expect(r.broadsideStbdKg).toBe(800);
  });
  it("rate of fire falls with crew quality and magazine distance", () => {
    const full = compileWeapons([gun()], [], 10_000, bal).mounts[0]!.rofX100;
    expect(full).toBe(200);
    expect(compileWeapons([gun()], [], 8_000, bal).mounts[0]!.rofX100).toBeLessThan(full);
    expect(
      compileWeapons([gun({ feedDistancePermille: 400 })], [], 10_000, bal).mounts[0]!.rofX100,
    ).toBeLessThan(full);
  });
  it("obstruction reduces arc, warns, and can remove the mount from the broadside", () => {
    const near = compileWeapons([gun({ stationPermille: 520 })], [funnel], 10_000, bal);
    expect(near.mounts[0]!.effectiveBeamArcDeg).toBe(80);
    expect(near.findings[0]!.id).toBe("ARC_OBSTRUCTED");
    expect(checkFindingShape(near.findings[0]!)).toEqual([]);
    const blocked = compileWeapons(
      [gun({ stationPermille: 520, beamArcDeg: 60 })],
      [funnel, { ...funnel, id: "mast" }],
      10_000,
      bal,
    );
    expect(blocked.mounts[0]!.countsToBroadside).toBe(false);
    expect(blocked.broadsidePortKg).toBe(0);
    const far = compileWeapons([gun({ stationPermille: 100 })], [funnel], 10_000, bal);
    expect(far.findings).toEqual([]);
  });
  it("blast load grows with shell mass and barrels; empty armament is all zeros", () => {
    expect(compileWeapons([gun()], [], 10_000, bal).blastLoadKg).toBe(240);
    const none = compileWeapons([], [], 10_000, bal);
    expect(none.broadsidePortKg + none.ammoMassKg + none.blastLoadKg).toBe(0);
  });
  it("rejects invalid mounts and is order independent", () => {
    expect(() => compileWeapons([gun({ barrels: 0 })], [], 10_000, bal)).toThrow();
    const a = [gun(), gun({ instanceId: "g2", side: "STBD" })];
    expect(JSON.stringify(compileWeapons(a, [], 10_000, bal))).toBe(
      JSON.stringify(compileWeapons([...a].reverse(), [], 10_000, bal)),
    );
  });
});

describe("small-bore weapons use grams and millilitres", () => {
  it("a Maxim belt of 1,000 rounds weighs about 17 kg (18 rounded up) and still counts in the broadside", () => {
    const maxim = gun({
      instanceId: "mg",
      barrels: 1,
      roundsPerBarrel: 1_000,
      shellMassG: 14,
      chargeBp: 2_143,
      roundVolumeMl: 30,
      rofBaseX100: 25_000,
      beamArcDeg: 90,
    });
    const r = compileWeapons([maxim], [], 10_000, bal);
    expect(r.ammoMassKg).toBe(18);
    expect(r.ammoVolumeLitre).toBe(36);
    expect(r.broadsidePortKg).toBe(0);
    expect(r.sustainedPerMinX100).toBe(Math.floor((14 * 25_000) / 1000));
    expect(r.mounts[0]!.countsToBroadside).toBe(true);
  });
});

describe("data-driven gun weight (no weapon-specific code)", () => {
  const def: ComponentDef = {
    id: "gun_bl_heavy",
    displayName: "Heavy BL gun",
    category: "MAIN_GUN",
    introduction: { fromMonth: "1881-03", obsoleteMonth: null },
    requires: [],
    parameters: { cal_mm: { min: 150, max: 400, step: 1 }, barrels: { min: 1, max: 4, step: 1 } },
    constants: { k: 3 },
    weightKg: "k * pow(cal_mm, 14, 5) * barrels",
    volumeLitre: "cal_mm * barrels * 20",
    costMicro: "cal_mm * barrels * 100000",
    crew: "cal_mm / 20 * barrels",
    powerKw: "0",
    upgradePath: [],
    tags: [],
  };
  it("passes content lint and scales as calibre^2.8", () => {
    expect(lintCatalogue([def], new Set())).toEqual([]);
    const w = (cal: number) =>
      evaluate(parseFormula(def.weightKg), { vars: { k: 3, cal_mm: cal, barrels: 1 } });
    expect(w(305)).toBeGreaterThan(w(254));
    expect(w(400) / w(200)).toBeGreaterThan(6.8);
    expect(w(400) / w(200)).toBeLessThan(7.0);
  });
});
