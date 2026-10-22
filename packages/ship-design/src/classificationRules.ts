import { UM_PER_INCH, UM_PER_KNOT } from "./units.js";

export const CLASSIFIED_SHIP_TYPES = ["BB", "B", "CA", "AMC", "CL", "DD", "KE"] as const;
export type ClassifiedShipType = (typeof CLASSIFIED_SHIP_TYPES)[number];

export interface ClassFacts {
  readonly displacementKg: number;
  readonly speedUms: number;
  readonly beltUm: number;
  readonly anyQualifyingArmourUm: number;
  readonly maxMainGunUm: number;
  readonly mainTurretCount: number;
  readonly torpedoTubes: number;
  readonly aircraftCapacity: number;
  readonly deckUm: number;
  readonly maxHeavyMountBarrels: number;
  readonly maxGunUm: number;
  readonly merchantHull: boolean;
}

export interface ClassificationRules {
  readonly rulesetVersion: number;
  readonly ddMaxDisplacementKg: number;
  readonly ddMinSpeedUms: number;
  readonly ddMaxGunUm: number;
  readonly qualifyingArmourUm: number;
  readonly clMinDisplacementKg: number;
  readonly clMaxDisplacementKg: number;
  readonly clMinSpeedUms: number;
  readonly clMaxGunUm: number;
  readonly clBeltMaxUm: number;
  readonly protectedCruiserExceptionVersion: number;
  readonly clProtectedMaxGunUm: number;
  readonly caMinDisplacementKg: number;
  readonly caMinSpeedUms: number;
  readonly caBeltMinUm: number;
  readonly caBeltMaxUm: number;
  readonly caGunMaxUm: number;
  readonly bMinDisplacementKg: number;
  readonly bBeltMinUm: number;
  readonly bMaxSpeedUms: number;
  readonly bMaxTurrets: number;
  readonly bbMinDisplacementKg: number;
  readonly bbMinTurrets: number;
  readonly bbBeltMinUm: number;
  readonly bbGunMinUm: number;
  readonly aircraftLimit: number;
  readonly keMaxDisplacementKg: number;
  readonly keBeltMaxUm: number;
  readonly keGunMaxUm: number;
  readonly amcMinDisplacementKg: number;
  readonly amcGunMaxUm: number;
  readonly amcFleetShareBp: number;
  readonly amcFleetMinAllowance: number;
  readonly amcFastShareBp: number;
  readonly amcFastMinAllowance: number;
  readonly amcFastSpeedUms: number;
}

export const DESIGN_22_EARLY: ClassificationRules = {
  rulesetVersion: 1,
  ddMaxDisplacementKg: 2_000_000,
  ddMinSpeedUms: 19 * UM_PER_KNOT + 1 - 1,
  ddMaxGunUm: 6 * UM_PER_INCH,
  qualifyingArmourUm: 2 * UM_PER_INCH,
  clMinDisplacementKg: 2_000_000,
  clMaxDisplacementKg: 8_000_000,
  clMinSpeedUms: 16 * UM_PER_KNOT,
  clMaxGunUm: 6 * UM_PER_INCH,
  clBeltMaxUm: 2 * UM_PER_INCH,
  protectedCruiserExceptionVersion: 1,
  clProtectedMaxGunUm: 8 * UM_PER_INCH,
  caMinDisplacementKg: 4_000_000,
  caMinSpeedUms: 19 * UM_PER_KNOT,
  caBeltMinUm: 2 * UM_PER_INCH,
  caBeltMaxUm: 12 * UM_PER_INCH,
  caGunMaxUm: 11 * UM_PER_INCH,
  bMinDisplacementKg: 5_000_000,
  bBeltMinUm: 6 * UM_PER_INCH,
  bMaxSpeedUms: 20 * UM_PER_KNOT,
  bMaxTurrets: 2,
  bbMinDisplacementKg: 8_000_000,
  bbMinTurrets: 3,
  bbBeltMinUm: 6 * UM_PER_INCH,
  bbGunMinUm: 10 * UM_PER_INCH,
  aircraftLimit: 4,
  keMaxDisplacementKg: 2_500_000,
  keBeltMaxUm: 2 * UM_PER_INCH,
  keGunMaxUm: 6 * UM_PER_INCH,
  amcMinDisplacementKg: 1_700_000,
  amcGunMaxUm: 6 * UM_PER_INCH,
  amcFleetShareBp: 2_000,
  amcFleetMinAllowance: 2,
  amcFastShareBp: 2_500,
  amcFastMinAllowance: 1,
  amcFastSpeedUms: 22 * UM_PER_KNOT,
};

