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

const failFor =
  (type: ClassifiedShipType) =>
  (
    code: string,
    field: ClassRuleField,
    params: ClassRuleParams,
    message: string,
    suggestion?: string,
  ): ClassRuleFailure => ({
    code,
    field,
    message,
    ...(suggestion ? { suggestion } : {}),
    ruleId: classRuleId(type, field),
    messageKey: classRuleMessageKey(type, field),
    params,
  });

const UM = "um";
const KG = "kg";
const UM_S = "um_s";
const COUNT = "count";

export const classRuleFailures: Record<
  ClassifiedShipType,
  (f: ClassFacts, r: ClassificationRules) => ClassRuleFailure[]
> = {
  DD: (f, r) => {
    const fail = failFor("DD");
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg > 0 && f.displacementKg < r.ddMaxDisplacementKg))
      why.push(
        fail(
          "DD_DISPLACEMENT_LIMIT_EXCEEDED",
          "displacement",
          { value: f.displacementKg, limit: r.ddMaxDisplacementKg, unit: KG },
          `displacement ${f.displacementKg} kg must be below ${r.ddMaxDisplacementKg}`,
          "Reduce the target displacement or fit a lighter armament.",
        ),
      );
    if (!(f.speedUms > r.ddMinSpeedUms))
      why.push(
        fail(
          "DD_SPEED_TOO_LOW",
          "speed",
          { value: f.speedUms, limit: r.ddMinSpeedUms, unit: UM_S },
          `speed must exceed ${r.ddMinSpeedUms} um/s (${knotsText(r.ddMinSpeedUms)} kn)`,
          "Raise installed power or choose a faster plant.",
        ),
      );
    if (f.torpedoTubes < 1)
      why.push(
        fail(
          "DD_TORPEDO_REQUIRED",
          "torpedoes",
          { value: f.torpedoTubes, limit: 1, unit: COUNT },
          "needs at least one usable torpedo tube",
          "Fit a torpedo tube.",
        ),
      );
    if (f.anyQualifyingArmourUm >= r.qualifyingArmourUm)
      why.push(
        fail(
          "DD_QUALIFYING_ARMOR_PROHIBITED",
          "qualifyingArmour",
          { value: f.anyQualifyingArmourUm, limit: r.qualifyingArmourUm, unit: UM },
          `has qualifying armour (>= ${r.qualifyingArmourUm} um)`,
          `Remove armour of ${inchesText(r.qualifyingArmourUm)} inches or more.`,
        ),
      );
    if (f.maxGunUm > r.ddMaxGunUm)
      why.push(
        fail(
          "DD_GUN_TOO_LARGE",
          "mainGun",
          { value: f.maxGunUm, limit: r.ddMaxGunUm, unit: UM },
          `guns must be ${inchesText(r.ddMaxGunUm)} inches or smaller (larger guns are cruiser-scale weapons)`,
          `Use guns of ${inchesText(r.ddMaxGunUm)} inches or less.`,
        ),
      );
    if (f.aircraftCapacity !== 0)
      why.push(
        fail(
          "DD_AIRCRAFT_PROHIBITED",
          "aircraft",
          { value: f.aircraftCapacity, limit: 0, unit: COUNT },
          "aircraft capacity must be 0",
        ),
      );
    return why;
  },
  CL: (f, r) => {
    const fail = failFor("CL");
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg >= r.clMinDisplacementKg && f.displacementKg < r.clMaxDisplacementKg))
      why.push(
        fail(
          "CL_DISPLACEMENT_RANGE",
          "displacement",
          {
            value: f.displacementKg,
            min: r.clMinDisplacementKg,
            max: r.clMaxDisplacementKg,
            unit: KG,
          },
          `displacement must be ${r.clMinDisplacementKg}..${r.clMaxDisplacementKg - 1} kg`,
        ),
      );
    if (!(f.speedUms > r.clMinSpeedUms))
      why.push(
        fail(
          "CL_SPEED_TOO_LOW",
          "speed",
          { value: f.speedUms, limit: r.clMinSpeedUms, unit: UM_S },
          `speed must exceed ${knotsText(r.clMinSpeedUms)} kn`,
          "Raise installed power.",
        ),
      );
    if (!(f.maxMainGunUm <= r.clMaxGunUm) && !isProtectedCruiser(f, r))
      why.push(
        fail(
          "CL_MAIN_CALIBER_EXCEEDED",
          "mainGun",
          { value: f.maxMainGunUm, limit: r.clMaxGunUm, unit: UM },
          `main guns must be ${inchesText(r.clMaxGunUm)} inches or smaller (protected cruisers: single mounts up to ${inchesText(r.clProtectedMaxGunUm)} inches, armour deck, no main belt)`,
          `Use guns of ${inchesText(r.clMaxGunUm)} inches or less, or drop the main belt and fit single ${inchesText(r.clProtectedMaxGunUm)}-inch mounts under an armour deck.`,
        ),
      );
    if (!(f.beltUm <= r.clBeltMaxUm))
      why.push(
        fail(
          "CL_BELT_TOO_THICK",
          "belt",
          { value: f.beltUm, limit: r.clBeltMaxUm, unit: UM },
          `main belt must be ${inchesText(r.clBeltMaxUm)} inches or less (a protected cruiser relies on its armour deck)`,
          `Thin the belt to ${inchesText(r.clBeltMaxUm)} inches or remove it and armour the deck; a belted cruiser is an armoured cruiser.`,
        ),
      );
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(
        fail(
          "CL_AIRCRAFT_LIMIT",
          "aircraft",
          { value: f.aircraftCapacity, limit: r.aircraftLimit, unit: COUNT },
          `aircraft capacity must be below ${r.aircraftLimit}`,
        ),
      );
    return why;
  },
  CA: (f, r) => {
    const fail = failFor("CA");
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg > r.caMinDisplacementKg))
      why.push(
        fail(
          "CA_BOUNDARY_FAILED",
          "displacement",
          { value: f.displacementKg, limit: r.caMinDisplacementKg, unit: KG },
          `displacement must exceed ${r.caMinDisplacementKg} kg`,
        ),
      );
    if (!(f.speedUms > r.caMinSpeedUms))
      why.push(
        fail(
          "CA_BOUNDARY_FAILED",
          "speed",
          { value: f.speedUms, limit: r.caMinSpeedUms, unit: UM_S },
          `speed must exceed ${knotsText(r.caMinSpeedUms)} kn`,
        ),
      );
    if (!(f.beltUm > r.caBeltMinUm && f.beltUm <= r.caBeltMaxUm))
      why.push(
        fail(
          "CA_BOUNDARY_FAILED",
          "belt",
          { value: f.beltUm, min: r.caBeltMinUm, max: r.caBeltMaxUm, unit: UM },
          `main belt must be over ${inchesText(r.caBeltMinUm)} and up to ${inchesText(r.caBeltMaxUm)} inches`,
        ),
      );
    if (!(f.maxMainGunUm > r.clMaxGunUm && f.maxMainGunUm <= r.caGunMaxUm))
      why.push(
        fail(
          "CA_BOUNDARY_FAILED",
          "mainGun",
          { value: f.maxMainGunUm, min: r.clMaxGunUm, max: r.caGunMaxUm, unit: UM },
          `main guns must be over ${inchesText(r.clMaxGunUm)} and up to ${inchesText(r.caGunMaxUm)} inches`,
        ),
      );
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(
        fail(
          "CA_AIRCRAFT_LIMIT",
          "aircraft",
          { value: f.aircraftCapacity, limit: r.aircraftLimit, unit: COUNT },
          `aircraft capacity must be below ${r.aircraftLimit}`,
        ),
      );
    return why;
  },
  B: (f, r) => {
    const fail = failFor("B");
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg >= r.bMinDisplacementKg))
      why.push(
        fail(
          "B_DISPLACEMENT_TOO_LOW",
          "displacement",
          { value: f.displacementKg, limit: r.bMinDisplacementKg, unit: KG },
          `displacement must be at least ${r.bMinDisplacementKg} kg`,
        ),
      );
    if (!(f.beltUm >= r.bBeltMinUm))
      why.push(
        fail(
          "B_BELT_TOO_THIN",
          "belt",
          { value: f.beltUm, limit: r.bBeltMinUm, unit: UM },
          `main belt must be at least ${inchesText(r.bBeltMinUm)} inches`,
          `Thicken the main belt to ${inchesText(r.bBeltMinUm)} inches or more.`,
        ),
      );
    if (!(f.maxMainGunUm > r.clMaxGunUm))
      why.push(
        fail(
          "B_MAIN_GUN_TOO_SMALL",
          "mainGun",
          { value: f.maxMainGunUm, limit: r.clMaxGunUm, unit: UM },
          `main guns must be over ${inchesText(r.clMaxGunUm)} inches`,
        ),
      );
    if (!(f.speedUms < r.bMaxSpeedUms))
      why.push(
        fail(
          "B_SPEED_TOO_HIGH",
          "speed",
          { value: f.speedUms, limit: r.bMaxSpeedUms, unit: UM_S },
          `speed must be below ${knotsText(r.bMaxSpeedUms)} kn`,
          `Lower installed power below the ${knotsText(r.bMaxSpeedUms)}-knot battle-line boundary.`,
        ),
      );
    if (!(f.mainTurretCount >= 1 && f.mainTurretCount <= r.bMaxTurrets))
      why.push(
        fail(
          "B_TURRET_ARRANGEMENT",
          "turrets",
          { value: f.mainTurretCount, min: 1, max: r.bMaxTurrets, unit: COUNT },
          `needs 1 or ${r.bMaxTurrets} main-battery turrets`,
          `Fit one or ${countWord(r.bMaxTurrets)} main-battery mounts; ${countWord(r.bMaxTurrets + 1)} or more is a dreadnought-style arrangement.`,
        ),
      );
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(
        fail(
          "B_AIRCRAFT_LIMIT",
          "aircraft",
          { value: f.aircraftCapacity, limit: r.aircraftLimit, unit: COUNT },
          `aircraft capacity must be below ${r.aircraftLimit}`,
        ),
      );
    return why;
  },
  BB: (f, r) => {
    const fail = failFor("BB");
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg > r.bbMinDisplacementKg))
      why.push(
        fail(
          "BB_DISPLACEMENT_TOO_LOW",
          "displacement",
          { value: f.displacementKg, limit: r.bbMinDisplacementKg, unit: KG },
          `displacement must exceed ${r.bbMinDisplacementKg} kg`,
        ),
      );
    if (!(f.mainTurretCount >= r.bbMinTurrets))
      why.push(
        fail(
          "BB_TURRET_ARRANGEMENT",
          "turrets",
          { value: f.mainTurretCount, limit: r.bbMinTurrets, unit: COUNT },
          `needs at least ${r.bbMinTurrets} main-battery turrets`,
        ),
      );
    if (!(f.beltUm > r.bbBeltMinUm))
      why.push(
        fail(
          "BB_BELT_TOO_THIN",
          "belt",
          { value: f.beltUm, limit: r.bbBeltMinUm, unit: UM },
          `main belt must exceed ${inchesText(r.bbBeltMinUm)} inches`,
        ),
      );
    if (!(f.maxMainGunUm > r.bbGunMinUm))
      why.push(
        fail(
          "BB_MAIN_GUN_TOO_SMALL",
          "mainGun",
          { value: f.maxMainGunUm, limit: r.bbGunMinUm, unit: UM },
          `main guns must exceed ${inchesText(r.bbGunMinUm)} inches`,
        ),
      );
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(
        fail(
          "BB_AIRCRAFT_LIMIT",
          "aircraft",
          { value: f.aircraftCapacity, limit: r.aircraftLimit, unit: COUNT },
          `aircraft capacity must be below ${r.aircraftLimit}`,
        ),
      );
    return why;
  },
  KE: (f, r) => {
    const fail = failFor("KE");
    const why: ClassRuleFailure[] = [];
    if (!(f.displacementKg > 0 && f.displacementKg < r.keMaxDisplacementKg))
      why.push(
        fail(
          "KE_DISPLACEMENT_LIMIT_EXCEEDED",
          "displacement",
          { value: f.displacementKg, limit: r.keMaxDisplacementKg, unit: KG },
          `displacement must be below ${r.keMaxDisplacementKg} kg`,
          "Reduce the target displacement.",
        ),
      );
    if (!(f.beltUm <= r.keBeltMaxUm))
      why.push(
        fail(
          "KE_BELT_TOO_THICK",
          "belt",
          { value: f.beltUm, limit: r.keBeltMaxUm, unit: UM },
          `main belt must be ${inchesText(r.keBeltMaxUm)} inches or less`,
          `Thin the main belt to ${inchesText(r.keBeltMaxUm)} inches or remove it.`,
        ),
      );
    if (!(f.maxGunUm <= r.keGunMaxUm))
      why.push(
        fail(
          "KE_MAIN_GUN_TOO_LARGE",
          "mainGun",
          { value: f.maxGunUm, limit: r.keGunMaxUm, unit: UM },
          `main guns must be ${inchesText(r.keGunMaxUm)} inches or smaller`,
          `Use guns of ${inchesText(r.keGunMaxUm)} inches or less.`,
        ),
      );
    if (f.torpedoTubes > 0)
      why.push(
        fail(
          "KE_TORPEDO_PROHIBITED",
          "torpedoes",
          { value: f.torpedoTubes, limit: 0, unit: COUNT },
          "no torpedo tube may be installed",
          "Remove the torpedo tubes (a torpedo-armed small ship is a destroyer).",
        ),
      );
    if (f.aircraftCapacity !== 0)
      why.push(
        fail(
          "KE_AIRCRAFT_PROHIBITED",
          "aircraft",
          { value: f.aircraftCapacity, limit: 0, unit: COUNT },
          "aircraft capacity must be 0",
        ),
      );
    return why;
  },
  AMC: (f, r) => {
    const fail = failFor("AMC");
    const why: ClassRuleFailure[] = [];
    if (!f.merchantHull)
      why.push(
        fail(
          "AMC_MERCHANT_HULL_REQUIRED",
          "hull",
          { value: f.merchantHull, required: true },
          "needs a merchant-derived hull form",
          "Choose the merchant liner hull form.",
        ),
      );
    if (!(f.displacementKg > r.amcMinDisplacementKg))
      why.push(
        fail(
          "AMC_DISPLACEMENT_TOO_LOW",
          "displacement",
          { value: f.displacementKg, limit: r.amcMinDisplacementKg, unit: KG },
          `displacement must exceed ${r.amcMinDisplacementKg} kg`,
        ),
      );
    if (f.anyQualifyingArmourUm >= r.qualifyingArmourUm)
      why.push(
        fail(
          "AMC_QUALIFYING_ARMOR_PROHIBITED",
          "qualifyingArmour",
          { value: f.anyQualifyingArmourUm, limit: r.qualifyingArmourUm, unit: UM },
          `has qualifying armour (>= ${r.qualifyingArmourUm} um)`,
          `Remove armour of ${inchesText(r.qualifyingArmourUm)} inches or more.`,
        ),
      );
    if (!(f.maxGunUm <= r.amcGunMaxUm))
      why.push(
        fail(
          "AMC_MAIN_GUN_TOO_LARGE",
          "mainGun",
          { value: f.maxGunUm, limit: r.amcGunMaxUm, unit: UM },
          `main guns must be ${inchesText(r.amcGunMaxUm)} inches or smaller`,
          `Use guns of ${inchesText(r.amcGunMaxUm)} inches or less.`,
        ),
      );
    if (f.aircraftCapacity >= r.aircraftLimit)
      why.push(
        fail(
          "AMC_AIRCRAFT_LIMIT",
          "aircraft",
          { value: f.aircraftCapacity, limit: r.aircraftLimit, unit: COUNT },
          `aircraft capacity must be below ${r.aircraftLimit}`,
        ),
      );
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
