import { SafeInt, BluewaveError } from "@bluewave/contracts";
import type {
  BattleInstance,
  BattleResult,
  FleetState,
  NationState,
  Ship,
} from "@bluewave/campaign";
import { isShipOperational } from "@bluewave/campaign";
import { RandomEngine, RandomStream, drawUniform } from "@bluewave/random";
import type { ExplanationTree } from "@bluewave/events";
import { ExplanationBuilder, formatExplanation } from "@bluewave/events";
import { StrengthCalculator } from "./strength.js";

export interface BattleManifest {
  id: string;
  attackerId: string;
  defenderId: string;
  areaId: string;
  attackerFleetIds: string[];
  defenderFleetIds: string[];
  timestamp: string;
}

export class BattleResolver {
  resolve(
    battle: BattleInstance,
    attackerNation: NationState,
    defenderNation: NationState,
    randomEngine: RandomEngine,
  ): BattleResult {
    if (attackerNation.id !== battle.attackerId) {
      throw new BluewaveError("battle: attackerNation.id mismatch", {
        battleId: battle.id,
        expected: battle.attackerId,
        got: attackerNation.id,
      });
    }
    if (defenderNation.id !== battle.defenderId) {
      throw new BluewaveError("battle: defenderNation.id mismatch", {
        battleId: battle.id,
        expected: battle.defenderId,
        got: defenderNation.id,
      });
    }

    const attackerFleets = this.resolveFleetsOrThrow(
      attackerNation,
      battle.attackerFleetIds,
      "attacker",
    );
    const defenderFleets = this.resolveFleetsOrThrow(
      defenderNation,
      battle.defenderFleetIds,
      "defender",
    );

    const attackerStrength = attackerFleets.reduce(
      (sum: SafeInt, f) => SafeInt.add(sum, this.computeStrength(f, attackerNation)),
      SafeInt.ZERO,
    );
    const defenderStrength = defenderFleets.reduce(
      (sum: SafeInt, f) => SafeInt.add(sum, this.computeStrength(f, defenderNation)),
      SafeInt.ZERO,
    );

    // isolate per battle - engine.stream is domain-separated via splitSeed
    const randomStream = randomEngine.stream(`combat:resolve:${battle.id}`);

    const attackerRandom = drawUniform(randomStream, SafeInt(0), SafeInt(100));
    const defenderRandom = drawUniform(randomStream, SafeInt(0), SafeInt(100));

    const attackerFactor = 1 + ((attackerRandom as number) - 50) / 100; // [0.5,1.5]
    const defenderFactor = 1 + ((defenderRandom as number) - 50) / 100;

    const attackerEffective = this.computeEffectiveStrength(
      attackerStrength,
      defenderStrength,
      attackerFactor,
    );
    const defenderEffective = this.computeEffectiveStrength(
      defenderStrength,
      attackerStrength,
      defenderFactor,
    );

    const attackerWins = attackerEffective >= defenderEffective;
    const winnerId = attackerWins ? battle.attackerId : battle.defenderId;
    const loserId = attackerWins ? battle.defenderId : battle.attackerId;

    const loserFleets = attackerWins ? defenderFleets : attackerFleets;
    const allLoserShips = loserFleets.flatMap((f) => f.ships.filter((s) => isShipOperational(s)));

    const winnerEff = Math.max(attackerEffective, defenderEffective);
    const loserEff = Math.min(attackerEffective, defenderEffective);
    const strengthRatio = winnerEff > 0 ? loserEff / winnerEff : 0;
    const damageRatio = (1 - strengthRatio) / 2; // [0,0.5]

    const { losses, damageReport } = this.applyDamage(allLoserShips, damageRatio, randomStream);

    const explanationTree = this.createExplanation(
      { attacker: attackerStrength as number, defender: defenderStrength as number },
      {
        attackerFactor,
        defenderFactor,
        attackerRandom: attackerRandom as number,
        defenderRandom: defenderRandom as number,
        attackerEffective,
        defenderEffective,
        winnerEff,
      },
      { winnerId, loserId, losses, damageReport },
    );

    const explanation = [formatExplanation(explanationTree)];

    return {
      winnerId,
      loserId,
      attackerLosses: attackerWins ? [] : losses,
      defenderLosses: attackerWins ? losses : [],
      damageReport,
      explanation,
    };
  }

