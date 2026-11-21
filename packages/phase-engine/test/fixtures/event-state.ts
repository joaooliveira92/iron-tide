import type { NationState } from "@bluewave/campaign";

export const EVENT_STATE_FIXTURE: Pick<
  NationState,
  | "governmentType"
  | "traits"
  | "eventHistory"
  | "unrest"
  | "unrestLastChange"
  | "fleetMorale"
  | "fleetMoraleLastChange"
  | "budgetModifiers"
  | "tradeProtection"
> = {
  tradeProtection: {
    month: "1880-03",
    quota: 4,
    assigned: 2,
    shortfall: 2,
    shortfallBp: 5000,
    merchantPoolBp: 9000,
  },
  governmentType: "liberal_democracy",
  traits: ["cautious"],
  eventHistory: {
    fired: [{ eventId: "naval_scare", month: "1880-02", answerId: "arm", resolvedBy: "PLAYER" }],
    flags: ["naval_scare_armed"],
  },
  unrest: 3,
  unrestLastChange: {
    month: "1880-02",
    before: 2,
    after: 3,
    contributions: [{ reasonCode: "MILITARY_SPENDING", delta: 1 }],
  },
  fleetMorale: 90,
  fleetMoraleLastChange: {
    before: 100,
    after: 90,
    unclampedAfter: 90,
    contributions: [{ reasonCode: "UNPAID_FUNDS", delta: -10 }],
    month: "1880-02",
  },
  budgetModifiers: [
    {
      eventId: "naval_scare",
      answerId: "arm",
      firstMonth: "1880-03",
      initialBp: 300,
      decayMonths: 12,
      capBp: 600,
    },
  ],
};
