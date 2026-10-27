import type { DesignCapability } from "@bluewave/campaign";

import { NEUTRAL_ACCURACY_MULTIPLIER_BP } from "../gunnery/constants.js";

export interface GunneryRadarRules {
  readonly accuracyBpByFireControlLevel: readonly [number, number, number];
  readonly blindFireMinLevel: number;
  readonly airDefenseSaturationBpBySearchLevel: readonly [number, number, number];
}

export interface DesignRadarFactors {
  readonly fireControlLevel: number;
  readonly searchLevel: number;
  readonly accuracyBp: number;
  readonly blindFireAllowed: boolean;
  readonly airDefenseSaturationBp: number;
}

function bestLevel(
  capabilities: readonly DesignCapability[] | undefined,
  kind: "fire_control_radar" | "search_radar",
): number {
  let best = 0;
  for (const capability of capabilities ?? []) {
    if (capability.kind !== kind) continue;
    if (capability.level > best) best = capability.level;
  }
  return best;
}

function tableValue(table: readonly [number, number, number], level: number): number {
  if (level < 1 || level > table.length) return NEUTRAL_ACCURACY_MULTIPLIER_BP;
  return table[level - 1]!;
}

export function designRadarFactors(
  capabilities: readonly DesignCapability[] | undefined,
  rules: GunneryRadarRules | undefined,
): DesignRadarFactors {
  const fireControlLevel = bestLevel(capabilities, "fire_control_radar");
  const searchLevel = bestLevel(capabilities, "search_radar");
  return {
    fireControlLevel,
    searchLevel,
    accuracyBp:
      rules === undefined
        ? NEUTRAL_ACCURACY_MULTIPLIER_BP
        : tableValue(rules.accuracyBpByFireControlLevel, fireControlLevel),
    blindFireAllowed:
      rules !== undefined && fireControlLevel >= rules.blindFireMinLevel && fireControlLevel > 0,
    airDefenseSaturationBp:
      rules === undefined
        ? NEUTRAL_ACCURACY_MULTIPLIER_BP
        : tableValue(rules.airDefenseSaturationBpBySearchLevel, searchLevel),
  };
}
