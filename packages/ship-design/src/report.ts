import { compileDesign, type DesignDraft, type ShipContext } from "./compile.js";
import { computeCost, type CostBalance, type CostContext } from "./cost.js";
import { computeCve, CVE_LABEL, type CveBalance } from "./cve.js";

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

const pct = (bp: number) => `${(bp / 100).toFixed(1)}%`;

/** Fixed-width text table; the CVE column is labelled as the development metric it is. */
export function formatBalanceTable(rows: readonly BalanceRow[]): string {
  const head = [
    "design",
    "valid",
    "tonnes",
    "hull",
    "mach",
    "fuel",
    "armr",
    "arms",
    "kn",
    "nm",
    "GM mm",
    "cost",
    "CVE*",
    "B/C/W",
  ];
  const body = rows.map((r) => [
    r.name,
    r.valid ? "yes" : "NO",
    String(Math.round(r.totalKg / 1000)),
    pct(r.hullShareBp),
    pct(r.machineryShareBp),
    pct(r.fuelShareBp),
    pct(r.armourShareBp),
    pct(r.armamentShareBp),
    (r.maxSpeedMilliKnots / 1000).toFixed(1),
    String(r.rangeNm),
    String(r.gmMm),
    String(Math.round(r.costMicro / 1_000_000)),
    String(r.cveBp),
    `${r.blocking}/${r.critical}/${r.warning}`,
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join("  ");
  return [
    line(head),
    line(widths.map((w) => "-".repeat(w))),
    ...body.map(line),
    `* CVE = ${CVE_LABEL}`,
  ].join("\n");
}
