import { DESIGN_22_CLASS_FLOORS } from "@bluewave/contracts";
import { UM_PER_INCH, UM_PER_KNOT } from "./units.js";
import { designInvariant } from "./errors.js";

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
  ...DESIGN_22_CLASS_FLOORS,
  rulesetVersion: 1,
  ddMaxDisplacementKg: 2_000_000,
  ddMinSpeedUms: 19 * UM_PER_KNOT + 1 - 1,
  ddMaxGunUm: 6 * UM_PER_INCH,
  qualifyingArmourUm: 2 * UM_PER_INCH,
  clMaxDisplacementKg: 8_000_000,
  clMinSpeedUms: 16 * UM_PER_KNOT,
  clMaxGunUm: 6 * UM_PER_INCH,
  clBeltMaxUm: 2 * UM_PER_INCH,
  protectedCruiserExceptionVersion: 1,
  clProtectedMaxGunUm: 8 * UM_PER_INCH,
  caMinSpeedUms: 19 * UM_PER_KNOT,
  caBeltMaxUm: 12 * UM_PER_INCH,
  caGunMaxUm: 11 * UM_PER_INCH,
  bMaxTurrets: 2,
  bbMinTurrets: 3,
  aircraftLimit: 4,
  keMaxDisplacementKg: 2_500_000,
  keBeltMaxUm: 2 * UM_PER_INCH,
  keGunMaxUm: 6 * UM_PER_INCH,
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

export type ClassRuleParams = Readonly<Record<string, string | number | boolean>>;

export interface ClassRuleFailure {
  readonly code: string;
  readonly field: ClassRuleField;
  readonly message: string;
  readonly suggestion?: string;
  readonly ruleId: string;
  readonly messageKey: string;
  readonly params: ClassRuleParams;
}

