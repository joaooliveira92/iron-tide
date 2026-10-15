// DESIGN-40 §12–§22 torpedo fire-resolution engine stage (INC-7, AC-22) —
// `resolveTorpedoes`, the pure stage the DESIGN-38 minute-advance engine calls
// AFTER the damage stage. It orchestrates the INC-1..INC-6 modules into one
// deterministic per-minute chain:
//
//   reservation → launch (ascending tube order, §12 failure/stuck semantics)
//     → track creation → track advance (distance/time) → hit resolution
//     (§14 geometry/arming/depth/legality/ordering) → detonation (§15 keyed
//     reliability) → damage package + flooding/machinery/shock/hazard/chain
//     (INC-6 seams, atomic application) → §27 records → §28 ordering.
//
// PER-MINUTE ORDERING (deterministic, documented):
//   - Launch substep = TORPEDO_LAUNCH_SUBSTEP (4). Accepted-salvo commands are
//     processed in §28 levels 1-3 order (side → firing ship → launcher); each
//     salvo fires its tubes in ASCENDING tube-identifier order (the §12 rule).
//   - After all launches, every RUNNING track advances for the rest of the
//     minute; evaluation substep = TORPEDO_RESOLVE_IMPACT_SUBSTEP (56) in §28
//     levels 5-7 order.
//
// DETERMINISM: the ONLY randomness is the injected keyedRng seam (per stream
// from a shared @bluewave/random RandomEngine; a deterministic 0 when no engine
// is supplied). No ambient clock, Math.random, env, filesystem, or locale. The
// stage never mutates any input — every transition is an immutable copy-out.
//
// The stage logic is split across ./torpedoRun.js (state + damage + assembly) and
// ./torpedoStages.js (launch/advance/hit); the shared constants, §27 record
// builder, and guards live in ./torpedoSupport.js.
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

// The stage constants live in ./torpedoSupport.js; re-exported here so the
// public torpedo surface is unchanged.
export {
  TORPEDO_DEFAULT_ORDERED_GYRO_MDEG,
  TORPEDO_RESOLUTION_DEFAULT_DEPTH_M,
  TORPEDO_RESOLUTION_EVENT_PRIORITY,
  TORPEDO_RESOLVE_IMPACT_SUBSTEP,
} from "./torpedoSupport.js";

// the per-minute stage surfaces

export interface TorpedoLauncherWiring {
  /** authoritative §2 launcher state (threaded across minutes). */
  launcher: TorpedoLauncherState;
  /** the platform (ship) that owns this launcher — must be a battle unit. */
  ownerShipId: string;
  sideId: string;
  /** crew skill for the §12 failure composition [0, 10_000] bp. */
  crewQualityBp: number;
  /** the recorded command source (CENTRAL/local/player — audit provenance). */
  commandSource: string;
  /** per-launcher launch point offset from the ship's position (integer µm). */
  launchPointOffsetUm?: readonly [number, number];
  /** the §8 above-water resolved maximum (knots) or null — the phase layer
   *  resolves it; null on an above-water mount fails closed with
   *  TORPEDO_LAUNCH_SPEED_LIMIT_MISSING (the authoritative gate). */
  aboveWaterMaxLaunchSpeedKnots?: number | null;
}

export interface TorpedoLaunchCommand {
  /** the firing platform (must own the launcher). */
  shipId: string;
  launcherId: string;
  /** the accepted salvo's tubes (any order; fired ascending). */
  tubeIndexes: readonly number[];
  /** the legal target contact id or the §13 NO_TARGET_CONTACT marker. */
  targetContactId: string;
  /** the declared firing substep (default TORPEDO_LAUNCH_SUBSTEP). */
  firingSubstep?: number;
  /** the selected §1 ordered setting id; null ⇒ the model's first setting. */
  selectedSettingId?: string | null;
  /** ordered gyro angle (integer milli-degrees, full circle 360_000). */
  orderedGyroAngleMdeg?: number;
  /** torpedo depth setting (integer metres). */
  depthSettingM?: number;
  /** the §11 salvo policy (the deterministic continuation permit + the
   *  solution-quality carrier recorded on the launch records). */
  salvoPolicy: TorpedoSalvoPolicyInputs;
}

/** The caller/phase layer's resolved §16 impact scene — the engine has no ship
 *  design knowledge; the impact-side/longitudinal/breach figures come from the
 *  ship design + impact geometry the caller supplies. */
