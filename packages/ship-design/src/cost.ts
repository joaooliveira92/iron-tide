import type { CompiledDesign, DesignDraft } from "./compile.js";
import type { RoundingMode } from "@bluewave/contracts";
import { evaluate, type LookupTable } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import { speedLengthRatioX1000 } from "./machinery.js";
import { toSafe, UnitError, money, type BudgetMicro, type Money } from "./units.js";
import { designInvariant } from "./errors.js";

export interface CostBalance {
  readonly hullCostPerTonneMicro: Readonly<Record<string, number>>;
  readonly formComplexityBp: Readonly<Record<string, number>>;
  readonly subdivisionComplexityBp: readonly [number, number, number, number, number];
  readonly speedPremium: LookupTable;
  readonly armourCostPerKgMicro: Readonly<Record<string, number>>;
  readonly machineryCostPerKwMicro: Readonly<Record<string, number>>;
  readonly maturityCostBp: LookupTable;
  readonly overheadBp: number;
  readonly firstOfClassBp: number;
  readonly accelerationCostBp: number;
  readonly hullMonthlyMaintenanceBp: number;
  readonly plantMonthlyMaintenanceBp: number;
}

export interface CostContext {
  readonly maturityBpByTech: Readonly<Record<string, number>>;
  readonly firstOfClass: boolean;
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

export function computeCost(
  c: CompiledDesign,
  d: DesignDraft,
  b: CostBalance,
  x: CostContext,
): CostBreakdown {
  const hullPerTonne = b.hullCostPerTonneMicro[d.hull.materialId];
  const form = b.formComplexityBp[d.hull.hullFormId];
  if (hullPerTonne === undefined || form === undefined)
    throw designInvariant("unknown hull material or form in cost balance");
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
      throw designInvariant(`unknown armour material for region '${region}' in cost balance`);
    armour += BigInt(kgw) * BigInt(per);
  }
  const perKw = b.machineryCostPerKwMicro[d.machinery.plantId];
  if (perKw === undefined)
    throw designInvariant(`unknown plant '${d.machinery.plantId}' in cost balance`);
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

export const TREASURY_UNITS_ROUNDING: RoundingMode = "ceil";

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
