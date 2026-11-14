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
    id: "dual_estimates_bargaining",
    titleKey: "event.dual_estimates_bargaining.title",
    bodyKey: "event.dual_estimates_bargaining.body",
    gates: { governmentTypes: ["limited_democracy"] },
    weightBp: 90,
    cooldownMonths: 48,
    once: false,
    defaultAnswerId: "split_the_difference",
    answers: [
      {
        id: "override_the_chamber",
        stance: "hawk",
        labelKey: "event.dual_estimates_bargaining.answer.override_the_chamber",
        effects: {
          budgetBp: 400,
          unrest: 1,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "ESTIMATES_OVERRIDE" },
          tension: { counterpart: "highest_tension_rival", delta: 1 },
        },
      },
      {
        id: "concede_to_the_chamber",
        stance: "dove",
        labelKey: "event.dual_estimates_bargaining.answer.concede_to_the_chamber",
        effects: {
          budgetBp: -400,
          unrest: 0,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "ESTIMATES_CONCESSION" },
        },
      },
      {
        id: "split_the_difference",
        stance: "neutral",
        labelKey: "event.dual_estimates_bargaining.answer.split_the_difference",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
  {
    id: "nationalist_press_agitation",
    titleKey: "event.nationalist_press_agitation.title",
    bodyKey: "event.nationalist_press_agitation.body",
    gates: { governmentTypes: ["limited_democracy"] },
    weightBp: 80,
    cooldownMonths: 36,
    once: false,
    defaultAnswerId: "calm_public_opinion",
    answers: [
      {
        id: "answer_with_a_naval_display",
        stance: "hawk",
        labelKey: "event.nationalist_press_agitation.answer.answer_with_a_naval_display",
        effects: {
          budgetBp: 200,
          unrest: 0,
          prestige: { kind: "FIXED_GAIN", amount: 2, reasonCode: "NAVAL_DISPLAY" },
          tension: { counterpart: "highest_tension_rival", delta: 2 },
        },
      },
      {
        id: "calm_public_opinion",
        stance: "dove",
        labelKey: "event.nationalist_press_agitation.answer.calm_public_opinion",
        effects: {
          budgetBp: -100,
          unrest: 0,
          tension: { counterpart: "highest_tension_rival", delta: -1 },
        },
      },
      {
        id: "issue_official_statement",
        stance: "neutral",
        labelKey: "event.nationalist_press_agitation.answer.issue_official_statement",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
]);
