import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
export interface BattleEvent {
  battleId: string;
  minute: number;
  substep: number;
  eventPriority: number;
  actorId: string;
  targetId: string;
  eventId: string;
  eventType: string;
  causeId?: string;
  preHash?: string;
  postHash?: string;
  rngDecisionId?: string;
  visibility?: string;
  eventHash?: string;
}
export function canonicalEventOrder(a: BattleEvent, b: BattleEvent): number {
  return (
    a.minute - b.minute ||
    a.substep - b.substep ||
    a.eventPriority - b.eventPriority ||
    (a.actorId < b.actorId ? -1 : a.actorId > b.actorId ? 1 : 0) ||
    (a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0) ||
    (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0)
  );
}
export class BattleLedger {
  private events: BattleEvent[] = [];
  append(e: BattleEvent) {
    const h = sha256Hex(canonicalSerialize(e));
    this.events.push({ ...e, eventHash: h });
  }
  sorted(): BattleEvent[] {
    return [...this.events].sort(canonicalEventOrder);
  }
  hash(): string {
    return sha256Hex(canonicalSerialize(this.sorted()));
  }
  get all(): readonly BattleEvent[] {
    return this.events;
  }
}
