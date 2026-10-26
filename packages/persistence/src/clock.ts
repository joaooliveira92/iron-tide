import { randomUUID } from "node:crypto";

export interface PersistenceClock {
  readonly nowMillis: () => number;
  readonly nowIso: () => string;
  readonly uuid: () => string;
}

export const systemClock: PersistenceClock = {
  nowMillis: () => Date.now(),
  nowIso: () => new Date().toISOString(),
  uuid: () => randomUUID(),
};
