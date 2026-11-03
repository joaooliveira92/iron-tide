import type { Nation } from "../src/index.js";

const NATION_IDS = [
  "uk",
  "germany",
  "usa",
  "japan",
  "france",
  "italy",
  "russia",
  "austria_hungary",
  "spain",
  "qing",
  "ottoman_empire",
  "egypt",
  "netherlands",
  "belgium",
  "denmark",
  "sweden_norway",
  "portugal",
  "greece",
  "brazil",
  "chile",
  "argentina",
  "korea",
  "persia",
  "siam",
] as const;

const NATION_TAGS: Record<(typeof NATION_IDS)[number], string> = {
  uk: "GBR",
  germany: "GER",
  usa: "USA",
  japan: "JPN",
  france: "FRA",
  italy: "ITA",
  russia: "RUS",
  austria_hungary: "AUT",
  spain: "ESP",
  qing: "CHI",
  ottoman_empire: "OTT",
  egypt: "EGY",
  netherlands: "NLD",
  belgium: "BEL",
  denmark: "DEN",
  sweden_norway: "SWE",
  portugal: "POR",
  greece: "GRC",
  brazil: "BRA",
  chile: "CHL",
  argentina: "ARG",
  korea: "KOR",
  persia: "PRS",
  siam: "SIA",
};

function makeNation(id: (typeof NATION_IDS)[number]): Nation {
  return {
    id,
    tag: NATION_TAGS[id],
    name: id,
    displayNameKey: id,
    isPlayable: true,
    slot: { id, order: 0, participation: "active" },
    presentation: { colorBg: "#000000", colorFg: "#FFFFFF" },
    identity: {
      oneSentence: `${id} identity`,
      fullIdentity: `${id} full identity`,
      strategicProblem: `${id} strategic problem`,
    },
    traits: [],
    regime: {
      type: "monarchy",
      politicalSystem: "constitutional_monarchy",
      governmentType: "limited_democracy",
      headOfState: "ruler",
      headOfGovernment: "pm",
      leaderTitle: "title",
      navalPolicyActors: ["admiralty"],
      governmentModifiers: [],
      stabilityProfile: { level: "moderate", factors: ["stable"] },
      description: `${id} regime`,
    },
    strategicObjectives: {
      primary: `${id} primary`,
      secondary: `${id} secondary`,
    },
    baseResources: {
      gdpTier: "great_power",
      gdpDescription: "large economy",
      population: "~10M",
      industrialization: "industrial",
      industrializationDescription: "industrializing",
    },
    navalAppropriation: {
      budgetLevel: "moderate",
      justification: "naval defense",
    },
    economy: {
      description: `${id} economy`,
      character: "industrial",
      strengths: ["strong industry"],
      weaknesses: ["resource dependence"],
      industrialBase: "mature_global",
    },
    navalInstitution: {
      description: `${id} navy`,
      character: ["professional"],
      seniority: "senior_service",
    },
    doctrine: {
      summary: `${id} doctrine`,
      schools: ["blue water"],
    },
    shipDesign: {
      summary: `${id} design`,
      principles: ["balanced"],
      favoredTypes: ["battleship"],
    },
    ai: {
      archetype: "status_quo_maritime_hegemon",
      behavior: ["defensive"],
    },
    navalPurpose: "sustain_global_empire",
    coreAnxiety: "loss_of_sea_control_overstretch",
    gameplayFeel: "manage_supremacy",
    historicalAssumptions: [`${id} historical`],
  };
}

export function fixtureNations(): Nation[] {
  return NATION_IDS.map(makeNation);
}
