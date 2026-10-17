import { CVE_LABEL, type BalanceRow } from "../../src/index.js";

/**
 * The fixed-width calibration table (relocated from `src/report.ts`, U-3 ticket
 * 06: a display-text artefact has no home in an authoritative package and only
 * tests consume it). The CVE column is labelled as the development metric it is.
 */
const pct = (bp: number) => `${(bp / 100).toFixed(1)}%`;

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
