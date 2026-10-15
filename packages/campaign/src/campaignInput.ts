// Primitive coercions every campaign data builder uses when reading compiled
// content records. The raw-file/parse boundary moved to the content compiler
// (CAH-LEG-1): the campaign compiler now consumes only a verified, decoded
// `ContentBundle`, so this module owns just the coercion contract.
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

/** Authored campaign data, each group flattened in declared file order. */
export interface CampaignFileData {
  fleets: unknown[];
  economies: unknown[];
  constructions: unknown[];
  diplomacy: unknown[];
  research: unknown[];
  designs: unknown[];
}
