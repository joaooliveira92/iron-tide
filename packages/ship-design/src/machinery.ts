import { groupedInteger } from "./numberText.js";
import { quantity } from "./explanation.js";
import { integerRoot } from "@bluewave/deterministic";
import type { Finding } from "./findings.js";
import { sortFindings } from "./findings.js";
import { evaluate, type LookupTable } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import { kg, toSafe, type Kg, type Kw, type Litre } from "./units.js";

/** Propulsion plant (data). Weight/volume per installed kW; part-load specific fuel consumption table. */
export interface PropulsionPlant {
  readonly id: string;
  readonly fuelType: "COAL" | "OIL" | "MIXED";
  readonly weightMilliKgPerKw: number;
  readonly volumeLitrePerKw: number;
  /** Specific fuel consumption in g/kWh versus load in bp of installed power. */
  readonly sfcGramPerKwh: LookupTable;
  readonly reliabilityBp: number;
  readonly minKw: number;
  readonly maxKw: number;
  /** Availability gate; plants without it are always available. */
  readonly introduction?: { readonly fromMonth: string; readonly obsoleteMonth: string | null };
  readonly requires?: readonly string[];
}

export interface MachineryBalance {
  /** Admiralty-style hull coefficient x100 per form (e.g. 17500 = 175.00). */
  readonly cFormX100: Readonly<Record<string, number>>;
  /** Speed-length ratio x1000 above which the coefficient degrades. */
  readonly slr0X1000: number;
  /** bp of coefficient lost per (SLR unit)^2 above slr0. */
  readonly kSlBp: number;
  /** The coefficient never falls below this fraction (bp) of its base. */
  readonly cFloorBp: number;
  /** SLR x1000 at/after which HULL_DRIVEN_BEYOND_FORM is reported. */
  readonly slrMaxX1000: number;
  readonly minSpeedMilliKnots: number;
  readonly maxSpeedMilliKnots: number;
  readonly kwPerShpBp: number; // 7457
  readonly auxWeightBp: number; // piping/aux as bp of plant weight
  /** Fraction of fuel unusable + reserved, bp. */
  readonly fuelUnusableBp: number;
  readonly fuelReserveBp: number;
  /** Bunker volume per kg of fuel, bp of a litre (10_000 = 1 L/kg). Welsh coal stows at about 40 ft3 per long ton = 11_148. */
  readonly bunkerLitreBpPerKg: number;
  /**
   * Engine priority swings, bp of the base value at full priority (+/-10_000). Positive priority = speed-optimised
   * (lighter plant, more effective power, less reliable); negative = reliability-optimised (the reverse). BALANCE TARGETs
   * (ADR-0213), authored in the ruleset; absent = 0 = the axis has no effect.
   */
  readonly enginePriorityWeightSwingBp?: number;
  readonly enginePriorityPowerSwingBp?: number;
  readonly enginePriorityReliabilitySwingBp?: number;
  /** Below this plant reliability (bp) a speed-optimised plant raises ENGINE_PRIORITY_BREAKDOWN_RISK. Absent = never. */
  readonly enginePriorityReliabilityWarnBp?: number;
}

export interface MachineryInput {
  readonly plant: PropulsionPlant;
  readonly installedKw: number;
  readonly hullFormId: string;
  readonly lengthWlMm: number;
  readonly displacementKg: number;
  /** Hull fouling / age loss of coefficient, bp. */
  readonly foulingBp: number;
  readonly fuelCapacityKg: number;
  readonly cruiseSpeedMilliKnots: number;
  readonly requiredSpeedMilliKnots: number;
  readonly requiredRangeNm: number;
  /** Speed <-> reliability axis in bp, -10_000 (reliability) .. +10_000 (speed); absent or 0 = balanced. */
  readonly enginePriorityBp?: number;
}

