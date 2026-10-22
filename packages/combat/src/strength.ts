import { SafeInt, type Bp, BP_ONE, bp, toSafe } from "@bluewave/contracts";
import { isShipOperational, type FleetState } from "@bluewave/campaign";

export class StrengthCalculator {
  private static activeShips(fleet: FleetState) {
    return fleet.ships.filter((s) => isShipOperational(s));
  }

  static totalFirepower(fleet: FleetState): SafeInt {
    const active = this.activeShips(fleet);
    return active.reduce((sum: SafeInt, ship) => SafeInt.add(sum, ship.firepower), SafeInt.ZERO);
  }

  static averageArmor(fleet: FleetState): SafeInt {
    const active = this.activeShips(fleet);
    if (active.length === 0) return SafeInt.ZERO;
    const total = active.reduce((sum: SafeInt, ship) => SafeInt.add(sum, ship.armor), SafeInt.ZERO);
    return SafeInt.div(total, SafeInt(active.length), "halfUp");
  }

  static totalHitPoints(fleet: FleetState): SafeInt {
    const active = this.activeShips(fleet);
    return active.reduce((sum: SafeInt, ship) => SafeInt.add(sum, ship.hitPoints), SafeInt.ZERO);
  }

  static maxHitPoints(fleet: FleetState): SafeInt {
    const active = this.activeShips(fleet);
    return active.reduce((sum: SafeInt, ship) => SafeInt.add(sum, ship.maxHitPoints), SafeInt.ZERO);
  }

  static damagePotential(fleet: FleetState): SafeInt {
    const active = this.activeShips(fleet);
    if (active.length === 0) return SafeInt.ZERO;
    const firepower = active.reduce(
      (sum: SafeInt, ship) => SafeInt.add(sum, ship.firepower),
      SafeInt.ZERO,
    );
    const armorTotal = active.reduce(
      (sum: SafeInt, ship) => SafeInt.add(sum, ship.armor),
      SafeInt.ZERO,
    );
    return SafeInt(
      toSafe(
        "combat:damagePotential",
        (BigInt(firepower) * BigInt(armorTotal)) / BigInt(10 * active.length),
      ),
    );
  }

  static survivability(fleet: FleetState): Bp {
    const active = this.activeShips(fleet);
    if (active.length === 0) return bp(0);
    const hp = active.reduce(
      (sum: SafeInt, ship) => SafeInt.add(sum, ship.hitPoints),
      SafeInt.ZERO,
    );
    const maxHp = active.reduce(
      (sum: SafeInt, ship) => SafeInt.add(sum, ship.maxHitPoints),
      SafeInt.ZERO,
    );
    if (maxHp === 0) return bp(0);
    const numerator = BigInt(hp) * BigInt(BP_ONE);
    const denominator = BigInt(maxHp);
    const ratioBp = toSafe(
      "combat:survivability",
      (2n * numerator + denominator) / (2n * denominator),
    );
    return bp(ratioBp > BP_ONE ? BP_ONE : ratioBp);
  }

  static strength(fleet: FleetState): SafeInt {
    const active = this.activeShips(fleet);
    if (active.length === 0) return SafeInt.ZERO;
    const firepower = active.reduce(
      (sum: SafeInt, ship) => SafeInt.add(sum, ship.firepower),
      SafeInt.ZERO,
    );
    const armorTotal = active.reduce(
      (sum: SafeInt, ship) => SafeInt.add(sum, ship.armor),
      SafeInt.ZERO,
    );
    const hp = active.reduce(
      (sum: SafeInt, ship) => SafeInt.add(sum, ship.hitPoints),
      SafeInt.ZERO,
    );
    const maxHp = active.reduce(
      (sum: SafeInt, ship) => SafeInt.add(sum, ship.maxHitPoints),
      SafeInt.ZERO,
    );
    if (maxHp === 0) return SafeInt.ZERO;
    const effectiveHp = hp < maxHp ? hp : maxHp;
    const numerator = BigInt(firepower) * BigInt(armorTotal) * BigInt(effectiveHp);
    const denominator = 10n * BigInt(active.length) * BigInt(maxHp);
    return SafeInt(toSafe("combat:strength", numerator / denominator));
  }
}
