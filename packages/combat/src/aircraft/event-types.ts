//packages/combat/src/aircraft/event-types.ts
// DESIGN-43 §11 typed event definition for private aircraft ventures.
// The private_aircraft_venture_v1 event carries the outcome of a monthly
// private-venture resolution: whether a venture was granted, which role,
// the resulting proposal (if granted), and the next eligible month.
import { createEnvelope } from "@bluewave/deterministic";
import { AIRCRAFT_RULESET_VERSION } from "./constants.js";
import type { AircraftType } from "./index.js";

export type PrivateVentureResult =
  | "VENTURE_GRANTED"
  | "VENTURE_COOLDOWN"
  | "VENTURE_LIMIT_REACHED"
  | "VENTURE_INELIGIBLE";

export interface PrivateAircraftVenture_v1 {
  readonly kind: "private_aircraft_venture_v1";
  readonly eventVersion: string;
  readonly nationId: string;
  readonly month: string;
  readonly role: AircraftType | null;
  readonly result: PrivateVentureResult;
  readonly proposalId: string | null;
  readonly nextVentureMonth: string | null;
  readonly reasonCode: string;
  readonly eventHash: string;
}

export function computePrivateVentureEventHash(
  event: Omit<PrivateAircraftVenture_v1, "eventHash">,
): string {
  const envelope = createEnvelope(
    "private-aircraft-venture-event",
    AIRCRAFT_RULESET_VERSION,
    event,
  );
  return envelope.bodyHash;
}

export function createPrivateVentureEvent(params: {
  nationId: string;
  month: string;
  role: AircraftType | null;
  result: PrivateVentureResult;
  proposalId: string | null;
  nextVentureMonth: string | null;
  reasonCode: string;
}): PrivateAircraftVenture_v1 {
  const event = {
    kind: "private_aircraft_venture_v1" as const,
    eventVersion: AIRCRAFT_RULESET_VERSION,
    ...params,
    eventHash: "",
  };
  return { ...event, eventHash: computePrivateVentureEventHash(event) };
}