export interface MachineryResult {
  /** Plant reliability after the engine-priority trade, bp. */
  readonly reliabilityBp: number;
  readonly plantWeightKg: Kg;
  readonly plantVolumeLitre: Litre;
  readonly bunkerVolumeLitre: Litre;
  readonly installedKw: Kw;
  readonly maxSpeedMilliKnots: number;
  readonly requiredKwAtMax: number;
  readonly cruiseKw: number;
  readonly cruiseKgPerHour: number;
  readonly rangeNmAtCruise: number;
  readonly economicalSpeedMilliKnots: number;
  readonly economicalRangeNm: number;
  readonly findings: readonly Finding[];
}

const BP = 10_000n;
const E9 = 1_000_000_000n;

function enginePriority(i: MachineryInput): bigint {
  const p = i.enginePriorityBp ?? 0;
  if (!Number.isSafeInteger(p) || p < -10_000 || p > 10_000)
    throw new Error(`enginePriorityBp must be an integer in -10000..10000, got ${p}`);
  return BigInt(p);
}

/** `base` moved by `swingBp` of itself per full priority, `sign` +1 raising it and -1 lowering it. Truncates toward zero. */
function swung(
  base: bigint,
  i: MachineryInput,
  swingBp: number | undefined,
  sign: 1n | -1n,
): bigint {
  return base + (sign * base * enginePriority(i) * BigInt(swingBp ?? 0)) / (BP * BP);
}

/** Installed power as the speed model sees it: a speed-optimised plant delivers more of its rated kW. */
const effectiveKw = (i: MachineryInput, b: MachineryBalance): number =>
  toSafe("effectiveKw", swung(BigInt(i.installedKw), i, b.enginePriorityPowerSwingBp, 1n));

/** SLR x1000 = V_knots / sqrt(L_ft) * 1000. */
export function speedLengthRatioX1000(speedMilliKnots: number, lengthMm: number): number {
  const sqrtLftX1000 = integerRoot((BigInt(lengthMm) * 10_000_000n) / 3048n, 2);
  if (sqrtLftX1000 === 0n) return 0;
  return toSafe("slr", (BigInt(speedMilliKnots) * 1000n) / sqrtLftX1000);
}

export function effectiveCoefficientX100(
  i: MachineryInput,
  b: MachineryBalance,
  speedMilliKnots: number,
): number {
  const base = b.cFormX100[i.hullFormId];
  if (base === undefined) throw new Error(`unknown hull form coefficient '${i.hullFormId}'`);
  const slr = speedLengthRatioX1000(speedMilliKnots, i.lengthWlMm);
  const excess = BigInt(Math.max(0, slr - b.slr0X1000));
  const penaltyBp = Math.min(
    Number(BP) - b.cFloorBp,
    Number((BigInt(b.kSlBp) * excess * excess) / 1_000_000n),
  );
  let c = (BigInt(base) * BigInt(Number(BP) - penaltyBp)) / BP;
  c = (c * BigInt(Math.max(0, Number(BP) - i.foulingBp))) / BP;
  return Math.max(1, Number(c));
}

/** F-M1: required shaft power in kW (ceil) to hold the given speed. */
export function requiredKw(
  i: MachineryInput,
  b: MachineryBalance,
  speedMilliKnots: number,
): number {
  const d23 = integerRoot(BigInt(i.displacementKg) ** 2n, 3);
  const v = BigInt(speedMilliKnots);
  const c = BigInt(effectiveCoefficientX100(i, b, speedMilliKnots));
  const num = d23 * v ** 3n * BigInt(b.kwPerShpBp);
  const den = E9 * BP * c;
  return toSafe("requiredKw", (num + den - 1n) / den);
}

/** F-M2: highest speed (milli-knots) whose required power fits the installed power; monotone bisection. */
export function maxSpeed(i: MachineryInput, b: MachineryBalance): number {
  let lo = 0;
  let hi = b.maxSpeedMilliKnots;
  const available = effectiveKw(i, b);
  if (requiredKw(i, b, hi) <= available) return hi;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (requiredKw(i, b, mid) <= available) lo = mid;
    else hi = mid;
  }
  return lo;
}

