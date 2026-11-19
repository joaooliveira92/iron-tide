import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { TacticalContact } from "../contact/neighbour.js";
import { DETECTION_GEOMETRY_METRE_UM } from "../spotting/detection.js";
import { BATTLE_VIEW_TUNING, type BattleViewTuning } from "./battleViewTuning.js";
import type {
  BattleViewContact,
  BattleViewLogEntry,
  PointM,
  SightingTier,
} from "./battleViewTypes.js";
import type { PlayerBattleEvent, PlayerBattleSession } from "./playerSessionTypes.js";

export const NAUTICAL_MILE_METRES = 1_852 as const;
export const CONTACT_HANDLE_DOMAIN = "battle_view_contact_v1" as const;
const CONTACT_HANDLE_LENGTH = 16;

export function toMetres(um: number): number {
  return Math.floor(um / DETECTION_GEOMETRY_METRE_UM);
}

export function pointMetres(position: readonly [number, number]): PointM {
  return [toMetres(position[0]), toMetres(position[1])];
}

export function contactHandle(battleId: string, assetId: string): string {
  return sha256Hex(canonicalSerialize({ domain: CONTACT_HANDLE_DOMAIN, battleId, assetId })).slice(
    0,
    CONTACT_HANDLE_LENGTH,
  );
}

export function visibilityMetres(session: PlayerBattleSession): number {
  return Math.floor(session.state.weather.visibilityNm * NAUTICAL_MILE_METRES);
}

function nearestSquaredMetres(point: PointM, observers: readonly PointM[]): number | null {
  let best: number | null = null;
  for (const observer of observers) {
    const dx = point[0] - observer[0];
    const dy = point[1] - observer[1];
    const squared = dx * dx + dy * dy;
    if (best === null || squared < best) best = squared;
  }
  return best;
}

export function sightingTier(
  contact: TacticalContact,
  observers: readonly PointM[],
  visibilityM: number,
  tuning: BattleViewTuning = BATTLE_VIEW_TUNING,
): SightingTier {
  if (contact.stale) return "UNIDENTIFIED";
  const squared = nearestSquaredMetres(pointMetres(contact.position), observers);
  if (squared === null) return "UNIDENTIFIED";
  const { scaleBp, classMaxBp, typeMaxBp } = tuning.sightingTier;
  const classM = Math.floor((visibilityM * classMaxBp) / scaleBp);
  const typeM = Math.floor((visibilityM * typeMaxBp) / scaleBp);
  if (squared <= classM * classM) return "CLASS";
  if (squared <= typeM * typeM) return "TYPE";
  return "UNIDENTIFIED";
}

export interface ContactIdentityOf {
  readonly shipType: string | null;
  readonly className: string | null;
}

export function projectContact(
  session: PlayerBattleSession,
  contact: TacticalContact,
  tier: SightingTier,
  identity: ContactIdentityOf,
): BattleViewContact {
  const base = {
    handle: contactHandle(session.battleId, contact.assetId),
    positionM: pointMetres(contact.position),
    ageMinutes: Math.max(0, session.minute - contact.lastUpdateMinute),
    courseDeg: contact.course,
    speedMilliKnots: contact.speed,
    confidenceBp: contact.confidence,
    stale: contact.stale,
  };
  if (tier === "CLASS" && identity.shipType !== null && identity.className !== null) {
    return { ...base, tier, shipType: identity.shipType, className: identity.className };
  }
  if ((tier === "TYPE" || tier === "CLASS") && identity.shipType !== null) {
    return { ...base, tier: "TYPE", shipType: identity.shipType };
  }
  return { ...base, tier: "UNIDENTIFIED" };
}

export interface LogResolver {
  readonly ownIds: ReadonlySet<string>;
  readonly ownPositions: ReadonlyMap<string, PointM>;
  readonly contactsByAsset: ReadonlyMap<string, BattleViewContact>;
}

const BATTERY_SEPARATOR = ":";

function assetOf(id: string, battleId: string, resolver: LogResolver): string {
  const qualified = `${battleId}${BATTERY_SEPARATOR}`;
  const unqualified = id.startsWith(qualified) ? id.slice(qualified.length) : id;
  const known = (candidate: string): boolean =>
    resolver.ownIds.has(candidate) || resolver.contactsByAsset.has(candidate);
  if (known(unqualified)) return unqualified;
  const separator = unqualified.lastIndexOf(BATTERY_SEPARATOR);
  return separator === -1 ? unqualified : unqualified.slice(0, separator);
}

function refOf(id: string, battleId: string, resolver: LogResolver): string | null | undefined {
  if (id === "") return null;
  const asset = assetOf(id, battleId, resolver);
  if (resolver.ownIds.has(asset)) return asset;
  return resolver.contactsByAsset.get(asset)?.handle;
}

function actorPosition(
  actorId: string,
  event: PlayerBattleEvent,
  session: PlayerBattleSession,
  resolver: LogResolver,
): PointM | null {
  if (event.minute !== session.minute) return null;
  const own = resolver.ownPositions.get(actorId);
  if (own !== undefined) return own;
  const contact = resolver.contactsByAsset.get(actorId);
  return contact !== undefined && !contact.stale ? contact.positionM : null;
}

export function projectLog(
  session: PlayerBattleSession,
  resolver: LogResolver,
  tuning: BattleViewTuning = BATTLE_VIEW_TUNING,
): readonly BattleViewLogEntry[] {
  const entries: BattleViewLogEntry[] = [];
  for (const event of session.log) {
    const severity = tuning.logSeverity[event.eventType];
    if (severity === undefined) continue;
    const actorAsset = assetOf(event.actorId, session.battleId, resolver);
    const actorRef = refOf(event.actorId, session.battleId, resolver);
    if (actorRef === undefined || actorRef === null) continue;
    const targetRef = refOf(event.targetId, session.battleId, resolver);
    const actorIsOwn = resolver.ownIds.has(actorAsset);
    if (targetRef === undefined && !actorIsOwn) continue;
    entries.push({
      minute: event.minute,
      severity,
      eventType: event.eventType,
      actorRef,
      targetRef: targetRef ?? null,
      actorPositionM: actorPosition(actorAsset, event, session, resolver),
    });
  }
  return entries;
}
