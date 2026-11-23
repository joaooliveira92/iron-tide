import {
  countEnemySubmarines,
  isRaiderBlockedByBlockade,
  submarineEscortCounts,
  submarineTradeChanceStages,
  type BlockadeState,
  type Ship,
  type SubmarinePolicy,
  type SubmarineThreatRules,
  type TradeDutyDesign,
} from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { RandomEngine } from "@bluewave/random";
import type { PhaseContext } from "./pipeline.js";

export const TRADE_SUBMARINE_ATTACK_REASON = "SUBMARINE_ATTACK";

export interface TradeAttacker {
  readonly warId: string;
  readonly nationId: string;
  readonly ships: readonly Ship[];
  readonly policy: SubmarinePolicy;
}

export function opposingSubmarines(
  threat: SubmarineThreatRules,
  attackers: readonly TradeAttacker[],
  designs: ReadonlyMap<string, TradeDutyDesign>,
): number {
  return attackers.reduce(
    (total, attacker) => total + countEnemySubmarines(threat, attacker.ships, designs),
    0,
  );
}

export function fleetSupportSubmarines(
  threat: SubmarineThreatRules,
  attackers: readonly TradeAttacker[],
  designs: ReadonlyMap<string, TradeDutyDesign>,
): number {
  return attackers.reduce(
    (total, attacker) =>
      attacker.policy === "FLEET_SUPPORT"
        ? total + countEnemySubmarines(threat, attacker.ships, designs)
        : total,
    0,
  );
}

export interface SubmarineAttackInput {
  readonly ctx: PhaseContext;
  readonly engine: RandomEngine;
  readonly streamFamily: string;
  readonly drawRange: number;
  readonly rulesetVersion: string;
  readonly shortfallAmplifyBp: number;
  readonly threat: SubmarineThreatRules;
  readonly attackers: readonly TradeAttacker[];
  readonly victimId: string;
  readonly victimShortfallBp: number;
  readonly victimShips: readonly Ship[];
  readonly contributingHullTypes: readonly string[];
  readonly amcHullType: string;
  readonly blockades: readonly Pick<BlockadeState, "blockaderId" | "blockadedNationId">[];
  readonly designs: ReadonlyMap<string, TradeDutyDesign>;
  readonly month: string;
}

export function drawSubmarineAttacks(input: SubmarineAttackInput): number {
  let hits = 0;
  const counts = submarineEscortCounts(
    {
      contributingHullTypes: input.contributingHullTypes,
      amcHullType: input.amcHullType,
      submarineThreat: input.threat,
    },
    input.victimShips,
    input.designs,
  );
  for (const attacker of input.attackers) {
    const chanceBp = submarineTradeChanceStages(
      { shortfallAmplifyBp: input.shortfallAmplifyBp, submarineThreat: input.threat },
      input.victimShortfallBp,
      isRaiderBlockedByBlockade(input.blockades, attacker.nationId, input.victimId),
      attacker.policy,
      counts,
    ).finalBp;
    for (const ship of attacker.ships) {
      if (countEnemySubmarines(input.threat, [ship], input.designs) === 0) continue;
      const entityKey = `sub/${attacker.warId}/${ship.id}/${input.victimId}/${input.month}`;
      const draw = Math.floor(
        input.engine.stream(`${input.streamFamily}/${entityKey}`).next() * input.drawRange,
      );
      const hit = draw < chanceBp;
      input.ctx.randomLedger.record({
        streamId: input.streamFamily,
        entityKey,
        phase: "resolve_diplomacy",
        rulesetVersion: input.rulesetVersion,
        inputHash: sha256Hex(canonicalSerialize({ entityKey, chanceBp })),
        draw,
        outcome: hit ? "HIT" : "MISS",
        reasonCode: TRADE_SUBMARINE_ATTACK_REASON,
      });
      if (hit) hits += 1;
    }
  }
  return hits;
}
