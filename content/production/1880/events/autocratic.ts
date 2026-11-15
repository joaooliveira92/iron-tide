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
    id: "court_favourites_appointments",
    titleKey: "event.court_favourites_appointments.title",
    bodyKey: "event.court_favourites_appointments.body",
    gates: { governmentTypes: ["autocratic"] },
    weightBp: 80,
    cooldownMonths: 48,
    once: false,
    defaultAnswerId: "appoint_on_seniority",
    answers: [
      {
        id: "reward_the_court_party",
        stance: "hawk",
        labelKey: "event.court_favourites_appointments.answer.reward_the_court_party",
        effects: {
          budgetBp: 300,
          unrest: 1,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "COURT_PATRONAGE" },
        },
      },
      {
        id: "appoint_on_seniority",
        stance: "dove",
        labelKey: "event.court_favourites_appointments.answer.appoint_on_seniority",
        effects: {
          budgetBp: -100,
          unrest: 0,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "COURT_SNUB" },
        },
      },
      {
        id: "rotate_the_commands",
        stance: "neutral",
        labelKey: "event.court_favourites_appointments.answer.rotate_the_commands",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
  {
    id: "officer_corps_petition",
    titleKey: "event.officer_corps_petition.title",
    bodyKey: "event.officer_corps_petition.body",
    gates: { governmentTypes: ["autocratic"] },
    weightBp: 70,
    cooldownMonths: 60,
    once: false,
    defaultAnswerId: "refuse_the_petition",
    answers: [
      {
        id: "grant_the_petition",
        stance: "hawk",
        labelKey: "event.officer_corps_petition.answer.grant_the_petition",
        effects: {
          budgetBp: 350,
          unrest: 0,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "OFFICER_CORPS_FAVOUR" },
          tension: { counterpart: "highest_tension_rival", delta: 1 },
        },
      },
      {
        id: "refuse_the_petition",
        stance: "dove",
        labelKey: "event.officer_corps_petition.answer.refuse_the_petition",
        effects: {
          budgetBp: -150,
          unrest: 0,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "OFFICER_CORPS_REBUFF" },
        },
      },
      {
        id: "form_a_commission",
        stance: "neutral",
        labelKey: "event.officer_corps_petition.answer.form_a_commission",
        effects: { budgetBp: 50, unrest: 0 },
      },
    ],
    provenance,
  },
  {
    id: "arsenal_contract_scandal",
    titleKey: "event.arsenal_contract_scandal.title",
    bodyKey: "event.arsenal_contract_scandal.body",
    gates: { governmentTypes: ["autocratic"] },
    weightBp: 70,
    cooldownMonths: 60,
    once: false,
    defaultAnswerId: "prosecute_the_director",
    answers: [
      {
        id: "shield_the_arsenal_director",
        stance: "hawk",
        labelKey: "event.arsenal_contract_scandal.answer.shield_the_arsenal_director",
        effects: {
          budgetBp: 200,
          unrest: 1,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "ARSENAL_PROTECTED" },
        },
      },
      {
        id: "prosecute_the_director",
        stance: "dove",
        labelKey: "event.arsenal_contract_scandal.answer.prosecute_the_director",
        effects: {
          budgetBp: -200,
          unrest: -1,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "ARSENAL_SCANDAL_EXPOSED" },
        },
      },
      {
        id: "quiet_reassignment",
        stance: "neutral",
        labelKey: "event.arsenal_contract_scandal.answer.quiet_reassignment",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
]);
