import type { Finding } from "./findings.js";
import { shipTarget } from "./findings.js";

export const MAX_AA_DIRECTORS = 4;

export interface AntiAircraftFit {
  readonly lightGuns: number;
  readonly mediumGuns: number;
  readonly directors: number;
}

export interface AntiAircraftBalance {
  readonly fromMonth: string;
  readonly lightGunWeightKg: number;
  readonly mediumGunWeightKg: number;
  readonly directorWeightKg: number;
  readonly lightGunFootprintMm2: number;
  readonly mediumGunFootprintMm2: number;
  readonly directorFootprintMm2: number;
}

export interface AntiAircraftExpansion {
  readonly weightKg: number;
  readonly footprintMm2: number;
}

export const NO_ANTI_AIRCRAFT: AntiAircraftExpansion = { weightKg: 0, footprintMm2: 0 };

export interface AntiAircraftResult extends AntiAircraftFit {
  readonly available: boolean;
  readonly weightKg: number;
  readonly footprintMm2: number;
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_COUNT = 1_000;
const isCount = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= MAX_COUNT;

export function antiAircraftFitProblem(raw: unknown): string | null {
  if (raw === null || typeof raw !== "object")
    return "antiAircraft must be { lightGuns, mediumGuns, directors }";
  const r = raw as Record<string, unknown>;
  if (!isCount(r.lightGuns) || !isCount(r.mediumGuns) || !isCount(r.directors))
    return `antiAircraft counts must be integers from 0 to ${MAX_COUNT}`;
  if (r.directors > MAX_AA_DIRECTORS)
    return `antiAircraft directors are at most ${MAX_AA_DIRECTORS}`;
  return null;
}

export function antiAircraftAvailable(
  balance: AntiAircraftBalance | undefined,
  month: string,
): boolean {
  return balance !== undefined && month >= balance.fromMonth;
}

export const hasAntiAircraft = (fit: AntiAircraftFit | undefined): fit is AntiAircraftFit =>
  fit !== undefined && fit.lightGuns + fit.mediumGuns + fit.directors > 0;

export function expandAntiAircraft(
  fit: AntiAircraftFit | undefined,
  balance: AntiAircraftBalance | undefined,
  month: string,
): AntiAircraftExpansion {
  if (fit === undefined) return NO_ANTI_AIRCRAFT;
  const problem = antiAircraftFitProblem(fit);
  if (problem !== null) throw new Error(problem);
  if (balance === undefined || !antiAircraftAvailable(balance, month)) return NO_ANTI_AIRCRAFT;
  return {
    weightKg:
      fit.lightGuns * balance.lightGunWeightKg +
      fit.mediumGuns * balance.mediumGunWeightKg +
      fit.directors * balance.directorWeightKg,
    footprintMm2:
      fit.lightGuns * balance.lightGunFootprintMm2 +
      fit.mediumGuns * balance.mediumGunFootprintMm2 +
      fit.directors * balance.directorFootprintMm2,
  };
}

export function antiAircraftResult(
  fit: AntiAircraftFit | undefined,
  balance: AntiAircraftBalance | undefined,
  month: string,
): AntiAircraftResult | null {
  if (!hasAntiAircraft(fit)) return null;
  return {
    ...fit,
    available: antiAircraftAvailable(balance, month),
    ...expandAntiAircraft(fit, balance, month),
  };
}

export function antiAircraftBalanceProblem(raw: unknown): string | null {
  if (raw === null || typeof raw !== "object") return "antiAircraft must be an object";
  const r = raw as Record<string, unknown>;
  if (typeof r.fromMonth !== "string" || !MONTH.test(r.fromMonth))
    return "antiAircraft.fromMonth must be a YYYY-MM month";
  for (const k of [
    "lightGunWeightKg",
    "mediumGunWeightKg",
    "directorWeightKg",
    "lightGunFootprintMm2",
    "mediumGunFootprintMm2",
    "directorFootprintMm2",
  ] as const)
    if (typeof r[k] !== "number" || !Number.isSafeInteger(r[k]) || r[k] < 0)
      return `antiAircraft.${k} must be a non-negative integer`;
  return null;
}

export function antiAircraftFindings(result: AntiAircraftResult | null): Finding[] {
  if (result === null) return [];
  const base = {
    severity: "ADVISORY" as const,
    remedies: [],
    evidence: { formulaId: "DESIGN-22", inputs: {}, threshold: 0, value: result.weightKg },
    subject: { targets: [shipTarget], settings: "arrangement" as const },
  };
  if (!result.available)
    return [
      {
        ...base,
        id: "ANTI_AIRCRAFT_UNAVAILABLE",
        what: "An AA fit is requested but not available at this date.",
        why: "Anti-aircraft guns and directors have not been developed yet.",
        consequence: "The fit adds no weight or topside load until it becomes available.",
      },
    ];
  return [
    {
      ...base,
      id: "ANTI_AIRCRAFT_NOT_MODELLED_IN_BATTLE",
      what: "The AA fit costs weight and topside space, but battle does not yet read it.",
      why: "Light and medium AA and AA directors are limited by weight and topside space (manual p.43).",
      consequence: "It does not yet change how the ship defends itself against aircraft.",
    },
  ];
}
