import {
  aswEscortAttackChanceBp,
  countAswEscorts,
  countQShips,
  qShipAttackChanceBp,
  submarineAttackChanceStages,
  type SubmarineAttackChanceRules,
  type SubmarineAttackChanceStages,
  type SubmarineThreatRules,
} from "./submarineThreat.js";
import type { SubmarinePolicy } from "./submarinePolicy.js";
import type { TradeDutyDesign, TradeDutyShip } from "./tradeProtection.js";

export interface SubmarineEscortRules {
  readonly contributingHullTypes: readonly string[];
  readonly amcHullType: string;
  readonly submarineThreat: Pick<SubmarineThreatRules, "qShipReductionBp">;
}

export interface SubmarineEscortCounts {
  readonly aswEscorts: number;
  readonly qShips: number;
}

export interface SubmarineTradeChanceStages extends SubmarineAttackChanceStages {
  readonly aswEscortedBp: number;
  readonly finalBp: number;
}

export function submarineEscortCounts(
  rules: SubmarineEscortRules,
  victimShips: readonly TradeDutyShip[],
  designs: ReadonlyMap<string, TradeDutyDesign>,
): SubmarineEscortCounts {
  const qShipsAuthored = rules.submarineThreat.qShipReductionBp !== undefined;
  return {
    aswEscorts: countAswEscorts(
      {
        contributingHullTypes: rules.contributingHullTypes,
        qShipHullType: qShipsAuthored ? rules.amcHullType : undefined,
      },
      victimShips,
      designs,
    ),
    qShips: countQShips({ amcHullType: rules.amcHullType }, victimShips, designs),
  };
}

export function submarineTradeChanceStages(
  rules: SubmarineAttackChanceRules &
    Readonly<{
      submarineThreat: Pick<SubmarineThreatRules, "aswEscortReductionBp" | "qShipReductionBp">;
    }>,
  victimShortfallBp: number,
  attackerBlockadesVictim: boolean,
  attackerPolicy: SubmarinePolicy,
  counts: SubmarineEscortCounts,
): SubmarineTradeChanceStages {
  const stages = submarineAttackChanceStages(
    rules,
    victimShortfallBp,
    attackerBlockadesVictim,
    attackerPolicy,
  );
  const aswEscortedBp = aswEscortAttackChanceBp(
    rules.submarineThreat,
    stages.blockadedBp,
    counts.aswEscorts,
  );
  const finalBp = qShipAttackChanceBp(rules.submarineThreat, aswEscortedBp, counts.qShips);
  return { ...stages, aswEscortedBp, finalBp };
}
