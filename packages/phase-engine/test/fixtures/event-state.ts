import type { NationState } from "@bluewave/campaign";

export const EVENT_STATE_FIXTURE: Pick<
  NationState,
  "governmentType" | "traits" | "eventHistory" | "unrest" | "budgetModifiers"
> = {
  governmentType: "liberal_democracy",
  traits: ["cautious"],
  eventHistory: {
    fired: [{ eventId: "naval_scare", month: "1880-02", answerId: "arm", resolvedBy: "PLAYER" }],
    flags: ["naval_scare_armed"],
  },
  unrest: 3,
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