export const isProtectedCruiser = (f: ClassFacts, r: ClassificationRules): boolean =>
  f.beltUm === 0 &&
  f.deckUm > 0 &&
  f.maxMainGunUm <= r.clProtectedMaxGunUm &&
  f.maxHeavyMountBarrels <= 1;

export type ClassRuleField =
  | "displacement"
  | "speed"
  | "belt"
  | "qualifyingArmour"
  | "mainGun"
  | "turrets"
  | "torpedoes"
  | "aircraft"
  | "hull";

export interface ClassRuleFailure {
  readonly code: string;
  readonly field: ClassRuleField;
  readonly message: string;
  readonly suggestion?: string;
}

const fail = (
  code: string,
  field: ClassRuleField,
  message: string,
  suggestion?: string,
): ClassRuleFailure => ({ code, field, message, ...(suggestion ? { suggestion } : {}) });

export const classRuleFailures: Record<
  ClassifiedShipType,
  (f: ClassFacts, r: ClassificationRules) => ClassRuleFailure[]
> = {
  DD: (f, r) => {
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg > 0 && f.displacementKg < r.ddMaxDisplacementKg))
      why.push(
        fail(
          "DD_DISPLACEMENT_LIMIT_EXCEEDED",
          "displacement",
          `displacement ${f.displacementKg} kg must be below ${r.ddMaxDisplacementKg}`,
          "Reduce the target displacement or fit a lighter armament.",
        ),
      );
    if (!(f.speedUms > r.ddMinSpeedUms))
      why.push(
        fail(
          "DD_SPEED_TOO_LOW",
          "speed",
          `speed must exceed ${r.ddMinSpeedUms} um/s (19 kn)`,
          "Raise installed power or choose a faster plant.",
        ),
      );
    if (f.torpedoTubes < 1)
      why.push(
        fail(
          "DD_TORPEDO_REQUIRED",
          "torpedoes",
          "needs at least one usable torpedo tube",
          "Fit a torpedo tube.",
        ),
      );
    if (f.anyQualifyingArmourUm >= r.qualifyingArmourUm)
      why.push(
        fail(
          "DD_QUALIFYING_ARMOR_PROHIBITED",
          "qualifyingArmour",
          `has qualifying armour (>= ${r.qualifyingArmourUm} um)`,
          "Remove armour of 2 inches or more.",
        ),
      );
    if (f.maxGunUm > r.ddMaxGunUm)
      why.push(
        fail(
          "DD_GUN_TOO_LARGE",
          "mainGun",
          "guns must be 6 inches or smaller (larger guns are cruiser-scale weapons)",
          "Use guns of 6 inches or less.",
        ),
      );
    if (f.aircraftCapacity !== 0)
      why.push(fail("DD_AIRCRAFT_PROHIBITED", "aircraft", "aircraft capacity must be 0"));
    return why;
  },
  CL: (f, r) => {
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg >= r.clMinDisplacementKg && f.displacementKg < r.clMaxDisplacementKg))
      why.push(
        fail(
          "CL_DISPLACEMENT_RANGE",
          "displacement",
          `displacement must be ${r.clMinDisplacementKg}..${r.clMaxDisplacementKg - 1} kg`,
        ),
      );
    if (!(f.speedUms > r.clMinSpeedUms))
      why.push(
        fail("CL_SPEED_TOO_LOW", "speed", "speed must exceed 16 kn", "Raise installed power."),
      );
    if (!(f.maxMainGunUm <= r.clMaxGunUm) && !isProtectedCruiser(f, r))
      why.push(
        fail(
          "CL_MAIN_CALIBER_EXCEEDED",
          "mainGun",
          "main guns must be 6 inches or smaller (protected cruisers: single mounts up to 8 inches, armour deck, no main belt)",
          "Use guns of 6 inches or less, or drop the main belt and fit single 8-inch mounts under an armour deck.",
        ),
      );
    if (!(f.beltUm <= r.clBeltMaxUm))
      why.push(
        fail(
          "CL_BELT_TOO_THICK",
          "belt",
          "main belt must be 2 inches or less (a protected cruiser relies on its armour deck)",
          "Thin the belt to 2 inches or remove it and armour the deck; a belted cruiser is an armoured cruiser.",
        ),
      );
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(fail("CL_AIRCRAFT_LIMIT", "aircraft", "aircraft capacity must be below 4"));
    return why;
  },
  CA: (f, r) => {
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg > r.caMinDisplacementKg))
      why.push(
        fail(
          "CA_BOUNDARY_FAILED",
          "displacement",
          `displacement must exceed ${r.caMinDisplacementKg} kg`,
        ),
      );
    if (!(f.speedUms > r.caMinSpeedUms))
      why.push(fail("CA_BOUNDARY_FAILED", "speed", "speed must exceed 19 kn"));
    if (!(f.beltUm > r.caBeltMinUm && f.beltUm <= r.caBeltMaxUm))
      why.push(fail("CA_BOUNDARY_FAILED", "belt", "main belt must be over 2 and up to 12 inches"));
    if (!(f.maxMainGunUm > r.clMaxGunUm && f.maxMainGunUm <= r.caGunMaxUm))
      why.push(
        fail("CA_BOUNDARY_FAILED", "mainGun", "main guns must be over 6 and up to 11 inches"),
      );
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(fail("CA_AIRCRAFT_LIMIT", "aircraft", "aircraft capacity must be below 4"));
    return why;
  },
  B: (f, r) => {
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg >= r.bMinDisplacementKg))
      why.push(
        fail(
          "B_DISPLACEMENT_TOO_LOW",
          "displacement",
          `displacement must be at least ${r.bMinDisplacementKg} kg`,
        ),
      );
    if (!(f.beltUm >= r.bBeltMinUm))
      why.push(
        fail(
          "B_BELT_TOO_THIN",
          "belt",
          "main belt must be at least 6 inches",
          "Thicken the main belt to 6 inches or more.",
        ),
      );
    if (!(f.maxMainGunUm > r.clMaxGunUm))
      why.push(fail("B_MAIN_GUN_TOO_SMALL", "mainGun", "main guns must be over 6 inches"));
    if (!(f.speedUms < r.bMaxSpeedUms))
      why.push(
        fail(
          "B_SPEED_TOO_HIGH",
          "speed",
          "speed must be below 20 kn",
          "Lower installed power below the 20-knot battle-line boundary.",
        ),
      );
    if (!(f.mainTurretCount === 1 || f.mainTurretCount === 2))
      why.push(
        fail(
          "B_TURRET_ARRANGEMENT",
          "turrets",
          "needs 1 or 2 main-battery turrets",
          "Fit one or two main-battery mounts; three or more is a dreadnought-style arrangement.",
        ),
      );
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(fail("B_AIRCRAFT_LIMIT", "aircraft", "aircraft capacity must be below 4"));
    return why;
  },
  BB: (f, r) => {
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg > r.bbMinDisplacementKg))
      why.push(
        fail(
          "BB_DISPLACEMENT_TOO_LOW",
          "displacement",
          `displacement must exceed ${r.bbMinDisplacementKg} kg`,
        ),
      );
    if (!(f.mainTurretCount >= r.bbMinTurrets))
      why.push(fail("BB_TURRET_ARRANGEMENT", "turrets", "needs at least 3 main-battery turrets"));
    if (!(f.beltUm > r.bbBeltMinUm))
      why.push(fail("BB_BELT_TOO_THIN", "belt", "main belt must exceed 6 inches"));
    if (!(f.maxMainGunUm > r.bbGunMinUm))
      why.push(fail("BB_MAIN_GUN_TOO_SMALL", "mainGun", "main guns must exceed 10 inches"));
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(fail("BB_AIRCRAFT_LIMIT", "aircraft", "aircraft capacity must be below 4"));
    return why;
  },
  KE: (f, r) => {
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg > 0 && f.displacementKg < r.keMaxDisplacementKg))
      why.push(
        fail(
          "KE_DISPLACEMENT_LIMIT_EXCEEDED",
          "displacement",
          `displacement must be below ${r.keMaxDisplacementKg} kg`,
          "Reduce the target displacement.",
        ),
      );
    if (!(f.beltUm <= r.keBeltMaxUm))
      why.push(
        fail(
          "KE_BELT_TOO_THICK",
          "belt",
          "main belt must be 2 inches or less",
          "Thin the main belt to 2 inches or remove it.",
        ),
      );
    if (!(f.maxGunUm <= r.keGunMaxUm))
      why.push(
        fail(
          "KE_MAIN_GUN_TOO_LARGE",
          "mainGun",
          "main guns must be 6 inches or smaller",
          "Use guns of 6 inches or less.",
        ),
      );
    if (f.torpedoTubes > 0)
      why.push(
        fail(
          "KE_TORPEDO_PROHIBITED",
          "torpedoes",
          "no torpedo tube may be installed",
          "Remove the torpedo tubes (a torpedo-armed small ship is a destroyer).",
        ),
      );
    if (f.aircraftCapacity !== 0)
      why.push(fail("KE_AIRCRAFT_PROHIBITED", "aircraft", "aircraft capacity must be 0"));
    return why;
  },
  AMC: (f, r) => {
    const why: ClassRuleFailure[] = [];
    if (!f.merchantHull)
      why.push(
        fail(
          "AMC_MERCHANT_HULL_REQUIRED",
          "hull",
          "needs a merchant-derived hull form",
          "Choose the merchant liner hull form.",
        ),
      );
    if (!(f.displacementKg > r.amcMinDisplacementKg))
      why.push(
        fail(
          "AMC_DISPLACEMENT_TOO_LOW",
          "displacement",
          `displacement must exceed ${r.amcMinDisplacementKg} kg`,
        ),
      );
    if (f.anyQualifyingArmourUm >= r.qualifyingArmourUm)
      why.push(
        fail(
          "AMC_QUALIFYING_ARMOR_PROHIBITED",
          "qualifyingArmour",
          `has qualifying armour (>= ${r.qualifyingArmourUm} um)`,
          "Remove armour of 2 inches or more.",
        ),
      );
    if (!(f.maxGunUm <= r.amcGunMaxUm))
      why.push(
        fail(
          "AMC_MAIN_GUN_TOO_LARGE",
          "mainGun",
          "main guns must be 6 inches or smaller",
          "Use guns of 6 inches or less.",
        ),
      );
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(fail("AMC_AIRCRAFT_LIMIT", "aircraft", "aircraft capacity must be below 4"));
    return why;
  },
};

