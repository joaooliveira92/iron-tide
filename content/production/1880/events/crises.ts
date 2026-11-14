import { EventSchema, list } from "@bluewave/content-authoring";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL: weight, cooldown, tension gate and every delta are Bluewave tuning placeholders for the first 1880 event catalogue (#436). No source gives these values; retune from the generated balance report.",
} as const;

export default list(EventSchema, [
  {
    id: "gunboat_fired_upon",
    titleKey: "event.gunboat_fired_upon.title",
    bodyKey: "event.gunboat_fired_upon.body",
    gates: { tension: { counterpart: "highest_tension_rival", min: 4, max: 8 } },
    weightBp: 60,
    cooldownMonths: 60,
    once: false,
    defaultAnswerId: "accept_the_explanation",
    answers: [
      {
        id: "demand_satisfaction",
        stance: "hawk",
        labelKey: "event.gunboat_fired_upon.answer.demand_satisfaction",
        effects: {
          budgetBp: 500,
          unrest: 1,
          prestige: { kind: "FIXED_GAIN", amount: 2, reasonCode: "FLAG_INSULT_AVENGED" },
          tension: { counterpart: "highest_tension_rival", delta: 3 },
        },
      },
      {
        id: "accept_the_explanation",
        stance: "dove",
        labelKey: "event.gunboat_fired_upon.answer.accept_the_explanation",
        effects: {
          budgetBp: -150,
          unrest: 0,
          tension: { counterpart: "highest_tension_rival", delta: -2 },
        },
      },
      {
        id: "lodge_a_protest_note",
        stance: "neutral",
        labelKey: "event.gunboat_fired_upon.answer.lodge_a_protest_note",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
  {
    id: "fishing_grounds_seizure",
    titleKey: "event.fishing_grounds_seizure.title",
    bodyKey: "event.fishing_grounds_seizure.body",
    gates: { tension: { counterpart: "highest_tension_rival", min: 2, max: 7 } },
    weightBp: 70,
    cooldownMonths: 48,
    once: false,
    defaultAnswerId: "arbitrate_the_boundary",
    answers: [
      {
        id: "escort_the_fishing_fleet",
        stance: "hawk",
        labelKey: "event.fishing_grounds_seizure.answer.escort_the_fishing_fleet",
        effects: {
          budgetBp: 400,
          unrest: 0,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "FISHERIES_ESCORTED" },
          tension: { counterpart: "highest_tension_rival", delta: 3 },
        },
      },
      {
        id: "arbitrate_the_boundary",
        stance: "dove",
        labelKey: "event.fishing_grounds_seizure.answer.arbitrate_the_boundary",
        effects: {
          budgetBp: -150,
          unrest: 0,
          tension: { counterpart: "highest_tension_rival", delta: -2 },
        },
      },
      {
        id: "compensate_the_owners",
        stance: "neutral",
        labelKey: "event.fishing_grounds_seizure.answer.compensate_the_owners",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
]);
