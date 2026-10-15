// DESIGN-43 §9 attribute allocation formula.
// INC-3: start from role baseline, +10 per emphasised trait, -10 total via
// trade-off, no attribute below role min or above 100.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  AIRCRAFT_ROLE_ATTRIBUTE_MINS,
  AIRCRAFT_ROLE_BASELINES,
  AIRCRAFT_SCORE_MAX,
  AIRCRAFT_SCORE_MIN,
  AIRCRAFT_TRAIT_BONUS,
  AIRCRAFT_TRADE_OFF_PENALTY,
  type AircraftTrait,
} from "./constants.js";
import { AIRCRAFT_DEVELOPMENT_TRAITS_NOT_DISTINCT } from "./reasonCodes.js";

export function allocateAttributes(
  role: string,
  emphasizedTraits: readonly [string, string],
): [SafeInt, SafeInt, SafeInt, SafeInt] {
  if (emphasizedTraits[0] === emphasizedTraits[1]) {
    throw new BluewaveError(AIRCRAFT_DEVELOPMENT_TRAITS_NOT_DISTINCT, {
      code: AIRCRAFT_DEVELOPMENT_TRAITS_NOT_DISTINCT,
      role,
      traits: emphasizedTraits,
    });
  }

  const baseline = AIRCRAFT_ROLE_BASELINES[role]!;
  if (!baseline) {
    throw new BluewaveError("AIRCRAFT_DEVELOPMENT_ROLE_INVALID", {
      code: "AIRCRAFT_DEVELOPMENT_ROLE_INVALID",
      role,
    });
  }

  const roleMins = AIRCRAFT_ROLE_ATTRIBUTE_MINS[role]!;
  if (!roleMins) {
    throw new BluewaveError("AIRCRAFT_DEVELOPMENT_ROLE_INVALID", {
      code: "AIRCRAFT_DEVELOPMENT_ROLE_INVALID",
      role,
    });
  }

  const attrs: [number, number, number, number] = [
    baseline[0],
    baseline[1],
    baseline[2],
    baseline[3],
  ];
  const traitNames: string[] = [emphasizedTraits[0], emphasizedTraits[1]];
  const traitAttribIndices: number[] = [];

  for (const t of traitNames) {
    const trait = t as AircraftTrait;
    const bonus = AIRCRAFT_TRAIT_BONUS[trait] ?? 0;
    if (bonus > 0) {
      const idx = traitToAttributeIndex(trait);
      if (idx >= 0) {
        attrs[idx] = clampScore(attrs[idx]! + bonus);
        traitAttribIndices.push(idx);
      }
    }
  }

  const nonEmphasised = [0, 1, 2, 3].filter((i) => !traitAttribIndices.includes(i));
  for (const idx of nonEmphasised) {
    attrs[idx] = clampScore(attrs[idx]! + AIRCRAFT_TRADE_OFF_PENALTY);
  }

  for (let i = 0; i < 4; i++) {
    attrs[i] = clampScore(Math.max(attrs[i]!, roleMins[i]!));
  }

  return [SafeInt(attrs[0]), SafeInt(attrs[1]), SafeInt(attrs[2]), SafeInt(attrs[3])];
}

function traitToAttributeIndex(trait: AircraftTrait): number {
  switch (trait) {
    case "SPEED":
      return 0;
    case "FIREPOWER":
      return 1;
    case "MANEUVERABILITY":
      return 2;
    case "TOUGHNESS":
      return 3;
    default:
      return -1;
  }
}

function clampScore(v: number): number {
  return Math.max(AIRCRAFT_SCORE_MIN, Math.min(AIRCRAFT_SCORE_MAX, v));
}