export interface TorpedoTargetScene {
  impactSide: TorpedoImpactSide;
  longitudinalPositionM: number;
  hullBreachAreaM2: number;
  fireProbabilityBp: number; // [0, 10_000]
  crewCasualties: number;
  damageControlAccessibility: TorpedoDamageControlAccessibility;
  /** §18 progressive-rate isolation surface. */
  isolationState: FloodingIsolationState;
}

export interface TorpedoTargetContext {
  /** the physical target ship id (record provenance). */
  shipId: string;
  /** the legal contract id this target is tracked by (§28 level 6 key). */
  contactId: string;
  /** caller-supplied authoritative collision geometry (radius/draft). */
  profile: TargetHitProfile;
  /** §17 impact zone (detonation + damage-package impact zone). */
  zone: TorpedoImpactZone;
  /** the underwater-protection resistance (§15/§17). */
  protectionLevel: TorpedoTargetProtectionLevel;
  /** the authorized §16 impact scene. */
  scene: TorpedoTargetScene;
  /** current authoritative damage state (threaded across minutes). */
  damageState: ShipDamageState;
  /** design (full) flotation reserve for the terminal % seam. */
  designFlotationReserve: number;
  /** design stability bp [1, 10_000] for the terminal % seam. */
  designStabilityScore: number;
  /** §18 per-compartment flooding-creation inputs (creation-only). */
  flooding: TorpedoDamageApplicationInput["flooding"];
  /** §19 machinery context (omit → no machinery draw). */
  machinery?: { zone: TorpedoImpactZone; machineryComponents: readonly string[] };
  /** §20 nearby-system shock pool (omit → no shock draw). */
  shockCandidates?: readonly SystemShockCandidate[];
  /** caller's turret list (the applyTurretDamage seam on shocked turrets). */
  turretComponents?: readonly TurretComponent[];
  /** §21 tube-hazard context — present ONLY for tube-bay launchers on this
   *  ship (the launcher's loaded surface). */
  tubeHazard?: TorpedoDamageApplicationInput["tubeHazard"];
}

/** The INC-7 torpedo stage input (analogue of GunneryBattery[]/DamageContext —
 *  optional in the engine input; absent ⇒ strict no-op). */
export interface TorpedoContext {
  /** the authoritative launchers (with their wiring). */
  launchers: readonly TorpedoLauncherWiring[];
  /** the accepted-salvo commands for this minute (any order). */
  commands: readonly TorpedoLaunchCommand[];
  /** per-ship target contexts (the legal geometry + damage surface). */
  targets: Record<string, TorpedoTargetContext>;
  /** RUNNING spokes threaded from previous minutes (never terminal). */
  tracks?: readonly TorpedoTrack[];
  /** the battle's compiled-torpedo records, keyed by torpedo part id (ticket 13b). */
  torpedoes: CompiledTorpedoRegistry;
}

export interface ResolveTorpedoesInput {
  battleId: string;
  minute: number;
  context: TorpedoContext;
  /** the engine's legal-contract surface (fog gate; §14 known tracks). */
  contacts: readonly TacticalContact[];
  shipPositions: Readonly<Record<string, Position>>;
  /** integer degrees [0, 359] (the movement heading surface). */
  shipHeadings: Readonly<Record<string, number>>;
  /** integer µm/s (the movement currentSpeed surface). */
  shipSpeedsUmS: Readonly<Record<string, number>>;
  /** shared keyed RNG (battle seed); absent ⇒ deterministic fixed path. */
  engine?: RandomEngine;
}

export interface TorpedoResolution {
  /** the §28-ordered §27 records emitted this minute. */
  records: readonly TorpedoRecord[];
  /** ledger-ready BattleEvents (one per record; eventHash = recordHash). */
  events: readonly BattleEvent[];
  /** updated launcher states (launcherId → state) — only launchers that fired. */
  launcherStates: Readonly<Record<string, TorpedoLauncherState>>;
  /** the RUNNING tracks after this minute (the next-minute thread surface). */
  tracks: readonly TorpedoTrack[];
  /** per-ship damage-state updates from torpedo damage applications. */
  damageStates: Readonly<Record<string, ShipDamageState>>;
  /** whether the stage produced any events/state this minute. */
  changed: boolean;
}

/** Builds the run state, then executes the four ordered stages: launch →
 *  advance → hit resolution + detonation → damage, and assembles the
 *  §28-ordered records. */
export function resolveTorpedoes(input: ResolveTorpedoesInput): TorpedoResolution {
  const run = createTorpedoRun(input);
  runLaunchStage(run);
  const advance = runAdvanceStage(run);
  const { continuedTracks, damageQueue } = runHitDetonationStage(run, advance);
  runDamageStage(run, damageQueue);
  return buildTorpedoResolution(run, continuedTracks);
}
