import type { NationRegime, NationTrait } from "@bluewave/content-schema";

export const STUB_TRAITS: readonly NationTrait[] = [];

export const STUB_REGIME: NationRegime = {
  type: "monarchy",
  politicalSystem: "constitutional_monarchy",
  governmentType: "limited_democracy",
  headOfState: "x",
  headOfGovernment: "x",
  leaderTitle: "x",
  navalPolicyActors: [],
  governmentModifiers: [],
  stabilityProfile: { level: "high", factors: [] },
  description: "x",
};
