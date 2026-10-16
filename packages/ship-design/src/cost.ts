import type { CompiledDesign, DesignDraft } from "./compile.js";
import type { RoundingMode } from "@bluewave/contracts";
import { evaluate, type LookupTable } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import { speedLengthRatioX1000 } from "./machinery.js";
import { toSafe, UnitError, money, type BudgetMicro, type Money } from "./units.js";

export interface CostBalance {
  /** Micro-units per tonne of hull structure, by hull material. */
  readonly hullCostPerTonneMicro: Readonly<Record<string, number>>;
  readonly formComplexityBp: Readonly<Record<string, number>>;
  readonly subdivisionComplexityBp: readonly [number, number, number, number, number];
  /** Speed-length ratio x1000 at top speed -> hull complexity multiplier bp (10_000 = none). */
  readonly speedPremium: LookupTable;
  readonly armourCostPerKgMicro: Readonly<Record<string, number>>;
  readonly machineryCostPerKwMicro: Readonly<Record<string, number>>;
  /** Technology maturity bp (0..10_000) -> component cost multiplier bp. Immature tech costs more. */
  readonly maturityCostBp: LookupTable;
  readonly overheadBp: number;
  readonly firstOfClassBp: number;
  /** Extra cost of accelerated construction on subtotal + overheads, bp (RTW3 manual p. 31: +5 %). */
  readonly accelerationCostBp: number;
  readonly hullMonthlyMaintenanceBp: number;
  readonly plantMonthlyMaintenanceBp: number;
}

export interface CostContext {
  /** Per-technology maturity for the building nation, bp. Missing = fully mature. */
  readonly maturityBpByTech: Readonly<Record<string, number>>;
  readonly firstOfClass: boolean;
  /** Accelerated construction (ADR-0067 section 5): faster build for an extra cost. Absent = normal pace. */
  readonly accelerated?: boolean;
}

export interface CostBreakdown {
  readonly hull: BudgetMicro;
  readonly armour: BudgetMicro;
  readonly machinery: BudgetMicro;
  readonly components: BudgetMicro;
  readonly subtotal: BudgetMicro;
  readonly overheads: BudgetMicro;
  readonly firstOfClassPremium: BudgetMicro;
  readonly accelerationPremium: BudgetMicro;
  readonly total: BudgetMicro;
  readonly monthlyMaintenance: BudgetMicro;
}

const BP = 10_000n;
const mulBpB = (v: bigint, bpv: number | bigint) => (v * BigInt(bpv) + BP / 2n) / BP;

/** F-C1. All integer budget micro-units; multipliers in bp with round-half-up. */
export function computeCost(
  c: CompiledDesign,
  d: DesignDraft,
  b: CostBalance,
  x: CostContext,
): CostBreakdown {
  const hullPerTonne = b.hullCostPerTonneMicro[d.hull.materialId];
  const form = b.formComplexityBp[d.hull.hullFormId];
  if (hullPerTonne === undefined || form === undefined)
    throw new Error("unknown hull material or form in cost balance");
  const vmax = c.machinery?.maxSpeedMilliKnots ?? 0;
  const slr = speedLengthRatioX1000(vmax, d.hull.lengthWl);
  const speed = evaluate(parseFormula("lookup(t, x)"), {
    vars: { x: slr },
    tables: { t: b.speedPremium },
  });
  const hullTonnes = BigInt(c.ledger.hull);
  let hull = (hullTonnes * BigInt(hullPerTonne)) / 1000n;
  hull = mulBpB(
    mulBpB(mulBpB(hull, form), b.subdivisionComplexityBp[d.hull.subdivisionGrade]),
    speed,
  );

  let armour = 0n;
  for (const [region, kgw] of Object.entries(c.armour?.weightByRegionKg ?? {})) {
    const material = d.armour.regions.find((r) => r.region === region)?.materialId;
    const per = material === undefined ? undefined : b.armourCostPerKgMicro[material];
    if (per === undefined)
      throw new Error(`unknown armour material for region '${region}' in cost balance`);
    armour += BigInt(kgw) * BigInt(per);
  }
  const perKw = b.machineryCostPerKwMicro[d.machinery.plantId];
  if (perKw === undefined)
    throw new Error(`unknown plant '${d.machinery.plantId}' in cost balance`);
  const machinery = BigInt(d.machinery.installedKw) * BigInt(perKw);

  let components = 0n;
  let maintenance = 0n;
  for (const k of c.components) {
    let maturity = 10_000;
    for (const t of k.requires) maturity = Math.min(maturity, x.maturityBpByTech[t] ?? 10_000);
    const mult = evaluate(parseFormula("lookup(t, x)"), {
      vars: { x: maturity },
      tables: { t: b.maturityCostBp },
    });
    const cost = mulBpB(BigInt(k.costMicro), mult);
    components += cost;
    maintenance += mulBpB(cost, k.maintenanceMonthlyBp);
  }
  maintenance +=
    mulBpB(hull, b.hullMonthlyMaintenanceBp) + mulBpB(machinery, b.plantMonthlyMaintenanceBp);

  const subtotal = hull + armour + machinery + components;
  const overheads = mulBpB(subtotal, b.overheadBp);
  const premium = x.firstOfClass ? mulBpB(subtotal + overheads, b.firstOfClassBp) : 0n;
  const acceleration = x.accelerated ? mulBpB(subtotal + overheads, b.accelerationCostBp) : 0n;
  const m = (v: bigint) => toSafe("cost", v) as BudgetMicro;
  return {
    hull: m(hull),
    armour: m(armour),
    machinery: m(machinery),
    components: m(components),
    subtotal: m(subtotal),
    overheads: m(overheads),
    firstOfClassPremium: m(premium),
    accelerationPremium: m(acceleration),
    total: m(subtotal + overheads + premium + acceleration),
    monthlyMaintenance: m(maintenance),
  };
}

/**
 * The single micro→unit rounding point (map D3). Ceil, so a ship is never priced below its cost, and never to zero.
 */
export const TREASURY_UNITS_ROUNDING: RoundingMode = "ceil";

/**
 * The one micro→unit bridge: turns a cost in micro-pounds into canonical treasury units (map D3). Rounds once, at
 * {@link TREASURY_UNITS_ROUNDING}, with an exact bigint intermediate. A negative/fractional/unsafe `costMicro` or a
 * non-positive/non-integer `unitMicro` is rejected at construction with a typed `UnitError`.
 */
export function treasuryCostUnits(costMicro: number, unitMicro: number): Money {
  if (!Number.isSafeInteger(costMicro) || costMicro < 0)
    throw new UnitError(
      "treasuryCostUnits",
      costMicro,
      "costMicro must be a non-negative safe integer",
    );
  if (!Number.isSafeInteger(unitMicro) || unitMicro <= 0)
    throw new UnitError(
      "treasuryCostUnits",
      unitMicro,
      "unitMicro must be a positive safe integer",
    );
  const units = (BigInt(costMicro) + BigInt(unitMicro) - 1n) / BigInt(unitMicro);
  return money(Number(units < 1n ? 1n : units));
}
