//packages/combat/src/generation/capabilities.ts
// Optional per-battle capability declarations carried by the immutable
// BattleManifest. These are the authoritative, authored battle inputs the
// auto-resolver projects into the tactical stage contexts:
//
//   - smokeSources          -> SmokeContext        (DESIGN-42 / C-5)
//   - airGroups             -> AirCombatContext     (DESIGN-43/44 / D-3)
//   - airDefenseInstallations -> AirDefenseContext  (DESIGN-45 / D-4)
//
// The manifest is the single source of truth: a capability that is absent is
// simply not present in this battle (a valid no-op), never fabricated. The
// declarations reuse the tactical domain types so no second source of truth
// is introduced.
import type { SmokeSourceType } from "../smoke/index.js";
import type { CapEngagementState } from "../air-combat/constants.js";
import type { StrikeMissionPhase } from "../air-combat/strike-state.js";
import type { AirDefenseSystemDefinition } from "../air-defense/air-defense-system-definition.js";

/** A committed smoke source present at the start of the battle (DESIGN-42). */
export interface SmokeSourceDeclaration {
  smokeCloudId: string;
  sourceId: string;
  /** Owning side/nation id (record namespace only). */
  owner: string;
  sourceType: SmokeSourceType;
  centroidPosition: [number, number];
  /** Initial density in basis points (1..10_000). */
  densityBp: number;
  verticalExtentM: number;
  driftVector?: [number, number];
  expansionRate?: number;
  densityDecayRate?: number;
  fuelComposition: string;
  active?: boolean;
}

/** A committed CAP patrol squadron (DESIGN-43 / D-3). */
export interface CapPatrolDeclaration {
  kind: "CAP";
  sideId: "ATTACKER" | "DEFENDER";
  squadronId: string;
  stationPosition: [number, number];
  operationalAircraftCount: number;
  rangeDistance: number;
  speedScore: number;
  /** Default "PATROLLING"; INTERCEPTING/ENGAGING produces an engagement record. */
  engagementState?: CapEngagementState;
  interceptTargetId?: string | null;
}

/** A committed strike mission (DESIGN-43 / D-3). */
export interface StrikeDeclaration {
  kind: "STRIKE";
  sideId: "ATTACKER" | "DEFENDER";
  missionId: string;
  strikeId: string;
  squadronIds: string[];
  /** Target ship assetId; also the air-defense defender the attack engages. */
  targetId: string;
  launchPosition: [number, number];
  speedMps: number;
  fuelRemainingMinutes: number;
  /** Default "EN_ROUTE"; "ATTACKING" produces an attack + an air-defense attack. */
  phase?: StrikeMissionPhase;
}

export type AirGroupDeclaration = CapPatrolDeclaration | StrikeDeclaration;

/** A committed air-defense installation defending a ship (DESIGN-45 / D-4). */
export interface AirDefenseInstallationDeclaration {
  /** Ship assetId this installation defends. */
  defenderId: string;
  systems: AirDefenseSystemDefinition[];
  /** Crew quality basis points (0..10_000); default 10_000. */
  crewQuality?: number;
  /** Director scaling basis points; default 10_000 (neutral). */
  directorScalingBp?: number;
  /** Radar diminishing-returns basis points; default 10_000 (neutral). */
  radarDiminishingReturnsBp?: number;
}