  private resolveFleetsOrThrow(
    nation: NationState,
    fleetIds: string[],
    role: string,
  ): FleetState[] {
    if (fleetIds.length === 0) {
      throw new BluewaveError(`battle: empty ${role} fleet list`, {
        nationId: nation.id,
        role,
      });
    }
    return fleetIds.map((id) => {
      const fleet = nation.fleets.find((f) => f.id === id);
      if (!fleet) {
        throw new BluewaveError(`battle: missing ${role} fleet`, {
          nationId: nation.id,
          fleetId: id,
        });
      }
      if (fleet.nationId !== nation.id) {
        throw new BluewaveError(`battle: fleet nation mismatch`, {
          fleetId: id,
          fleetNationId: fleet.nationId,
          nationId: nation.id,
        });
      }
      return fleet;
    });
  }

  computeStrength(fleet: FleetState, _nation: NationState): SafeInt {
    const dp = StrengthCalculator.damagePotential(fleet);
    const surv = StrengthCalculator.survivability(fleet);
    const raw = dp * surv;
    return SafeInt(Math.floor(raw));
  }

  computeEffectiveStrength(
    strength: SafeInt,
    _opponentStrength: SafeInt,
    randomFactor: number,
  ): number {
    return (strength as number) * randomFactor;
  }

  applyDamage(
    ships: Ship[],
    damageRatio: number,
    randomStream: RandomStream,
  ): { losses: string[]; damageReport: Record<string, SafeInt> } {
    const losses: string[] = [];
    const damageReport: Record<string, SafeInt> = {};

    for (const ship of ships) {
      const hp = ship.hitPoints as number;
      const damage = Math.max(1, Math.floor(hp * damageRatio));
      damageReport[ship.id] = SafeInt(damage);

      // deterministic sink for hp==1 (hp-damage <=0)
      if (hp - damage <= 0) {
        losses.push(ship.id);
        continue;
      }
      // probabilistic sink: damageRatio 0.5 -> 50% per ship, 0 -> 0%
      // drawUniform [0,99] inclusive
      const roll = drawUniform(randomStream, SafeInt(0), SafeInt(99)) as number;
      if (roll < damageRatio * 100) {
        losses.push(ship.id);
      }
    }

    // bounded guarantee: never wipe entire loser fleet in one battle unless single ship
    if (losses.length === ships.length && ships.length > 1) {
      losses.pop();
    }

    return { losses, damageReport };
  }

  createExplanation(
    strengthComparison: { attacker: number; defender: number },
    randomFactors: {
      attackerFactor: number;
      defenderFactor: number;
      attackerRandom: number;
      defenderRandom: number;
      attackerEffective: number;
      defenderEffective: number;
      winnerEff: number;
    },
    outcome: {
      winnerId: string;
      loserId: string;
      losses: string[];
      damageReport: Record<string, SafeInt>;
    },
  ): ExplanationTree {
    const builder = new ExplanationBuilder("battle:resolve", "1.0.0")
      .withInput("attackerStrength", strengthComparison.attacker)
      .withInput("defenderStrength", strengthComparison.defender)
      .withIntermediate("attackerRandomDraw", randomFactors.attackerRandom)
      .withIntermediate("defenderRandomDraw", randomFactors.defenderRandom)
      .withIntermediate("attackerRandomFactor", randomFactors.attackerFactor)
      .withIntermediate("defenderRandomFactor", randomFactors.defenderFactor)
      .withIntermediate("attackerEffectiveStrength", randomFactors.attackerEffective)
      .withIntermediate("defenderEffectiveStrength", randomFactors.defenderEffective)
      .withResult(randomFactors.winnerEff);

    const lossChild = new ExplanationBuilder("battle:losses", "1.0.0")
      .withInput("winnerId", outcome.winnerId)
      .withInput("loserId", outcome.loserId)
      .withIntermediate("lossesCount", outcome.losses.length)
      .withIntermediate("damageReportSize", Object.keys(outcome.damageReport).length)
      .withResult(outcome.losses.length)
      .build();

    builder.addChild(lossChild);
    return builder.build();
  }
}
