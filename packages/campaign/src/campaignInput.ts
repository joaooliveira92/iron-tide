import { SafeInt } from "@bluewave/contracts";

export function toSafeInt(value: unknown): SafeInt {
  if (typeof value === "number") return SafeInt(value);
  return SafeInt(0);
}

export function toSafeIntOpt(value: unknown, fallback: SafeInt): SafeInt {
  if (typeof value === "number") return SafeInt(value);
  return fallback;
}

export function toStr(value: unknown, fallback = ""): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}

export interface CampaignFileData {
  fleets: unknown[];
  economies: unknown[];
  constructions: unknown[];
  diplomacy: unknown[];
  research: unknown[];
  designs: unknown[];
  divisions: unknown[];
}