export const classPredicates: Record<
  ClassifiedShipType,
  (f: ClassFacts, r: ClassificationRules) => string[]
> = Object.fromEntries(
  CLASSIFIED_SHIP_TYPES.map((t) => [
    t,
    (f: ClassFacts, r: ClassificationRules) => classRuleFailures[t](f, r).map((x) => x.message),
  ]),
) as Record<ClassifiedShipType, (f: ClassFacts, r: ClassificationRules) => string[]>;

export const isClassifiedShipType = (s: string): s is ClassifiedShipType =>
  (CLASSIFIED_SHIP_TYPES as readonly string[]).includes(s);

export const CLASSIFICATION_RULE_KEYS = [
  "rulesetVersion",
  "ddMaxDisplacementKg",
  "ddMinSpeedUms",
  "ddMaxGunUm",
  "qualifyingArmourUm",
  "clMinDisplacementKg",
  "clMaxDisplacementKg",
  "clMinSpeedUms",
  "clMaxGunUm",
  "clBeltMaxUm",
  "protectedCruiserExceptionVersion",
  "clProtectedMaxGunUm",
  "caMinDisplacementKg",
  "caMinSpeedUms",
  "caBeltMinUm",
  "caBeltMaxUm",
  "caGunMaxUm",
  "bMinDisplacementKg",
  "bBeltMinUm",
  "bMaxSpeedUms",
  "bMaxTurrets",
  "bbMinDisplacementKg",
  "bbMinTurrets",
  "bbBeltMinUm",
  "bbGunMinUm",
  "aircraftLimit",
  "keMaxDisplacementKg",
  "keBeltMaxUm",
  "keGunMaxUm",
  "amcMinDisplacementKg",
  "amcGunMaxUm",
  "amcFleetShareBp",
  "amcFleetMinAllowance",
  "amcFastShareBp",
  "amcFastMinAllowance",
  "amcFastSpeedUms",
] as const satisfies readonly (keyof ClassificationRules)[];

export function classificationRulesFromRecord(raw: unknown): ClassificationRules {
  if (raw === null || typeof raw !== "object")
    throw new Error("classification rules must be an object");
  const rec = raw as Record<string, unknown>;
  for (const k of CLASSIFICATION_RULE_KEYS)
    if (typeof rec[k] !== "number" || !Number.isFinite(rec[k]))
      throw new Error(`classification rules '${k}' must be a finite number`);
  return raw as ClassificationRules;
}
