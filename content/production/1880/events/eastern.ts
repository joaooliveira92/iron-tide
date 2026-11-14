import { EventSchema, list } from "@bluewave/content-authoring";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [],
  note: "PROVISIONAL: weight, cooldown and every delta are Bluewave tuning placeholders for the first 1880 event catalogue (#436). No source gives these values; retune from the generated balance report.",
} as const;

export default list(EventSchema, [
  {
    id: "reform_faction_pressure",
    titleKey: "event.reform_faction_pressure.title",
    bodyKey: "event.reform_faction_pressure.body",
    gates: { governmentTypes: ["eastern"] },
    weightBp: 80,
    cooldownMonths: 48,
    once: false,
    defaultAnswerId: "shelve_the_reforms",
    answers: [
      {
        id: "fund_the_modernisers",
        stance: "hawk",
        labelKey: "event.reform_faction_pressure.answer.fund_the_modernisers",
        effects: {
          budgetBp: 300,
          unrest: 1,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "REFORM_SPONSORSHIP" },
        },
      },
      {
        id: "shelve_the_reforms",
        stance: "dove",
        labelKey: "event.reform_faction_pressure.answer.shelve_the_reforms",
        effects: {
          budgetBp: -200,
          unrest: 0,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "REFORM_STALLED" },
        },
      },
      {
        id: "authorise_a_pilot_programme",
        stance: "neutral",
        labelKey: "event.reform_faction_pressure.answer.authorise_a_pilot_programme",
        effects: { budgetBp: 100, unrest: 0 },
      },
    ],
    provenance,
  },
  {
    id: "frontier_garrison_demand",
    titleKey: "event.frontier_garrison_demand.title",
    bodyKey: "event.frontier_garrison_demand.body",
    gates: { governmentTypes: ["eastern"] },
    weightBp: 90,
    cooldownMonths: 36,
    once: false,
    defaultAnswerId: "rotate_the_garrison",
    answers: [
      {
        id: "reinforce_the_frontier",
        stance: "hawk",
        labelKey: "event.frontier_garrison_demand.answer.reinforce_the_frontier",
        effects: {
          budgetBp: 300,
          unrest: 0,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "FRONTIER_REINFORCED" },
          tension: { counterpart: "highest_tension_rival", delta: 1 },
        },
      },
      {
        id: "withdraw_to_depots",
        stance: "dove",
        labelKey: "event.frontier_garrison_demand.answer.withdraw_to_depots",
        effects: {
          budgetBp: -300,
          unrest: 0,
          tension: { counterpart: "highest_tension_rival", delta: -1 },
        },
      },
      {
        id: "rotate_the_garrison",
        stance: "neutral",
        labelKey: "event.frontier_garrison_demand.answer.rotate_the_garrison",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
  {
    id: "foreign_advisers_contract",
    titleKey: "event.foreign_advisers_contract.title",
    bodyKey: "event.foreign_advisers_contract.body",
    gates: { governmentTypes: ["eastern"] },
    weightBp: 80,
    cooldownMonths: 48,
    once: false,
    defaultAnswerId: "renew_a_small_mission",
    answers: [
      {
        id: "engage_a_full_mission",
        stance: "hawk",
        labelKey: "event.foreign_advisers_contract.answer.engage_a_full_mission",
        effects: {
          budgetBp: 300,
          unrest: 1,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "FOREIGN_MISSION_ENGAGED" },
          tension: { counterpart: "highest_tension_rival", delta: 1 },
        },
      },
      {
        id: "dismiss_the_advisers",
        stance: "dove",
        labelKey: "event.foreign_advisers_contract.answer.dismiss_the_advisers",
        effects: {
          budgetBp: -200,
          unrest: 0,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "FOREIGN_MISSION_DISMISSED" },
          tension: { counterpart: "highest_tension_rival", delta: -1 },
        },
      },
      {
        id: "renew_a_small_mission",
        stance: "neutral",
        labelKey: "event.foreign_advisers_contract.answer.renew_a_small_mission",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
]);
