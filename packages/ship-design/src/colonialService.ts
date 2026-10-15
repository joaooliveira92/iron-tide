// packages/ship-design/src/colonialService.ts
// Colonial-service capability of a corvette / colonial gunboat (KE). A KE is a cheap hull, but a foreign-station
// posting needs endurance and a crew that can live aboard for months: the capability exists only when the design
// has both and the campaign allows it. Pure; the compile reports the result as an advisory.
import type { Finding } from "./findings.js";
import { shipTarget } from "./findings.js";
import type { AccommodationStandard } from "./systems.js";

/** Versioned gameplay constants (ADR-0088). Estimates: no source fixes them; they want a research pass (ticket 30). */
export const COLONIAL_SERVICE_RULES = {
  /** Smallest hull that can cross an ocean to a foreign station (river and harbour craft are below it). */
  minDisplacementKg: 400_000,
  /** Endurance at cruising speed: a station is months from a coaling port. */
  minCruiseRangeNm: 3_000,
  /** SPARTAN accommodation cannot sustain a long posting. */
  minAccommodation: "STANDARD" as AccommodationStandard,
} as const;

const ACCOMMODATION_ORDER: readonly AccommodationStandard[] = ["SPARTAN", "STANDARD", "GENEROUS"];

export const COLONIAL_SERVICE_REASONS = [
  "KE_COLONIAL_HULL_TOO_SMALL",
  "KE_COLONIAL_ENDURANCE_SHORT",
  "KE_COLONIAL_ACCOMMODATION_POOR",
  "KE_COLONIAL_CAMPAIGN_DISALLOWED",
] as const;
export type ColonialServiceReason = (typeof COLONIAL_SERVICE_REASONS)[number];

export interface ColonialServiceInput {
  readonly displacementKg: number;
  readonly cruiseRangeNm: number;
  readonly accommodation: AccommodationStandard;
  /** The campaign (scenario) permits colonial-service ships. */
  readonly campaignAllows: boolean;
}

export interface ColonialServiceResult {
  readonly eligible: boolean;
  readonly reasons: readonly ColonialServiceReason[];
}

export function colonialServiceEligibility(i: ColonialServiceInput): ColonialServiceResult {
  const r = COLONIAL_SERVICE_RULES;
  const reasons: ColonialServiceReason[] = [];
  if (i.displacementKg < r.minDisplacementKg) reasons.push("KE_COLONIAL_HULL_TOO_SMALL");
  if (i.cruiseRangeNm < r.minCruiseRangeNm) reasons.push("KE_COLONIAL_ENDURANCE_SHORT");
  if (
    ACCOMMODATION_ORDER.indexOf(i.accommodation) < ACCOMMODATION_ORDER.indexOf(r.minAccommodation)
  )
    reasons.push("KE_COLONIAL_ACCOMMODATION_POOR");
  if (!i.campaignAllows) reasons.push("KE_COLONIAL_CAMPAIGN_DISALLOWED");
  return { eligible: reasons.length === 0, reasons };
}

const WHY: Record<ColonialServiceReason, string> = {
  KE_COLONIAL_HULL_TOO_SMALL: "the hull is too small for an ocean passage to a foreign station",
  KE_COLONIAL_ENDURANCE_SHORT: "its range at cruising speed is too short between coaling ports",
  KE_COLONIAL_ACCOMMODATION_POOR: "its accommodation is too spartan for a long posting",
  KE_COLONIAL_CAMPAIGN_DISALLOWED: "the campaign does not allow colonial-service ships",
};

/** The non-blocking advisory a KE gets when it cannot take colonial service; the design stays legal as a KE. */
export function colonialServiceAdvisory(result: ColonialServiceResult): Finding[] {
  if (result.eligible) return [];
  return [
    {
      id: "KE_COLONIAL_SERVICE_UNAVAILABLE",
      severity: "ADVISORY",
      what: "This corvette cannot take colonial service.",
      why: `It cannot be posted to a foreign station because ${result.reasons.map((x) => WHY[x]).join("; ")}.`,
      consequence: "It remains a legal corvette for home patrol and local defence.",
      remedies: [],
      evidence: {
        formulaId: "DESIGN-22",
        inputs: {},
        threshold: 0,
        value: result.reasons.length,
      },
      subject: { targets: [shipTarget], settings: "brief" },
    },
  ];
}
