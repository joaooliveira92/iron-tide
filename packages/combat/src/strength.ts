import { SafeInt, type Bp, BP_ONE, bp, toSafe } from "@bluewave/contracts";
import { isShipOperational, type FleetState } from "@bluewave/campaign";

/**
 * Combat strength is fixed-point, not floating point (BW-DET-001; map D4/D5):
 * no float may reach a battle outcome or a hashed projection. Every quantity
 * here rounds exactly once, from an exact `bigint` intermediate:
 *
 * - {@link damagePotential} — integer in `firepower * armour / 10` units, i.e.
 *   `floor(firepower * totalArmor / (10 * count))`. The average armour is never
 *   rounded before the product (that would change the result), so a 10+15 armour
 *   pair with 20 firepower yields exactly `25`, not `26`.
 * - {@link survivability} — a canonical ratio in basis points (`Bp`,
 *   `BP_ONE = 10_000 = 1.0`), capped at one whole and rounded half up once.
 * - {@link strength} — the authoritative fleet strength consumed by the
 *   resolver: `floor(firepower * totalArmor * min(hp, maxHp) / (10 * count * maxHp))`,
 *   the exact rational composition of the two quantities above, floored once.
 *   The resolver uses this combined form rather than multiplying the two rounded
 *   projections, which would double-round.
 */
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
    // halfUp reduces systematic under-estimate vs trunc (7.5 -> 8 not 7)
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
    // floor once: firepower * totalArmor / (10 * count) — the exact rational,
    // with no intermediate average-armour rounding.
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
    // round half up once: hp * BP_ONE / maxHp, exact through bigint.
    const numerator = BigInt(hp) * BigInt(BP_ONE);
    const denominator = BigInt(maxHp);
    const ratioBp = toSafe(
      "combat:survivability",
      (2n * numerator + denominator) / (2n * denominator),
    );
    // cap at one whole: an over-healed fleet survives fully.
    return bp(ratioBp > BP_ONE ? BP_ONE : ratioBp);
  }

  /**
   * Authoritative fixed-point fleet strength, floored once:
   * `firepower * totalArmor * min(hp, maxHp) / (10 * count * maxHp)`.
   *
   * `survivability` caps the HP ratio at one whole, so the effective HP is
   * `min(hp, maxHp)`; this is the exact composition of `damagePotential` and
   * `survivability` without rounding either first.
   */
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
