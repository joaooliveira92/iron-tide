import type { Finding } from "./findings.js";
import { shipTarget } from "./findings.js";

export interface AluminiumBalance {
  readonly fromMonth: string;
  readonly hullWeightSavingBp: number;
}

export interface AluminiumResult {
  readonly fitted: true;
  readonly available: boolean;
  readonly savingBp: number;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function aluminiumAvailable(balance: AluminiumBalance | undefined, month: string): boolean {
  return balance !== undefined && month >= balance.fromMonth;
}

export function aluminiumFitting(
  draft: { readonly aluminiumSuperstructure?: boolean },
  balance: AluminiumBalance | undefined,
  month: string,
): AluminiumResult | null {
  if (draft.aluminiumSuperstructure !== true) return null;
  const available = aluminiumAvailable(balance, month);
  return { fitted: true, available, savingBp: available ? (balance?.hullWeightSavingBp ?? 0) : 0 };
}

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
