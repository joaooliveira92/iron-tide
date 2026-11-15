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
    id: "press_campaign_naval_estimates",
    titleKey: "event.press_campaign_naval_estimates.title",
    bodyKey: "event.press_campaign_naval_estimates.body",
    gates: { governmentTypes: ["liberal_democracy"] },
    weightBp: 80,
    cooldownMonths: 48,
    once: false,
    defaultAnswerId: "commission_inquiry",
    answers: [
      {
        id: "back_the_campaign",
        stance: "hawk",
        labelKey: "event.press_campaign_naval_estimates.answer.back_the_campaign",
        effects: {
          budgetBp: 300,
          unrest: 0,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "PRESS_NAVAL_CAMPAIGN" },
          tension: { counterpart: "highest_tension_rival", delta: 1 },
        },
      },
      {
        id: "hold_estimates_down",
        stance: "dove",
        labelKey: "event.press_campaign_naval_estimates.answer.hold_estimates_down",
        effects: {
          budgetBp: -200,
          unrest: 0,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "PRESS_NAVAL_CAMPAIGN" },
          tension: { counterpart: "highest_tension_rival", delta: -1 },
        },
      },
      {
        id: "commission_inquiry",
        stance: "neutral",
        labelKey: "event.press_campaign_naval_estimates.answer.commission_inquiry",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
  {
    id: "free_trade_lobby",
    titleKey: "event.free_trade_lobby.title",
    bodyKey: "event.free_trade_lobby.body",
    gates: { governmentTypes: ["liberal_democracy"] },
    weightBp: 70,
    cooldownMonths: 60,
    once: false,
    defaultAnswerId: "trust_in_commerce",
    answers: [
      {
        id: "pledge_convoy_escorts",
        stance: "hawk",
        labelKey: "event.free_trade_lobby.answer.pledge_convoy_escorts",
        effects: {
          budgetBp: 250,
          unrest: 0,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "TRADE_PROTECTION_PLEDGE" },
          tension: { counterpart: "highest_tension_rival", delta: 1 },
        },
      },
      {
        id: "trust_in_commerce",
        stance: "dove",
        labelKey: "event.free_trade_lobby.answer.trust_in_commerce",
        effects: {
          budgetBp: -250,
          unrest: 0,
          tension: { counterpart: "highest_tension_rival", delta: -1 },
        },
      },
      {
        id: "charter_merchant_cruisers",
        stance: "neutral",
        labelKey: "event.free_trade_lobby.answer.charter_merchant_cruisers",
        effects: { budgetBp: 100, unrest: 0 },
      },
    ],
    provenance,
  },
  {
    id: "coaling_station_petition",
    titleKey: "event.coaling_station_petition.title",
    bodyKey: "event.coaling_station_petition.body",
    gates: { governmentTypes: ["liberal_democracy"] },
    weightBp: 70,
    cooldownMonths: 60,
    once: false,
    defaultAnswerId: "refer_to_the_board",
    answers: [
      {
        id: "fund_overseas_stations",
        stance: "hawk",
        labelKey: "event.coaling_station_petition.answer.fund_overseas_stations",
        effects: {
          budgetBp: 300,
          unrest: 0,
          prestige: { kind: "FIXED_GAIN", amount: 1, reasonCode: "COALING_STATIONS_FUNDED" },
          tension: { counterpart: "highest_tension_rival", delta: 1 },
        },
      },
      {
        id: "decline_the_petition",
        stance: "dove",
        labelKey: "event.coaling_station_petition.answer.decline_the_petition",
        effects: {
          budgetBp: -200,
          unrest: 0,
          prestige: { kind: "FIXED_LOSS", amount: 1, reasonCode: "COALING_STATIONS_DECLINED" },
          tension: { counterpart: "highest_tension_rival", delta: -1 },
        },
      },
      {
        id: "refer_to_the_board",
        stance: "neutral",
        labelKey: "event.coaling_station_petition.answer.refer_to_the_board",
        effects: { budgetBp: 0, unrest: 0 },
      },
    ],
    provenance,
  },
]);
