import { compileDesign, type DesignDraft, type ShipContext } from "./compile.js";
import { computeCost, type CostBalance, type CostContext } from "./cost.js";
import { computeCve, type CveBalance } from "./cve.js";

export interface BalanceRow {
  readonly name: string;
  readonly valid: boolean;
  readonly totalKg: number;
  readonly hullShareBp: number;
  readonly machineryShareBp: number;
  readonly fuelShareBp: number;
  readonly armourShareBp: number;
  readonly armamentShareBp: number;
  readonly maxSpeedMilliKnots: number;
  readonly rangeNm: number;
  readonly gmMm: number;
  readonly costMicro: number;
  readonly cveBp: number;
  readonly blocking: number;
  readonly critical: number;
  readonly warning: number;
}

/** One row per design for calibration. Same compile path as the game; no side effects. */
export function balanceRows(
  designs: readonly { readonly name: string; readonly draft: DesignDraft }[],
  ctx: ShipContext,
  costBalance: CostBalance,
  costCtx: CostContext,
  cveBalance: CveBalance,
): BalanceRow[] {
  return designs.map(({ name, draft }) => {
    const c = compileDesign(draft, ctx);
    const plant = ctx.plants.find((p) => p.id === draft.machinery.plantId)!;
    const share = (v: number) => (c.totalKg === 0 ? 0 : Math.floor((v * 10_000) / c.totalKg));
    const n = (s: string) => c.findings.filter((f) => f.severity === s).length;
    return {
      name,
      valid: c.valid,
      totalKg: c.totalKg,
      hullShareBp: share(c.ledger.hull),
      machineryShareBp: share(c.ledger.machinery),
      fuelShareBp: share(c.ledger.fuel),
      armourShareBp: share(c.ledger.armour),
      armamentShareBp: share(c.ledger.armament + c.ledger.ammunition),
      maxSpeedMilliKnots: c.machinery?.maxSpeedMilliKnots ?? 0,
      rangeNm: c.machinery?.rangeNmAtCruise ?? 0,
      gmMm: c.stability?.gmMm ?? 0,
      costMicro: computeCost(c, draft, costBalance, costCtx).total,
      cveBp: computeCve(c, draft, plant.reliabilityBp, cveBalance).cveBp,
      blocking: n("BLOCKING"),
      critical: n("CRITICAL"),
      warning: n("WARNING"),
    };
  });
}
