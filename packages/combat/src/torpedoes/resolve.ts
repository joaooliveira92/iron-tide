import type { RandomEngine } from "@bluewave/random";
import type { BattleEvent } from "../battleLedger.js";
import type { TacticalContact } from "../contact/lifecycle.js";
import type { Position } from "../spotting/detection.js";
import type { ShipDamageState } from "../damage/state.js";
import type { TurretComponent } from "../damage/turretStates.js";
import type { FloodingIsolationState } from "./constants.js";
import type { CompiledTorpedoRegistry } from "./registry.js";
import type { TorpedoSalvoPolicyInputs } from "./salvo.js";
import type { TorpedoTrack } from "./track.js";
import type { TargetHitProfile } from "./hit-resolution.js";
import type { TorpedoImpactZone, TorpedoTargetProtectionLevel } from "./detonation.js";
import type {
  TorpedoDamageApplicationInput,
  TorpedoDamageControlAccessibility,
  TorpedoImpactSide,
} from "./damagePackage.js";
import type { SystemShockCandidate } from "./systemShock.js";
import type { TorpedoLauncherState } from "./state.js";
import type { TorpedoRecord } from "./records.js";
import { runAdvanceStage, runHitDetonationStage, runLaunchStage } from "./torpedoStages.js";
import { buildTorpedoResolution, createTorpedoRun, runDamageStage } from "./torpedoRun.js";

export {
  TORPEDO_DEFAULT_ORDERED_GYRO_MDEG,
  TORPEDO_RESOLUTION_DEFAULT_DEPTH_M,
  TORPEDO_RESOLUTION_EVENT_PRIORITY,
  TORPEDO_RESOLVE_IMPACT_SUBSTEP,
} from "./torpedoSupport.js";

export interface TorpedoLauncherWiring {
  launcher: TorpedoLauncherState;
  ownerShipId: string;
  sideId: string;
  crewQualityBp: number;
  commandSource: string;
  launchPointOffsetUm?: readonly [number, number];
  aboveWaterMaxLaunchSpeedKnots?: number | null;
}

export interface TorpedoLaunchCommand {
  shipId: string;
  launcherId: string;
  tubeIndexes: readonly number[];
  targetContactId: string;
  firingSubstep?: number;
  selectedSettingId?: string | null;
  orderedGyroAngleMdeg?: number;
  depthSettingM?: number;
  salvoPolicy: TorpedoSalvoPolicyInputs;
}

export interface TorpedoTargetScene {
  impactSide: TorpedoImpactSide;
  longitudinalPositionM: number;
  hullBreachAreaM2: number;
  fireProbabilityBp: number;
  crewCasualties: number;
  damageControlAccessibility: TorpedoDamageControlAccessibility;
  isolationState: FloodingIsolationState;
}

export interface TorpedoTargetContext {
  shipId: string;
  contactId: string;
  profile: TargetHitProfile;
  zone: TorpedoImpactZone;
  protectionLevel: TorpedoTargetProtectionLevel;
  scene: TorpedoTargetScene;
  damageState: ShipDamageState;
  designFlotationReserve: number;
  designStabilityScore: number;
  flooding: TorpedoDamageApplicationInput["flooding"];
  machinery?: { zone: TorpedoImpactZone; machineryComponents: readonly string[] };
  shockCandidates?: readonly SystemShockCandidate[];
  turretComponents?: readonly TurretComponent[];
  tubeHazard?: TorpedoDamageApplicationInput["tubeHazard"];
}

export interface TorpedoContext {
  launchers: readonly TorpedoLauncherWiring[];
  commands: readonly TorpedoLaunchCommand[];
  targets: Record<string, TorpedoTargetContext>;
  tracks?: readonly TorpedoTrack[];
  torpedoes: CompiledTorpedoRegistry;
}

export interface ResolveTorpedoesInput {
  battleId: string;
  minute: number;
  context: TorpedoContext;
  contacts: readonly TacticalContact[];
  shipPositions: Readonly<Record<string, Position>>;
  shipHeadings: Readonly<Record<string, number>>;
  shipSpeedsUmS: Readonly<Record<string, number>>;
  engine?: RandomEngine;
}

export interface TorpedoResolution {
  records: readonly TorpedoRecord[];
  events: readonly BattleEvent[];
  launcherStates: Readonly<Record<string, TorpedoLauncherState>>;
  tracks: readonly TorpedoTrack[];
  damageStates: Readonly<Record<string, ShipDamageState>>;
  changed: boolean;
}

export function resolveTorpedoes(input: ResolveTorpedoesInput): TorpedoResolution {
  const run = createTorpedoRun(input);
  runLaunchStage(run);
  const advance = runAdvanceStage(run);
  const { continuedTracks, damageQueue } = runHitDetonationStage(run, advance);
  runDamageStage(run, damageQueue);
  return buildTorpedoResolution(run, continuedTracks);
}
