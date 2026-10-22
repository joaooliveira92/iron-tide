import { SafeInt, BluewaveError, type Bp, BP_ONE, bp, toSafe } from "@bluewave/contracts";
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

function assertRatioInputs(label: string, a: number, b: number, d: number): void {
  if (
    !Number.isSafeInteger(a) ||
    !Number.isSafeInteger(b) ||
    !Number.isSafeInteger(d) ||
    a < 0 ||
    b < 0 ||
    d <= 0
  ) {
    throw new BluewaveError(`combat: ${label} requires non-negative safe integers and d > 0`, {
      a,
      b,
      d,
    });
  }
}

function floorRatio(a: number, b: number, d: number): number {
  assertRatioInputs("floorRatio", a, b, d);
  return toSafe("combat:resolver:floor", (BigInt(a) * BigInt(b)) / BigInt(d));
}

function halfUpRatio(a: number, b: number, d: number): number {
  assertRatioInputs("halfUpRatio", a, b, d);
  const numerator = BigInt(a) * BigInt(b);
  const denominator = BigInt(d);
  return toSafe("combat:resolver:halfUp", (2n * numerator + denominator) / (2n * denominator));
}

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

    const randomStream = randomEngine.stream(`combat:resolve:${battle.id}`);

    const attackerRandom = drawUniform(randomStream, SafeInt(0), SafeInt(100));
    const defenderRandom = drawUniform(randomStream, SafeInt(0), SafeInt(100));

    const attackerFactorBp = bp(BP_ONE + (attackerRandom - 50) * 100);
    const defenderFactorBp = bp(BP_ONE + (defenderRandom - 50) * 100);

    const attackerEffective = this.computeEffectiveStrength(attackerStrength, attackerFactorBp);
    const defenderEffective = this.computeEffectiveStrength(defenderStrength, defenderFactorBp);

    const attackerWins = attackerEffective >= defenderEffective;
    const winnerId = attackerWins ? battle.attackerId : battle.defenderId;
    const loserId = attackerWins ? battle.defenderId : battle.attackerId;

    const loserFleets = attackerWins ? defenderFleets : attackerFleets;
    const allLoserShips = loserFleets.flatMap((f) => f.ships.filter((s) => isShipOperational(s)));

    const winnerEff = attackerWins ? attackerEffective : defenderEffective;
    const loserEff = attackerWins ? defenderEffective : attackerEffective;
    const damageRatioBp =
      winnerEff > 0 ? bp(halfUpRatio(winnerEff - loserEff, BP_ONE, 2 * winnerEff)) : bp(BP_ONE / 2);

    const { losses, damageReport } = this.applyDamage(
      allLoserShips,
      winnerEff,
      loserEff,
      randomStream,
    );

    const explanationTree = this.createExplanation(
      { attacker: attackerStrength, defender: defenderStrength },
      {
        attackerFactor: attackerFactorBp,
        defenderFactor: defenderFactorBp,
        attackerRandom,
        defenderRandom,
        attackerEffective,
        defenderEffective,
        winnerEff,
        damageRatioBp,
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
    return StrengthCalculator.strength(fleet);
  }

  computeEffectiveStrength(strength: SafeInt, factorBp: Bp): SafeInt {
    return SafeInt(toSafe("combat:effective", BigInt(strength) * BigInt(factorBp)));
  }

  applyDamage(
    ships: Ship[],
    winnerEff: SafeInt,
    loserEff: SafeInt,
    randomStream: RandomStream,
  ): { losses: string[]; damageReport: Record<string, SafeInt> } {
    const losses: string[] = [];
    const damageReport: Record<string, SafeInt> = {};
    const num = winnerEff > 0 ? winnerEff - loserEff : 1;
    const den = winnerEff > 0 ? 2 * winnerEff : 2;

    for (const ship of ships) {
      const hp = ship.hitPoints as number;
      const scaled = floorRatio(hp, num, den);
      const damage = scaled < 1 ? 1 : scaled;
      damageReport[ship.id] = SafeInt(damage);

      if (hp - damage <= 0) {
        losses.push(ship.id);
        continue;
      }
      const roll = drawUniform(randomStream, SafeInt(0), SafeInt(99)) as number;
      if (BigInt(roll) * BigInt(den) < BigInt(num) * 100n) {
        losses.push(ship.id);
      }
    }

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
      damageRatioBp: number;
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
      .withIntermediate("damageRatioBp", randomFactors.damageRatioBp)
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