const scaled = (value: number, per: number): string => {
  const hundredths = Math.round((value * 100) / per);
  const whole = Math.trunc(hundredths / 100);
  const frac = hundredths % 100;
  if (frac === 0) return String(whole);
  return `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
};
export const inchesText = (um: number): string => scaled(um, UM_PER_INCH);
export const knotsText = (ums: number): string => scaled(ums, UM_PER_KNOT);
const COUNT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n);

export const classRuleId = (type: ClassifiedShipType, field: ClassRuleField): string =>
  `DESIGN-22.${type}.${field}`;
export const classRuleMessageKey = (type: ClassifiedShipType, field: ClassRuleField): string =>
  `design.classification.${type.toLowerCase()}.${field}`;

const UNITS: Record<ClassRuleField, string> = {
  displacement: "kg",
  speed: "um_s",
  belt: "um",
  qualifyingArmour: "um",
  mainGun: "um",
  turrets: "count",
  torpedoes: "count",
  aircraft: "count",
  hull: "",
};

type Fail = (
  bad: boolean,
  code: string,
  field: ClassRuleField,
  [value, a, b]: readonly [number, number, number?],
  message: string,
  suggestion?: string,
) => void;

const collector = (type: ClassifiedShipType): readonly [ClassRuleFailure[], Fail] => {
  const why: ClassRuleFailure[] = [];
  return [
    why,
    (bad, code, field, [value, a, b], message, suggestion) => {
      if (bad)
        why.push({
          code,
          field,
          message,
          ...(suggestion ? { suggestion } : {}),
          ruleId: classRuleId(type, field),
          messageKey: classRuleMessageKey(type, field),
          params:
            field === "hull"
              ? { value: false, required: true }
              : b === undefined
                ? { value, limit: a, unit: UNITS[field] }
                : { value, min: a, max: b, unit: UNITS[field] },
        });
    },
  ];
};

const aircraftLimit = (
  fail: Fail,
  type: ClassifiedShipType,
  f: ClassFacts,
  r: ClassificationRules,
): void =>
  fail(
    f.aircraftCapacity >= r.aircraftLimit,
    `${type}_AIRCRAFT_LIMIT`,
    "aircraft",
    [f.aircraftCapacity, r.aircraftLimit],
    `aircraft capacity must be below ${r.aircraftLimit}`,
  );

const noAircraft = (fail: Fail, type: ClassifiedShipType, f: ClassFacts): void =>
  fail(
    f.aircraftCapacity !== 0,
    `${type}_AIRCRAFT_PROHIBITED`,
    "aircraft",
    [f.aircraftCapacity, 0],
    "aircraft capacity must be 0",
  );

export const classRuleFailures: Record<
  ClassifiedShipType,
  (f: ClassFacts, r: ClassificationRules) => ClassRuleFailure[]
> = {
  DD: (f, r) => {
    const [why, fail] = collector("DD");
    fail(
      !(f.displacementKg > 0 && f.displacementKg < r.ddMaxDisplacementKg),
      "DD_DISPLACEMENT_LIMIT_EXCEEDED",
      "displacement",
      [f.displacementKg, r.ddMaxDisplacementKg],
      `displacement ${f.displacementKg} kg must be below ${r.ddMaxDisplacementKg}`,
      "Reduce the target displacement or fit a lighter armament.",
    );
    fail(
      !(f.speedUms > r.ddMinSpeedUms),
      "DD_SPEED_TOO_LOW",
      "speed",
      [f.speedUms, r.ddMinSpeedUms],
      `speed must exceed ${r.ddMinSpeedUms} um/s (${knotsText(r.ddMinSpeedUms)} kn)`,
      "Raise installed power or choose a faster plant.",
    );
    fail(
      f.torpedoTubes < 1,
      "DD_TORPEDO_REQUIRED",
      "torpedoes",
      [f.torpedoTubes, 1],
      "needs at least one usable torpedo tube",
      "Fit a torpedo tube.",
    );
    fail(
      f.anyQualifyingArmourUm >= r.qualifyingArmourUm,
      "DD_QUALIFYING_ARMOR_PROHIBITED",
      "qualifyingArmour",
      [f.anyQualifyingArmourUm, r.qualifyingArmourUm],
      `has qualifying armour (>= ${r.qualifyingArmourUm} um)`,
      `Remove armour of ${inchesText(r.qualifyingArmourUm)} inches or more.`,
    );
    fail(
      f.maxGunUm > r.ddMaxGunUm,
      "DD_GUN_TOO_LARGE",
      "mainGun",
      [f.maxGunUm, r.ddMaxGunUm],
      `guns must be ${inchesText(r.ddMaxGunUm)} inches or smaller (larger guns are cruiser-scale weapons)`,
      `Use guns of ${inchesText(r.ddMaxGunUm)} inches or less.`,
    );
    noAircraft(fail, "DD", f);
    return why;
  },
  CL: (f, r) => {
    const [why, fail] = collector("CL");
    fail(
      !(f.displacementKg >= r.clMinDisplacementKg && f.displacementKg < r.clMaxDisplacementKg),
      "CL_DISPLACEMENT_RANGE",
      "displacement",
      [f.displacementKg, r.clMinDisplacementKg, r.clMaxDisplacementKg],
      `displacement must be ${r.clMinDisplacementKg}..${r.clMaxDisplacementKg - 1} kg`,
    );
    fail(
      !(f.speedUms > r.clMinSpeedUms),
      "CL_SPEED_TOO_LOW",
      "speed",
      [f.speedUms, r.clMinSpeedUms],
      `speed must exceed ${knotsText(r.clMinSpeedUms)} kn`,
      "Raise installed power.",
    );
    fail(
      !(f.maxMainGunUm <= r.clMaxGunUm) && !isProtectedCruiser(f, r),
      "CL_MAIN_CALIBER_EXCEEDED",
      "mainGun",
      [f.maxMainGunUm, r.clMaxGunUm],
      `main guns must be ${inchesText(r.clMaxGunUm)} inches or smaller (protected cruisers: single mounts up to ${inchesText(r.clProtectedMaxGunUm)} inches, armour deck, no main belt)`,
      `Use guns of ${inchesText(r.clMaxGunUm)} inches or less, or drop the main belt and fit single ${inchesText(r.clProtectedMaxGunUm)}-inch mounts under an armour deck.`,
    );
    fail(
      !(f.beltUm <= r.clBeltMaxUm),
      "CL_BELT_TOO_THICK",
      "belt",
      [f.beltUm, r.clBeltMaxUm],
      `main belt must be ${inchesText(r.clBeltMaxUm)} inches or less (a protected cruiser relies on its armour deck)`,
      `Thin the belt to ${inchesText(r.clBeltMaxUm)} inches or remove it and armour the deck; a belted cruiser is an armoured cruiser.`,
    );
    aircraftLimit(fail, "CL", f, r);
    return why;
  },
  CA: (f, r) => {
    const [why, fail] = collector("CA");
    fail(
      !(f.displacementKg > r.caMinDisplacementKg),
      "CA_BOUNDARY_FAILED",
      "displacement",
      [f.displacementKg, r.caMinDisplacementKg],
      `displacement must exceed ${r.caMinDisplacementKg} kg`,
    );
    fail(
      !(f.speedUms > r.caMinSpeedUms),
      "CA_BOUNDARY_FAILED",
      "speed",
      [f.speedUms, r.caMinSpeedUms],
      `speed must exceed ${knotsText(r.caMinSpeedUms)} kn`,
    );
    fail(
      !(f.beltUm > r.caBeltMinUm && f.beltUm <= r.caBeltMaxUm),
      "CA_BOUNDARY_FAILED",
      "belt",
      [f.beltUm, r.caBeltMinUm, r.caBeltMaxUm],
      `main belt must be over ${inchesText(r.caBeltMinUm)} and up to ${inchesText(r.caBeltMaxUm)} inches`,
    );
    fail(
      !(f.maxMainGunUm > r.clMaxGunUm && f.maxMainGunUm <= r.caGunMaxUm),
      "CA_BOUNDARY_FAILED",
      "mainGun",
      [f.maxMainGunUm, r.clMaxGunUm, r.caGunMaxUm],
      `main guns must be over ${inchesText(r.clMaxGunUm)} and up to ${inchesText(r.caGunMaxUm)} inches`,
    );
    aircraftLimit(fail, "CA", f, r);
    return why;
  },
  B: (f, r) => {
    const [why, fail] = collector("B");
    fail(
      !(f.displacementKg >= r.bMinDisplacementKg),
      "B_DISPLACEMENT_TOO_LOW",
      "displacement",
      [f.displacementKg, r.bMinDisplacementKg],
      `displacement must be at least ${r.bMinDisplacementKg} kg`,
    );
    fail(
      !(f.beltUm >= r.bBeltMinUm),
      "B_BELT_TOO_THIN",
      "belt",
      [f.beltUm, r.bBeltMinUm],
      `main belt must be at least ${inchesText(r.bBeltMinUm)} inches`,
      `Thicken the main belt to ${inchesText(r.bBeltMinUm)} inches or more.`,
    );
    fail(
      !(f.maxMainGunUm > r.clMaxGunUm),
      "B_MAIN_GUN_TOO_SMALL",
      "mainGun",
      [f.maxMainGunUm, r.clMaxGunUm],
      `main guns must be over ${inchesText(r.clMaxGunUm)} inches`,
    );
    fail(
      !(f.speedUms < r.bMaxSpeedUms),
      "B_SPEED_TOO_HIGH",
      "speed",
      [f.speedUms, r.bMaxSpeedUms],
      `speed must be below ${knotsText(r.bMaxSpeedUms)} kn`,
      `Lower installed power below the ${knotsText(r.bMaxSpeedUms)}-knot battle-line boundary.`,
    );
    fail(
      !(f.mainTurretCount >= 1 && f.mainTurretCount <= r.bMaxTurrets),
      "B_TURRET_ARRANGEMENT",
      "turrets",
      [f.mainTurretCount, 1, r.bMaxTurrets],
      `needs 1 or ${r.bMaxTurrets} main-battery turrets`,
      `Fit one or ${countWord(r.bMaxTurrets)} main-battery mounts; ${countWord(r.bMaxTurrets + 1)} or more is a dreadnought-style arrangement.`,
    );
    aircraftLimit(fail, "B", f, r);
    return why;
  },
  BB: (f, r) => {
    const [why, fail] = collector("BB");
    fail(
      !(f.displacementKg > r.bbMinDisplacementKg),
      "BB_DISPLACEMENT_TOO_LOW",
      "displacement",
      [f.displacementKg, r.bbMinDisplacementKg],
      `displacement must exceed ${r.bbMinDisplacementKg} kg`,
    );
    fail(
      !(f.mainTurretCount >= r.bbMinTurrets),
      "BB_TURRET_ARRANGEMENT",
      "turrets",
      [f.mainTurretCount, r.bbMinTurrets],
      `needs at least ${r.bbMinTurrets} main-battery turrets`,
    );
    fail(
      !(f.beltUm > r.bbBeltMinUm),
      "BB_BELT_TOO_THIN",
      "belt",
      [f.beltUm, r.bbBeltMinUm],
      `main belt must exceed ${inchesText(r.bbBeltMinUm)} inches`,
    );
    fail(
      !(f.maxMainGunUm > r.bbGunMinUm),
      "BB_MAIN_GUN_TOO_SMALL",
      "mainGun",
      [f.maxMainGunUm, r.bbGunMinUm],
      `main guns must exceed ${inchesText(r.bbGunMinUm)} inches`,
    );
    aircraftLimit(fail, "BB", f, r);
    return why;
  },
  KE: (f, r) => {
    const [why, fail] = collector("KE");
    fail(
      !(f.displacementKg > 0 && f.displacementKg < r.keMaxDisplacementKg),
      "KE_DISPLACEMENT_LIMIT_EXCEEDED",
      "displacement",
      [f.displacementKg, r.keMaxDisplacementKg],
      `displacement must be below ${r.keMaxDisplacementKg} kg`,
      "Reduce the target displacement.",
    );
    fail(
      !(f.beltUm <= r.keBeltMaxUm),
      "KE_BELT_TOO_THICK",
      "belt",
      [f.beltUm, r.keBeltMaxUm],
      `main belt must be ${inchesText(r.keBeltMaxUm)} inches or less`,
      `Thin the main belt to ${inchesText(r.keBeltMaxUm)} inches or remove it.`,
    );
    fail(
      !(f.maxGunUm <= r.keGunMaxUm),
      "KE_MAIN_GUN_TOO_LARGE",
      "mainGun",
      [f.maxGunUm, r.keGunMaxUm],
      `main guns must be ${inchesText(r.keGunMaxUm)} inches or smaller`,
      `Use guns of ${inchesText(r.keGunMaxUm)} inches or less.`,
    );
    fail(
      f.torpedoTubes > 0,
      "KE_TORPEDO_PROHIBITED",
      "torpedoes",
      [f.torpedoTubes, 0],
      "no torpedo tube may be installed",
      "Remove the torpedo tubes (a torpedo-armed small ship is a destroyer).",
    );
    noAircraft(fail, "KE", f);
    return why;
  },
  AMC: (f, r) => {
    const [why, fail] = collector("AMC");
    fail(
      !f.merchantHull,
      "AMC_MERCHANT_HULL_REQUIRED",
      "hull",
      [0, 0],
      "needs a merchant-derived hull form",
      "Choose the merchant liner hull form.",
    );
    fail(
      !(f.displacementKg > r.amcMinDisplacementKg),
      "AMC_DISPLACEMENT_TOO_LOW",
      "displacement",
      [f.displacementKg, r.amcMinDisplacementKg],
      `displacement must exceed ${r.amcMinDisplacementKg} kg`,
    );
    fail(
      f.anyQualifyingArmourUm >= r.qualifyingArmourUm,
      "AMC_QUALIFYING_ARMOR_PROHIBITED",
      "qualifyingArmour",
      [f.anyQualifyingArmourUm, r.qualifyingArmourUm],
      `has qualifying armour (>= ${r.qualifyingArmourUm} um)`,
      `Remove armour of ${inchesText(r.qualifyingArmourUm)} inches or more.`,
    );
    fail(
      !(f.maxGunUm <= r.amcGunMaxUm),
      "AMC_MAIN_GUN_TOO_LARGE",
      "mainGun",
      [f.maxGunUm, r.amcGunMaxUm],
      `main guns must be ${inchesText(r.amcGunMaxUm)} inches or smaller`,
      `Use guns of ${inchesText(r.amcGunMaxUm)} inches or less.`,
    );
    aircraftLimit(fail, "AMC", f, r);
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
    throw designInvariant("classification rules must be an object");
  const rec = raw as Record<string, unknown>;
  for (const k of CLASSIFICATION_RULE_KEYS)
    if (typeof rec[k] !== "number" || !Number.isFinite(rec[k]))
      throw designInvariant(`classification rules '${k}' must be a finite number`);
  return raw as ClassificationRules;
}

export interface ClassificationEra {
  readonly fromMonth: string;
  readonly classification: ClassificationRules;
}

const ERA_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function classificationErasFromRecord(raw: unknown): readonly ClassificationEra[] {
  if (!Array.isArray(raw)) throw designInvariant("classificationFromMonth must be a list");
  let previous = "";
  return raw.map((entry: unknown) => {
    if (entry === null || typeof entry !== "object")
      throw designInvariant("classificationFromMonth entries must be objects");
    const rec = entry as Record<string, unknown>;
    const fromMonth = rec["fromMonth"];
    if (typeof fromMonth !== "string" || !ERA_MONTH.test(fromMonth))
      throw designInvariant("classificationFromMonth fromMonth must be YYYY-MM");
    if (fromMonth <= previous)
      throw designInvariant("classificationFromMonth must be in ascending order of fromMonth");
    previous = fromMonth;
    try {
      return { fromMonth, classification: classificationRulesFromRecord(rec["classification"]) };
    } catch (e) {
      throw designInvariant(
        `classificationFromMonth ${fromMonth}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });
}

export function classificationRulesForMonth(
  balance: {
    readonly classification?: ClassificationRules;
    readonly classificationFromMonth?: readonly ClassificationEra[];
  },
  month: string,
): ClassificationRules | undefined {
  let rules = balance.classification;
  for (const era of balance.classificationFromMonth ?? []) {
    if (era.fromMonth <= month) rules = era.classification;
  }
  return rules;
}
