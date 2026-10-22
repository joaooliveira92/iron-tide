import type { ShipDamageState } from "../damage/state.js";
import {
  TORPEDO_PROGRESSIVE_FLOODING_CREATED,
  UNDERWATER_TUBE_SEVERE_FLOODING,
} from "../torpedoes/reasonCodes.js";

export type LossCause = "gunfire" | "fire" | "flooding" | "torpedo";

const TORPEDO_FLOOD_CAUSES: ReadonlySet<string> = new Set([
  TORPEDO_PROGRESSIVE_FLOODING_CREATED,
  UNDERWATER_TUBE_SEVERE_FLOODING,
]);

interface Buckets {
  gunfire: number;
  flooding: number;
  torpedo: number;
}

const hasTorpedoFlooding = (s: ShipDamageState): boolean =>
  s.floodingRecords.some((r) => TORPEDO_FLOOD_CAUSES.has(r.cause));

export class CauseOfLossTracker {
  private readonly buckets = new Map<string, Buckets>();
  private readonly causes = new Map<string, LossCause>();

  observe(
    shipId: string,
    pre: ShipDamageState,
    post: ShipDamageState,
    torpedoHitThisMinute: boolean,
  ): void {
    if (this.causes.has(shipId) || pre.terminalStatus !== "NORMAL") return;
    let b = this.buckets.get(shipId);
    if (!b) {
      b = { gunfire: 0, flooding: 0, torpedo: 0 };
      this.buckets.set(shipId, b);
    }
    const dFlot = Math.max(0, pre.flotationReserve - post.flotationReserve);
    const dStruct = Math.max(0, pre.structuralIntegrity - post.structuralIntegrity);
    const dFlood = Math.max(0, post.progressiveFloodingTotal - pre.progressiveFloodingTotal);
    const floodPart = Math.min(dFlot, dFlood);
    const directPart = dFlot - floodPart + dStruct;
    if (floodPart > 0) {
      if (hasTorpedoFlooding(pre) || hasTorpedoFlooding(post)) b.torpedo += floodPart;
      else b.flooding += floodPart;
    }
    if (directPart > 0) {
      if (torpedoHitThisMinute) b.torpedo += directPart;
      else b.gunfire += directPart;
    }
    if (post.terminalStatus !== "NORMAL") {
      let cause: LossCause;
      if (b.torpedo === 0 && b.flooding === 0 && b.gunfire === 0) {
        cause = post.fireRecords.length > 0 || pre.fireRecords.length > 0 ? "fire" : "gunfire";
      } else if (b.torpedo >= b.flooding && b.torpedo >= b.gunfire) cause = "torpedo";
      else if (b.flooding >= b.gunfire) cause = "flooding";
      else cause = "gunfire";
      this.causes.set(shipId, cause);
    }
  }

  causeOf(shipId: string): LossCause | undefined {
    return this.causes.get(shipId);
  }
}