function kgPerHour(
  i: MachineryInput,
  b: MachineryBalance,
  speedMilliKnots: number,
): { kw: number; kgph: number } {
  const kw = requiredKw(i, b, speedMilliKnots);
  const loadBp =
    i.installedKw === 0
      ? 0
      : Math.min(Number(BP), toSafe("load", (BigInt(kw) * BP) / BigInt(i.installedKw)));
  const sfc = evaluate(parseFormula("lookup(sfc, load)"), {
    vars: { load: loadBp },
    tables: { sfc: i.plant.sfcGramPerKwh },
  });
  return { kw, kgph: toSafe("kgph", (BigInt(kw) * BigInt(sfc) + 999n) / 1000n) };
}

function rangeNm(i: MachineryInput, b: MachineryBalance, speedMilliKnots: number): number {
  const { kgph } = kgPerHour(i, b, speedMilliKnots);
  if (kgph === 0) return 0;
  const usableBp = Number(BP) - b.fuelUnusableBp - b.fuelReserveBp;
  const usableKg = (BigInt(i.fuelCapacityKg) * BigInt(Math.max(0, usableBp))) / BP;
  // nm = usableKg / kgph * knots
  return toSafe("range", (usableKg * BigInt(speedMilliKnots)) / (BigInt(kgph) * 1000n));
}

const fmt = (n: number) => groupedInteger(n);

