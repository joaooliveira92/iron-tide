// The aluminium superstructure (RTW3 manual p.45): "once you have developed the technology" it saves 10% of the hull
// weight, but makes the ship more susceptible to fire damage. The 10% is the manual's; the date it becomes available
// and everything else here is a PROVISIONAL gameplay parameter (ADR-0247) authored in the ship balance and tunable in
// one place. Absent section = the option does nothing and is not offered. Integer arithmetic only.
import type { Finding } from "./findings.js";
import { shipTarget } from "./findings.js";

/** The `aluminiumSuperstructure` section of the ship balance. Every value is provisional (ADR-0213, ADR-0247). */
export interface AluminiumBalance {
  /** First campaign month the option can be used, YYYY-MM. Provisional: the pack has no aluminium technology yet. */
  readonly fromMonth: string;
  /** Share of the hull-structure weight saved, bp. The manual states 10% (1000 bp). */
  readonly hullWeightSavingBp: number;
}

/** What an aluminium superstructure did to a compiled design. Present only on a design that asks for one. */
export interface AluminiumResult {
  readonly fitted: true;
  /** False while the ruleset does not offer it this month: recorded, but with no effect. */
  readonly available: boolean;
  /** Share of the hull weight saved, bp; 0 while unavailable. */
  readonly savingBp: number;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Whether the option is offered for `month` under `balance`. Absent balance = never. */
export function aluminiumAvailable(balance: AluminiumBalance | undefined, month: string): boolean {
  return balance !== undefined && month >= balance.fromMonth;
}

/** The result for a draft, or null when it does not ask for an aluminium superstructure. */
export function aluminiumFitting(
  draft: { readonly aluminiumSuperstructure?: boolean },
  balance: AluminiumBalance | undefined,
  month: string,
): AluminiumResult | null {
  if (draft.aluminiumSuperstructure !== true) return null;
  const available = aluminiumAvailable(balance, month);
  return { fitted: true, available, savingBp: available ? (balance?.hullWeightSavingBp ?? 0) : 0 };
}

/** Why a balance section is unusable, or null when it is well formed. */
export function aluminiumBalanceProblem(raw: unknown): string | null {
  if (raw === null || typeof raw !== "object") return "aluminiumSuperstructure must be an object";
  const r = raw as Record<string, unknown>;
  if (typeof r.fromMonth !== "string" || !MONTH.test(r.fromMonth))
    return "aluminiumSuperstructure.fromMonth must be a YYYY-MM month";
  const bp = r.hullWeightSavingBp;
  if (typeof bp !== "number" || !Number.isSafeInteger(bp) || bp < 0 || bp > 5_000)
    return "aluminiumSuperstructure.hullWeightSavingBp must be an integer from 0 to 5000";
  return null;
}

/** The advisory a design with an aluminium superstructure carries: what it costs in fire risk, or why it did nothing. */
export function aluminiumFindings(result: AluminiumResult | null): Finding[] {
  if (result === null) return [];
  const base = {
    severity: "ADVISORY" as const,
    remedies: [],
    evidence: { formulaId: "DESIGN-22", inputs: {}, threshold: 0, value: result.savingBp },
    subject: { targets: [shipTarget], settings: "hull" as const },
  };
  if (!result.available)
    return [
      {
        ...base,
        id: "ALUMINIUM_SUPERSTRUCTURE_UNAVAILABLE",
        what: "An aluminium superstructure is requested but not available at this date.",
        why: "The technology to build one has not been developed yet.",
        consequence: "The hull is built in steel until it becomes available.",
      },
    ];
  return [
    {
      ...base,
      id: "ALUMINIUM_FIRE_SUSCEPTIBILITY",
      what: "An aluminium superstructure makes the ship more susceptible to fire damage.",
      why: "It saves hull weight at the cost of fire resistance (manual p.45).",
      consequence: "Battle damage does not yet model the added fire risk.",
    },
  ];
}
