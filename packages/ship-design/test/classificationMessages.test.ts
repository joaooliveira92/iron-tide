import { describe, expect, it } from "vite-plus/test";
import {
  CLASSIFIED_SHIP_TYPES,
  classRuleFailures,
  DESIGN_22_EARLY,
  type ClassFacts,
  type ClassificationRules,
  type ClassifiedShipType,
} from "../src/classificationRules.js";
import { UM_PER_INCH, UM_PER_KNOT } from "../src/units.js";
import pinned from "./fixtures/classificationFailures.early.json" with { type: "json" };

const high: ClassFacts = {
  displacementKg: 30_000_000,
  speedUms: 40 * UM_PER_KNOT,
  beltUm: 20 * UM_PER_INCH,
  anyQualifyingArmourUm: 20 * UM_PER_INCH,
  maxMainGunUm: 16 * UM_PER_INCH,
  mainTurretCount: 5,
  torpedoTubes: 4,
  aircraftCapacity: 8,
  deckUm: 0,
  maxHeavyMountBarrels: 3,
  maxGunUm: 16 * UM_PER_INCH,
  merchantHull: false,
};
const low: ClassFacts = {
  displacementKg: 0,
  speedUms: 0,
  beltUm: 0,
  anyQualifyingArmourUm: 0,
  maxMainGunUm: 0,
  mainTurretCount: 0,
  torpedoTubes: 0,
  aircraftCapacity: 0,
  deckUm: 0,
  maxHeavyMountBarrels: 0,
  maxGunUm: 0,
  merchantHull: false,
};

const CITED_KEYS: Record<ClassifiedShipType, readonly (keyof ClassificationRules)[]> = {
  DD: ["ddMaxDisplacementKg", "ddMinSpeedUms", "qualifyingArmourUm", "ddMaxGunUm"],
  CL: [
    "clMinDisplacementKg",
    "clMaxDisplacementKg",
    "clMinSpeedUms",
    "clMaxGunUm",
    "clProtectedMaxGunUm",
    "clBeltMaxUm",
    "aircraftLimit",
  ],
  CA: [
    "caMinDisplacementKg",
    "caMinSpeedUms",
    "caBeltMinUm",
    "caBeltMaxUm",
    "clMaxGunUm",
    "caGunMaxUm",
    "aircraftLimit",
  ],
  B: [
    "bMinDisplacementKg",
    "bBeltMinUm",
    "clMaxGunUm",
    "bMaxSpeedUms",
    "bMaxTurrets",
    "aircraftLimit",
  ],
  BB: ["bbMinDisplacementKg", "bbMinTurrets", "bbBeltMinUm", "bbGunMinUm", "aircraftLimit"],
  KE: ["keMaxDisplacementKg", "keBeltMaxUm", "keGunMaxUm"],
  AMC: ["amcMinDisplacementKg", "qualifyingArmourUm", "amcGunMaxUm", "aircraftLimit"],
};

const text = (t: ClassifiedShipType, r: ClassificationRules): string =>
  [high, low]
    .flatMap((f) => classRuleFailures[t](f, r))
    .map((x) => `${x.code}|${x.field}|${x.message}|${x.suggestion ?? ""}`)
    .join("\n");

describe("classification failure text", () => {
  it("is unchanged under the early ruleset", () => {
    const now = Object.fromEntries(
      CLASSIFIED_SHIP_TYPES.map((t) => [
        t,
        {
          high: classRuleFailures[t](high, DESIGN_22_EARLY),
          low: classRuleFailures[t](low, DESIGN_22_EARLY),
        },
      ]),
    );
    expect(JSON.parse(JSON.stringify(now))).toEqual(pinned);
  });

  for (const t of CLASSIFIED_SHIP_TYPES) {
    for (const key of CITED_KEYS[t]) {
      it(`${t} text follows ${key}`, () => {
        const changed = { ...DESIGN_22_EARLY, [key]: DESIGN_22_EARLY[key] * 2 };
        expect(text(t, changed)).not.toEqual(text(t, DESIGN_22_EARLY));
      });
    }
  }

  it("states the B limits of the ruleset it is given", () => {
    const r = { ...DESIGN_22_EARLY, bBeltMinUm: 4 * UM_PER_INCH, bMaxSpeedUms: 18 * UM_PER_KNOT };
    const msgs = [...classRuleFailures.B(low, r), ...classRuleFailures.B(high, r)].map(
      (x) => x.message,
    );
    expect(msgs).toContain("main belt must be at least 4 inches");
    expect(msgs).toContain("speed must be below 18 kn");
  });
});