export function compileMachinery(i: MachineryInput, b: MachineryBalance): MachineryResult {
  const findings: Finding[] = [];
  const p = i.plant;

  if (i.installedKw <= 0 || i.installedKw < p.minKw || i.installedKw > p.maxKw) {
    findings.push({
      id: i.installedKw <= 0 ? "NO_PROPULSION" : "PLANT_SIZE_RANGE",
      severity: "BLOCKING",
      what:
        i.installedKw <= 0
          ? "The ship has no propulsion."
          : `Installed power ${fmt(i.installedKw)} kW is outside the ${p.id} plant range.`,
      why: `Plant range ${fmt(p.minKw)}-${fmt(p.maxKw)} kW; installed ${fmt(i.installedKw)} kW.`,
      consequence: "The ship cannot be built or cannot move.",
      remedies: [
        {
          id: "set_power",
          description: `Set installed power within ${fmt(p.minKw)}-${fmt(p.maxKw)} kW.`,
        },
        { id: "other_plant", description: "Choose a plant type sized for this power." },
        { id: "split_plants", description: "Use several smaller plants on separate shafts." },
      ],
      evidence: {
        formulaId: "F-M2",
        inputs: { installedKw: i.installedKw },
        threshold: i.installedKw <= 0 ? 1 : i.installedKw < p.minKw ? p.minKw : p.maxKw,
        value: i.installedKw,
      },
    });
  }
  if (
    i.requiredSpeedMilliKnots < b.minSpeedMilliKnots ||
    i.requiredSpeedMilliKnots > b.maxSpeedMilliKnots
  ) {
    findings.push({
      id: "SPEED_OUT_OF_RANGE",
      severity: "BLOCKING",
      what: [
        "Required speed ",
        quantity(i.requiredSpeedMilliKnots, 1000, 1, "knots"),
        " is outside the modelled range.",
      ],
      why: [
        "Model range ",
        quantity(b.minSpeedMilliKnots, 1000, 1),
        "-",
        quantity(b.maxSpeedMilliKnots, 1000, 1),
        " kn.",
      ],
      consequence: "The power model is not valid at this speed.",
      remedies: [
        { id: "clamp_speed", description: "Set the speed requirement within the modelled range." },
        { id: "other_category", description: "Pick a category whose speed band matches." },
        {
          id: "split_requirement",
          description: "Express the goal as cruise and top speed separately.",
        },
      ],
      evidence: {
        formulaId: "F-M1",
        inputs: {},
        threshold:
          i.requiredSpeedMilliKnots < b.minSpeedMilliKnots
            ? b.minSpeedMilliKnots
            : b.maxSpeedMilliKnots,
        value: i.requiredSpeedMilliKnots,
      },
    });
  }
  const baseWeightMilliKgPerKw = BigInt(p.weightMilliKgPerKw);
  const plantWeightKg = kg(
    toSafe(
      "plantWeight",
      (BigInt(i.installedKw) *
        swung(baseWeightMilliKgPerKw, i, b.enginePriorityWeightSwingBp, -1n) *
        (BP + BigInt(b.auxWeightBp)) +
        1000n * BP -
        1n) /
        (1000n * BP),
    ),
  );
  const reliabilityBp = Math.max(
    0,
    Math.min(
      10_000,
      Number(swung(BigInt(p.reliabilityBp), i, b.enginePriorityReliabilitySwingBp, -1n)),
    ),
  );
  const plantVolumeLitre = toSafe(
    "plantVol",
    BigInt(i.installedKw) * BigInt(p.volumeLitrePerKw),
  ) as Litre;
  const bunkerVolumeLitre = toSafe(
    "bunkerVol",
    (BigInt(i.fuelCapacityKg) * BigInt(b.bunkerLitreBpPerKg) + BP - 1n) / BP,
  ) as Litre;

  if (
    b.enginePriorityReliabilityWarnBp !== undefined &&
    enginePriority(i) > 0n &&
    reliabilityBp < b.enginePriorityReliabilityWarnBp
  ) {
    findings.push({
      id: "ENGINE_PRIORITY_BREAKDOWN_RISK",
      severity: "WARNING",
      what: "The engine priority favours speed at the cost of reliability.",
      why: `Plant reliability ${fmt(reliabilityBp)} bp (${p.id} base ${fmt(p.reliabilityBp)} bp) is below ${fmt(b.enginePriorityReliabilityWarnBp)} bp at priority ${fmt(i.enginePriorityBp ?? 0)}.`,
      consequence: "The machinery is more likely to break down, costing speed and availability.",
      remedies: [
        {
          id: "less_speed_priority",
          description: "Move the engine priority toward balanced or reliability.",
        },
        { id: "more_power", description: "Install more power instead of tuning for speed." },
      ],
      evidence: {
        formulaId: "F-M2",
        inputs: { enginePriorityBp: i.enginePriorityBp ?? 0 },
        threshold: b.enginePriorityReliabilityWarnBp,
        value: reliabilityBp,
      },
    });
  }

  if (findings.some((f) => f.severity === "BLOCKING")) {
    return {
      plantWeightKg,
      plantVolumeLitre,
      bunkerVolumeLitre,
      installedKw: i.installedKw as Kw,
      reliabilityBp,
      maxSpeedMilliKnots: 0,
      requiredKwAtMax: 0,
      cruiseKw: 0,
      cruiseKgPerHour: 0,
      rangeNmAtCruise: 0,
      economicalSpeedMilliKnots: 0,
      economicalRangeNm: 0,
      findings: sortFindings(findings),
    };
  }

  const vmax = maxSpeed(i, b);
  const requiredKwAtMax = requiredKw(i, b, vmax);
  const cruise = kgPerHour(i, b, i.cruiseSpeedMilliKnots);
  const cruiseRange = rangeNm(i, b, i.cruiseSpeedMilliKnots);

  // Economical speed: most nm per kg of fuel, scanned in 1-knot steps (ties -> lower speed).
  let ecoSpeed = b.minSpeedMilliKnots;
  let bestNmPerKg = -1n;
  for (let s = b.minSpeedMilliKnots; s <= vmax; s += 1000) {
    const { kgph } = kgPerHour(i, b, s);
    if (kgph === 0) continue;
    const score = (BigInt(s) * 1_000_000n) / BigInt(kgph);
    if (score > bestNmPerKg) {
      bestNmPerKg = score;
      ecoSpeed = s;
    }
  }
  const ecoRange = rangeNm(i, b, ecoSpeed);

  if (vmax < i.requiredSpeedMilliKnots) {
    findings.push({
      id: "PLANT_INSUFFICIENT",
      severity: "WARNING",
      what: [
        "Top speed ",
        quantity(vmax, 1000, 1, "knots"),
        " falls short of the required ",
        quantity(i.requiredSpeedMilliKnots, 1000, 1, "knots"),
        ".",
      ],
      why: `${fmt(i.installedKw)} kW installed; ${fmt(requiredKw(i, b, i.requiredSpeedMilliKnots))} kW needed at the required speed for ${fmt(i.displacementKg)} kg.`,
      consequence:
        "The ship cannot fulfil its intended role in speed and may be outrun by its adversaries.",
      remedies: [
        {
          id: "more_power",
          description: `Install about ${fmt(requiredKw(i, b, i.requiredSpeedMilliKnots) - i.installedKw)} kW more (adds plant weight and fuel burn).`,
        },
        { id: "lighter_ship", description: "Reduce displacement: armour, armament or fuel." },
        { id: "finer_hull", description: "Lengthen the hull or choose a finer hull form." },
        { id: "lower_requirement", description: "Lower the speed requirement." },
      ],
      evidence: {
        formulaId: "F-M1",
        inputs: { installedKw: i.installedKw },
        threshold: i.requiredSpeedMilliKnots,
        value: vmax,
      },
    });
  }
  if (cruiseRange < i.requiredRangeNm) {
    findings.push({
      id: "RANGE_BELOW_REQUIREMENT",
      severity: "WARNING",
      what: [
        `Range ${fmt(cruiseRange)} nm at `,
        quantity(i.cruiseSpeedMilliKnots, 1000, 1, "knots"),
        ` is below the required ${fmt(i.requiredRangeNm)} nm.`,
      ],
      why: `Usable fuel ${fmt(Math.floor((i.fuelCapacityKg * (10_000 - b.fuelUnusableBp - b.fuelReserveBp)) / 10_000))} kg burns ${fmt(cruise.kgph)} kg/h.`,
      consequence: "The ship depends on nearby bases and cannot operate far from them.",
      remedies: [
        { id: "more_fuel", description: "Carry more fuel (adds weight and bunker volume)." },
        {
          id: "slower_cruise",
          description: [
            "Cruise at the economical ",
            quantity(ecoSpeed, 1000, 1, "knots"),
            ` for ${fmt(ecoRange)} nm.`,
          ],
        },
        { id: "efficient_plant", description: "Use a more fuel-efficient plant type." },
        { id: "lower_requirement", description: "Lower the range requirement." },
      ],
      evidence: {
        formulaId: "F-M3",
        inputs: { fuelCapacityKg: i.fuelCapacityKg },
        threshold: i.requiredRangeNm,
        value: cruiseRange,
      },
    });
  }
  const slrMax = speedLengthRatioX1000(vmax, i.lengthWlMm);
  if (slrMax >= b.slrMaxX1000) {
    findings.push({
      id: "HULL_DRIVEN_BEYOND_FORM",
      severity: "WARNING",
      what: "The hull is driven far beyond its natural speed.",
      why: [
        "Speed-length ratio ",
        quantity(slrMax, 1000, 2),
        " at top speed; limit ",
        quantity(b.slrMaxX1000, 1000, 2),
        ".",
      ],
      consequence:
        "Power demand climbs steeply for little extra speed; wet and uncomfortable in a seaway.",
      remedies: [
        { id: "lengthen", description: "Lengthen the hull." },
        { id: "reduce_power", description: "Accept a lower top speed with less machinery." },
        { id: "finer_form", description: "Choose a finer hull form." },
      ],
      evidence: { formulaId: "F-M1", inputs: { vmax }, threshold: b.slrMaxX1000, value: slrMax },
    });
  }

  return {
    plantWeightKg,
    plantVolumeLitre,
    bunkerVolumeLitre,
    installedKw: i.installedKw as Kw,
    reliabilityBp,
    maxSpeedMilliKnots: vmax,
    requiredKwAtMax,
    cruiseKw: cruise.kw,
    cruiseKgPerHour: cruise.kgph,
    rangeNmAtCruise: cruiseRange,
    economicalSpeedMilliKnots: ecoSpeed,
    economicalRangeNm: ecoRange,
    findings: sortFindings(findings),
  };
}
