import { SafeInt } from "@bluewave/contracts";
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

  static damagePotential(fleet: FleetState): number {
    const active = this.activeShips(fleet);
    if (active.length === 0) return 0;
    const firepower = active.reduce((sum, ship) => sum + (ship.firepower as number), 0);
    const armorTotal = active.reduce((sum, ship) => sum + (ship.armor as number), 0);
    const avgArmor = armorTotal / active.length; // float, not truncated SafeInt
    return firepower * (avgArmor / 10);
  }

  static survivability(fleet: FleetState): number {
    const active = this.activeShips(fleet);
    if (active.length === 0) return 0;
    const hp = active.reduce((sum, ship) => sum + (ship.hitPoints as number), 0);
    const maxHp = active.reduce((sum, ship) => sum + (ship.maxHitPoints as number), 0);
    if (maxHp === 0) return 0;
    return Math.min(1, hp / maxHp);
  }
}
