// DESIGN-40 §6 launch eligibility — every predicate enforced, fail-closed,
// consuming NO torpedo and producing exactly one explicit reason code through a
// structured verdict (never throw-only, except the REUSED validateTargetOrder
// fog gate which throws the combat-catalog TACTICAL_FOG_OF_WAR_VIOLATION for an
// unknown or zero-confidence contact — the documented single choke point).
//
// Reason-code mapping (documented best-fit where DESIGN-40 §29 names no
// predicate-specific code — each is one of the shipped in-slice codes):
//   authority (no/unknown grant)        -> TORPEDO_LAUNCH_AUTHORITY_DENIED
//   authority (manual in ADMIRAL/REAR)  -> TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED
//   launcher/tubes not operational      -> INVALID_TORPEDO_LAUNCHER_STATE (best-fit)
//   tube empty                          -> TORPEDO_AMMUNITION_UNAVAILABLE
//   loaded model incompatible           -> TORPEDO_MODEL_INCOMPATIBLE
//   reload/safety interlock open        -> INVALID_TORPEDO_LAUNCHER_STATE (best-fit)
//   contact confidence < 4_000 bp       -> TORPEDO_TARGET_CONTACT_INSUFFICIENT
//   unknown/zero-confidence contact     -> TACTICAL_FOG_OF_WAR_VIOLATION (thrown, reused gate)
//   confirmed friendly target / §24     -> TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED (§24 family,
//                                          INC-3 — the INC-2 DEFERRED marker is RETIRED)
//   arc/bearing outside limits          -> TORPEDO_LAUNCH_ARC_INVALID
//   range outside selected setting      -> TORPEDO_TARGET_CONTACT_INSUFFICIENT (best-fit)
//   arming distance not satisfiable     -> TORPEDO_TARGET_CONTACT_INSUFFICIENT (best-fit)
//   solution quality below §10 minimum  -> TORPEDO_FIRE_SOLUTION_INSUFFICIENT
//   §7 underwater speed exceeded        -> UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED
//   §8 above-water speed exceeded       -> UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED (best-fit §29 reuse)
//   §8 above-water speed metadata missing -> TORPEDO_LAUNCH_SPEED_LIMIT_MISSING
//   maneuver violates fire-control limit  -> TORPEDO_FIRE_SOLUTION_INSUFFICIENT (§9 own-maneuver input)
//   sea state above the launched ceiling  -> TORPEDO_FIRE_SOLUTION_INSUFFICIENT (§9 sea-state input)
//   ammunition reservation would fail     -> TORPEDO_AMMUNITION_UNAVAILABLE
//
// Seams (recorded, not fabricated):
//   - fire-solution QUALITY is computed by INC-3's §10 11-factor formula
//     (fire-solution.ts computeTorpedoSolutionQuality); the aggregate takes the
//     already-computed integer bp value as the §6 predicate-10 input and applies
//     the §24 friendly-danger-sector raise via assessFriendlyFireRisk.
//   - the §6 sea-state rule is not pinned by DESIGN-40; the shipped ceiling is
//     the authored versioned-ruleset constant TORPEDO_MAX_LAUNCH_SEA_STATE on
//     the B-5 integer scale 0..9, decoupled from the B-5 module.
//   - the §24 friendly-fire family is REAL in INC-3 (danger sector, 1_000 m
//     separation, §10 quality raise — friendly-fire.ts). The INC-2 DEFERRED
//     marker is retired; every predicate now reports a plain boolean.
//   - SUBMARINE_INTERNAL model-specific speed limits -> C-3 (recorded).
// Pure/deterministic: no ambient I/O/clock/random.
import {
  EMPTY_TUBE,
  type TorpedoLaunchKind,
  TORPEDO_MAX_LAUNCH_SEA_STATE,
  TORPEDO_TARGET_CONTACT_MINIMUM_BP,
} from "./constants.js";
import {
  resolvedAboveWaterMaxLaunchSpeedKnots,
  type TorpedoLauncherDefinition,
} from "./launcher.js";
import {
  diameterFitsLauncher,
  fireControlSupportsModel,
  launcherFamilyMatches,
  massWithinLimits,
  propulsionAndSafetySupported,
} from "./compatibility.js";
import { type AuthorityGrant, validateLaunchAuthority } from "./authority.js";
import type { CompiledTorpedo, CompiledTorpedoSpeedSetting } from "@bluewave/armament";
import { compiledTorpedoOf, type CompiledTorpedoRegistry } from "./registry.js";
import {
  INVALID_TORPEDO_LAUNCHER_STATE,
  TORPEDO_AMMUNITION_UNAVAILABLE,
  TORPEDO_FIRE_SOLUTION_INSUFFICIENT,
  TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED,
  TORPEDO_LAUNCH_ARC_INVALID,
  TORPEDO_MODEL_INCOMPATIBLE,
  TORPEDO_TARGET_CONTACT_INSUFFICIENT,
  type TorpedoReasonCode,
  UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
} from "./reasonCodes.js";
import { type TorpedoLauncherState } from "./state.js";
import {
  validateAboveWaterLaunchSpeedLimit,
  validateUnderwaterTubeSpeedLimit,
} from "./launch-speed.js";
import { type ContactTrack, validateTargetOrder } from "../targeting.js";
import { solutionMeetsMinimum } from "./fire-solution.js";
import {
  assessFriendlyFireRisk,
  type FriendlyFireRiskAssessment,
  type FriendlyTrack,
} from "./friendly-fire.js";
import { assertEligibilityInputs, invariant } from "./eligibilityInputs.js";
export { TORPEDO_SEA_STATE_MAX, TORPEDO_SEA_STATE_MIN } from "./eligibilityInputs.js";

export type TorpedoEligibilityPredicate =
  | "authority"
  | "launcherAndTubesOperational"
  | "compatibleTorpedoesLoaded"
  | "reloadAndSafetyInterlocks"
  | "targetContactConfidence"
  | "targetNotFriendly"
  | "launchArc"
  | "rangeWithinSetting"
  | "armingDistanceSatisfiable"
  | "fireSolutionQuality"
  | "ownSpeedWithinLauncherLimits"
  | "ownManeuverWithinFireControlLimit"
  | "seaStatePermitsLaunch"
  | "friendlyFireSafety"
  | "ammunitionReservation";

export type EligibilityPredicateResult = boolean;

export interface LaunchEligibilityVerdict {
  eligible: boolean;
  // Every §6 predicate, in DESIGN-40 §6 order, as a plain boolean — INC-3
  // retires the INC-2 "DEFERRED" marker: every predicate is now REAL (the §24
  // friendly-fire family ships with friendly-fire.ts).
  predicateResults: Record<TorpedoEligibilityPredicate, EligibilityPredicateResult>;
  failingPredicate: TorpedoEligibilityPredicate | null;
  reasonCode: TorpedoReasonCode | null; // exactly one explicit §29 code when not eligible
  consumedTorpedo: false; // eligibility NEVER consumes a torpedo (§6)
}

// AC-6 input surface. All numeric fields are integers; structurally-invalid
// inputs fail closed with TORPEDO_STATE_INVARIANT_FAILED before any predicate.
export interface LaunchEligibilityInputs {
  state: TorpedoLauncherState; // authoritative (§2) — full guard revalidated
  definition: TorpedoLauncherDefinition; // static §2 family content for this launcher
  tubeIndexes: readonly number[]; // the exact salvo tubes (§11; validated in [0, tubeCount))
  authorityGrant: AuthorityGrant | null | undefined;
  manualLaunch: boolean; // true = ManualTorpedoLaunchCommand path; false = §5.4 AI/automated
  contactId: string; // target contact reference (fog gate + confidence)
  knownTracks: Map<string, ContactTrack> | ContactTrack[]; // firing-side knowledge only
  friendlyIdentities: readonly string[]; // confirmed-friendly estimated identities
  targetRelativeBearingMdeg: number; // integer milli-degrees vs launcher training limits
  targetEstimatedRangeM: number; // integer metres (knowledge estimate, §9)
  selectedSetting: CompiledTorpedoSpeedSetting; // selected speed/range setting (§11 command; membership in the
  // loaded model's speedSettings is the §11/INC-4 command contract — documented seam)
  torpedoes: CompiledTorpedoRegistry; // the battle's compiled-torpedo records (keyed by part id)
  launchKind: TorpedoLaunchKind;
  fireSolutionQualityBp: number; // integer bp [0, 10_000] — INC-3 §10 formula output (seam)
  ownSpeedMicrometresPerSecond: number; // integer µm/s (B-2 movement speed model surface)
  ownManeuverWithinFireControlLimit: boolean; // §6 maneuver predicate (fire-control limit)
  seaState: number; // integer 0..9 (B-5 scale; decoupled input)
  // §24 friendly-fire inputs (INC-3): the firing side's RELATIVE friendly
  // tracks + solution uncertainty + salvo spread. The engine stage INC-7
  // computes the relative tracks from positions; eligibility consumes the
  // pure assessment (friendly-fire.ts).
  friendlyTracks: readonly FriendlyTrack[];
  solutionUncertaintyM: number; // integer metres (§9 target-contact uncertainty)
  spreadHalfAngleMdeg: number; // integer milli-degrees (salvo spread half-angle)
}

// ---- Per-predicate pure functions (individually testable) ---------------------

// §6: the launcher and every selected tube are operational. The §2 state models
// damage at the launcher level only (no per-tube damage field), so "tubes
// operational" is the launcher OPERATIONAL + valid tube selection (validity is
// already invariant-checked; a damaged launcher fails here).
export function launcherAndTubesOperational(state: TorpedoLauncherState): boolean {
  return state.damageState === "OPERATIONAL";
}

// §6: every selected tube carries a loaded torpedo whose model is mechanically
// compatible with this launcher family (§1 compatibleLauncherFamilyIds × §2
// launcherFamilyId, diameter, mass, propulsion/safety, fire control). An EMPTY
// tube or an incompatible/unknown loaded model fails the predicate (the
// aggregate maps EMPTY -> TORPEDO_AMMUNITION_UNAVAILABLE and incompatibility ->
// TORPEDO_MODEL_INCOMPATIBLE). Platform tech/adoption + inventory are
// install-time gates (§4) and are NOT re-checked at launch.
export function tubesCarryCompatibleTorpedoes(
  state: TorpedoLauncherState,
  definition: TorpedoLauncherDefinition,
  tubeIndexes: readonly number[],
  torpedoes: CompiledTorpedoRegistry,
): boolean {
  for (const idx of tubeIndexes) {
    const loaded = state.loadedPerTube[idx];
    // EMPTY_TUBE is the "EMPTY" marker — a non-empty string that is NOT a model
    // id; it must fail compatibility without reaching compiledTorpedoOf.
    if (loaded === EMPTY_TUBE || typeof loaded !== "string" || loaded.length === 0) return false;
    const model = compiledTorpedoOf(torpedoes, loaded); // fail-closed: unknown id throws
    if (!launcherFamilyMatches(model, definition)) return false;
    if (!diameterFitsLauncher(model, definition)) return false;
    if (!massWithinLimits(model, definition)) return false;
    if (!propulsionAndSafetySupported(model, definition)) return false;
    if (!fireControlSupportsModel(model, definition)) return false;
  }
  return true;
}

// §6: the tube-loading surface used by both compatibleTorpedoesLoaded and
// ammunitionReservation — the loaded model ids of the selected tubes.
export function loadedModelsForTubes(
  state: TorpedoLauncherState,
  tubeIndexes: readonly number[],
  torpedoes: CompiledTorpedoRegistry,
): CompiledTorpedo[] {
  const models: CompiledTorpedo[] = [];
  for (const idx of tubeIndexes) {
    const loaded = state.loadedPerTube[idx];
    if (loaded === EMPTY_TUBE || typeof loaded !== "string" || loaded.length === 0)
      invariant("loadedPerTube", loaded, "a selected tube must be loaded for eligibility");
    models.push(compiledTorpedoOf(torpedoes, loaded));
  }
  return models;
}

// §6: reload + safety interlocks complete. Interlock surface from the §2 state:
// no reload in progress, fire-control connection CONNECTED, and flooding
// isolation not FAILED (a failed isolation means a flooded compartment — the
// tube bay is unsafe to operate). Authored interpretation of "safety interlocks"
// (DESIGN-40 names the state fields but not the exact gate) — recorded in the
// INC-2 report; never a silent fallback.
export function reloadAndSafetyInterlocksComplete(state: TorpedoLauncherState): boolean {
  if (state.reloadState.status !== "NO_RELOAD_IN_PROGRESS") return false;
  if (state.fireControlConnectionState !== "CONNECTED") return false;
  if (state.floodingIsolationState === "FAILED") return false;
  return true;
}

// §6: target contact confidence at least 4_000 bp — AFTER the reused
// validateTargetOrder fog gate (which throws TACTICAL_FOG_OF_WAR_VIOLATION for
// an unknown or zero-confidence contact — the single choke point). A known
// contact below the §6 gate fails with TORPEDO_TARGET_CONTACT_INSUFFICIENT.
export function targetContactConfidenceSufficient(track: ContactTrack): boolean {
  return track.confidence >= TORPEDO_TARGET_CONTACT_MINIMUM_BP;
}

// §6: the target is not identified as a confirmed friendly. An UNIDENTIFIED
// identity is not *identified* as friendly and passes this predicate — the §24
// danger-sector family (which also raises the §10 minimum for unidentified or
// low-confidence contacts) is the REAL friendlyFireSafety predicate below.
// A launch aimed at a confirmed-friendly target reports the §24 family code
// TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED (INC-3 — the INC-2 DEFERRED marker is
// retired).
export function targetNotIdentifiedFriendly(
  track: ContactTrack,
  friendlyIdentities: readonly string[],
): boolean {
  return !(friendlyIdentities as readonly string[]).includes(track.estimatedIdentity);
}

// §6: target relative bearing lies within the launcher training/bearing limits
// (§2 trainingLimitsMdeg, integer milli-degrees).
export function targetWithinLaunchArc(
  state: TorpedoLauncherState,
  targetRelativeBearingMdeg: number,
): boolean {
  return (
    targetRelativeBearingMdeg >= state.trainingLimitsMdeg.min &&
    targetRelativeBearingMdeg <= state.trainingLimitsMdeg.max
  );
}

// §6: target estimated range within the selected setting's maximum run.
export function targetRangeWithinSetting(
  targetEstimatedRangeM: number,
  selectedSetting: CompiledTorpedoSpeedSetting,
): boolean {
  return targetEstimatedRangeM <= selectedSetting.rangeM;
}

// §6: the model's minimum arming distance can be satisfied — the target must be
// at least as far as the binding (maximum) minimum arming distance across the
// fired tubes' loaded models.
export function armingDistanceSatisfiable(
  targetEstimatedRangeM: number,
  models: readonly CompiledTorpedo[],
): boolean {
  const bindingArmingM = models.reduce((max, m) => Math.max(max, m.minimumArmingDistanceM), 0);
  return targetEstimatedRangeM >= bindingArmingM;
}

// §6/§10 (seam): fire-solution quality meets the shipped §10 minimum for the
// launch kind. The QUALITY VALUE is computed by INC-3's §10 11-factor formula
// (fire-solution.ts); this predicate applies the pure threshold check over the
// already-computed integer basis-point value. When the §24 assessment finds a
// friendly/unidentified/low-confidence contact inside the launch danger sector,
// the minimum rises to the 7_500 bp §24 threshold (never waivable by manual
// launch; the Captain-mode manual override only lowers a NON-friendly threshold
// down to 4_000 bp — command-layer seam).
export function fireSolutionQualitySufficient(
  fireSolutionQualityBp: number,
  launchKind: TorpedoLaunchKind,
  friendlyInDangerSector: boolean = false,
): boolean {
  return solutionMeetsMinimum(fireSolutionQualityBp, launchKind, friendlyInDangerSector);
}

// §6: own-ship speed satisfies launcher limits — the §7/§8 pure gates.
// UNDERWATER_FIXED/TRAINABLE -> §7 (25 kn ceiling); ABOVE_WATER_* -> §8
// (resolved max); SUBMARINE_INTERNAL -> not governed by either (model-specific
// limits are C-3, recorded deferred). Returns the best-fit §29 code on failure.
export function ownSpeedWithinLauncherLimits(
  state: TorpedoLauncherState,
  definition: TorpedoLauncherDefinition,
  ownSpeedMicrometresPerSecond: number,
): { passes: boolean; reasonCode: TorpedoReasonCode | null } {
  if (state.mountType === "UNDERWATER_FIXED" || state.mountType === "UNDERWATER_TRAINABLE") {
    const verdict = validateUnderwaterTubeSpeedLimit(ownSpeedMicrometresPerSecond, state.mountType);
    if (!verdict.allowed)
      return { passes: false, reasonCode: UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED };
    return { passes: true, reasonCode: null };
  }
  if (state.mountType === "ABOVE_WATER_FIXED" || state.mountType === "ABOVE_WATER_TRAINABLE") {
    const verdict = validateAboveWaterLaunchSpeedLimit(
      ownSpeedMicrometresPerSecond,
      resolvedAboveWaterMaxLaunchSpeedKnots(definition),
    );
    if (!verdict.allowed) return { passes: false, reasonCode: verdict.reasonCode };
    return { passes: true, reasonCode: null };
  }
  // SUBMARINE_INTERNAL: §7 explicitly does not govern; §8 does not apply.
  // Model-specific submerged/surfaced limits are C-3 (recorded deferred).
  return { passes: true, reasonCode: null };
}

// §6: sea state permits launch — the authored §6 ceiling on the B-5 integer
// scale (decoupled input; the B-5 weather module is never consulted here).
export function seaStatePermitsLaunch(seaState: number): boolean {
  return seaState <= TORPEDO_MAX_LAUNCH_SEA_STATE;
}

// §6: ammunition reservation succeeds — the atomic reserve/consume (§3) would
// find a loaded torpedo in every selected tube. This is a pure check: the
// aggregate NEVER consumes (§6 failure consumes no torpedo).
export function ammunitionReservationSucceeds(
  state: TorpedoLauncherState,
  tubeIndexes: readonly number[],
): boolean {
  return tubeIndexes.every((idx) => {
    const loaded = state.loadedPerTube[idx];
    return loaded !== EMPTY_TUBE && typeof loaded === "string" && loaded.length > 0;
  });
}

// §24 (REAL, INC-3): the friendly-fire safety predicate. The pure
// assessFriendlyFireRisk (friendly-fire.ts) computes the launch danger sector
// (target bearing ± spread half-angle ± solution-uncertainty angle) over the
// firing side's RELATIVE friendly tracks. §24 PROHIBITS the launch when a
// confirmed friendly is inside the sector with a predicted minimum separation
// below 1_000 m (manual launch does NOT waive it); an unidentified or
// low-confidence contact inside the sector raises the §10 minimum via
// raisesMinimumSolutionQuality (consumed by predicate 10).
export function friendlyFireSafetyVerdict(assessment: FriendlyFireRiskAssessment): boolean {
  return !assessment.prohibited;
}

// ---- Aggregate (AC-6) ---------------------------------------------------------

// AC-6: evaluate every §6 predicate in DESIGN-40 §6 order and return the
// structured verdict. The first failing predicate determines the verdict's
// EXACTLY ONE reason code; NO torpedo is ever consumed. The reused
// validateTargetOrder fog gate throws TACTICAL_FOG_OF_WAR_VIOLATION (the combat
// catalog code) for an unknown or zero-confidence contact — the only throw
// path, matching the targeting seam.
export function evaluateLaunchEligibility(
  inputs: LaunchEligibilityInputs,
): LaunchEligibilityVerdict {
  assertEligibilityInputs(inputs);
  const { state, definition, tubeIndexes, launchKind } = inputs;

  // §6 predicate 1 — authority (reuses the §5 guard; AI + player identical).
  const authorityVerdict = validateLaunchAuthority(inputs.authorityGrant, inputs.manualLaunch);
  if (!authorityVerdict.allowed) {
    return {
      eligible: false,
      predicateResults: {
        authority: false,
        launcherAndTubesOperational: true,
        compatibleTorpedoesLoaded: true,
        reloadAndSafetyInterlocks: true,
        targetContactConfidence: true,
        targetNotFriendly: true,
        launchArc: true,
        rangeWithinSetting: true,
        armingDistanceSatisfiable: true,
        fireSolutionQuality: true,
        ownSpeedWithinLauncherLimits: true,
        ownManeuverWithinFireControlLimit: true,
        seaStatePermitsLaunch: true,
        friendlyFireSafety: true,
        ammunitionReservation: true,
      },
      failingPredicate: "authority",
      reasonCode: authorityVerdict.reasonCode as TorpedoReasonCode,
      consumedTorpedo: false,
    };
  }

  const results: Record<TorpedoEligibilityPredicate, EligibilityPredicateResult> = {
    authority: true,
    launcherAndTubesOperational: true,
    compatibleTorpedoesLoaded: true,
    reloadAndSafetyInterlocks: true,
    targetContactConfidence: true,
    targetNotFriendly: true,
    launchArc: true,
    rangeWithinSetting: true,
    armingDistanceSatisfiable: true,
    fireSolutionQuality: true,
    ownSpeedWithinLauncherLimits: true,
    ownManeuverWithinFireControlLimit: true,
    seaStatePermitsLaunch: true,
    friendlyFireSafety: true,
    ammunitionReservation: true,
  };

  const fail = (
    failingPredicate: TorpedoEligibilityPredicate,
    reasonCode: TorpedoReasonCode,
    failedResults: Partial<Record<TorpedoEligibilityPredicate, EligibilityPredicateResult>>,
  ): LaunchEligibilityVerdict => ({
    eligible: false,
    predicateResults: { ...results, ...failedResults },
    failingPredicate,
    reasonCode,
    consumedTorpedo: false,
  });

  // §6 predicate 2 — launcher and selected tubes operational.
  if (!launcherAndTubesOperational(state)) {
    return fail(
      "launcherAndTubesOperational",
      INVALID_TORPEDO_LAUNCHER_STATE, // best-fit: §29 has no damaged-launcher eligibility code
      { launcherAndTubesOperational: false },
    );
  }

  // §6 predicate 3 — compatible torpedoes are loaded.
  if (!ammunitionReservationSucceeds(state, tubeIndexes)) {
    return fail("compatibleTorpedoesLoaded", TORPEDO_AMMUNITION_UNAVAILABLE, {
      compatibleTorpedoesLoaded: false,
      ammunitionReservation: false,
    });
  }
  if (!tubesCarryCompatibleTorpedoes(state, definition, tubeIndexes, inputs.torpedoes)) {
    return fail("compatibleTorpedoesLoaded", TORPEDO_MODEL_INCOMPATIBLE, {
      compatibleTorpedoesLoaded: false,
    });
  }
  const models = loadedModelsForTubes(state, tubeIndexes, inputs.torpedoes);

  // §6 predicate 4 — reload and safety interlocks complete.
  if (!reloadAndSafetyInterlocksComplete(state)) {
    return fail(
      "reloadAndSafetyInterlocks",
      INVALID_TORPEDO_LAUNCHER_STATE, // best-fit: §29 has no interlock-specific code
      { reloadAndSafetyInterlocks: false },
    );
  }

  // §6 predicate 5 — target contact confidence (fog gate FIRST, then §6 gate).
  const track = validateTargetOrder(inputs.contactId, inputs.knownTracks); // throws TACTICAL_FOG_OF_WAR_VIOLATION
  if (!targetContactConfidenceSufficient(track)) {
    return fail("targetContactConfidence", TORPEDO_TARGET_CONTACT_INSUFFICIENT, {
      targetContactConfidence: false,
    });
  }

  // §24 friendly-fire assessment (INC-3, real): computed ONCE here, consumed by
  // predicate 10 (quality raise) and predicate 14 (prohibition). Pure and
  // deterministic; the input seam (relative friendly tracks) is documented.
  const friendlyFire = assessFriendlyFireRisk({
    targetRelativeBearingMdeg: inputs.targetRelativeBearingMdeg,
    targetEstimatedRangeM: inputs.targetEstimatedRangeM,
    solutionUncertaintyM: inputs.solutionUncertaintyM,
    spreadHalfAngleMdeg: inputs.spreadHalfAngleMdeg,
    friendlyTracks: inputs.friendlyTracks,
    friendlyIdentities: inputs.friendlyIdentities,
    manualLaunch: inputs.manualLaunch,
  });

  // §6 predicate 6 — target not identified as friendly (§24 family code).
  if (!targetNotIdentifiedFriendly(track, inputs.friendlyIdentities)) {
    return fail("targetNotFriendly", TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED, {
      targetNotFriendly: false,
    });
  }

  // §6 predicate 7 — arc/bearing within training limits.
  if (!targetWithinLaunchArc(state, inputs.targetRelativeBearingMdeg)) {
    return fail("launchArc", TORPEDO_LAUNCH_ARC_INVALID, { launchArc: false });
  }

  // §6 predicate 8 — range within selected setting limits.
  if (!targetRangeWithinSetting(inputs.targetEstimatedRangeM, inputs.selectedSetting)) {
    return fail(
      "rangeWithinSetting",
      TORPEDO_TARGET_CONTACT_INSUFFICIENT, // best-fit: contact not legally engageable at this setting
      { rangeWithinSetting: false },
    );
  }

  // §6 predicate 9 — minimum arming distance satisfiable.
  if (!armingDistanceSatisfiable(inputs.targetEstimatedRangeM, models)) {
    return fail(
      "armingDistanceSatisfiable",
      TORPEDO_TARGET_CONTACT_INSUFFICIENT, // best-fit: contact geometry cannot arm the torpedo
      { armingDistanceSatisfiable: false },
    );
  }

  // §6 predicate 10 — fire-solution quality meets §10 (seam: value computed by
  // INC-3 fire-solution.ts; the §24 danger-sector raise applies here).
  if (
    !fireSolutionQualitySufficient(
      inputs.fireSolutionQualityBp,
      launchKind,
      friendlyFire.raisesMinimumSolutionQuality,
    )
  ) {
    return fail("fireSolutionQuality", TORPEDO_FIRE_SOLUTION_INSUFFICIENT, {
      fireSolutionQuality: false,
    });
  }

  // §6 predicate 11 — own-ship speed within launcher limits (§7/§8 gates).
  const speed = ownSpeedWithinLauncherLimits(
    state,
    definition,
    inputs.ownSpeedMicrometresPerSecond,
  );
  if (!speed.passes) {
    return fail(
      "ownSpeedWithinLauncherLimits",
      speed.reasonCode ?? UNDERWATER_TUBE_SPEED_LIMIT_EXCEEDED,
      { ownSpeedWithinLauncherLimits: false },
    );
  }

  // §6 predicate 12 — own maneuver within the fire-control limit.
  if (!inputs.ownManeuverWithinFireControlLimit) {
    return fail(
      "ownManeuverWithinFireControlLimit",
      TORPEDO_FIRE_SOLUTION_INSUFFICIENT, // §9 lists own turn rate / own maneuver as solution inputs
      { ownManeuverWithinFireControlLimit: false },
    );
  }

  // §6 predicate 13 — sea state permits launch.
  if (!seaStatePermitsLaunch(inputs.seaState)) {
    return fail(
      "seaStatePermitsLaunch",
      TORPEDO_FIRE_SOLUTION_INSUFFICIENT, // §9 lists sea state as a solution input
      { seaStatePermitsLaunch: false },
    );
  }

  // §6 predicate 14 — friendly-fire safety (§24, REAL): a confirmed friendly
  // inside the danger sector below 1_000 m predicted separation PROHIBITS the
  // launch with TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED (never waived by manual
  // launch — friendlyFire.manualLaunch is echoed but the verdict is fixed).
  // friendlyFireSafetyVerdict is the single source of truth for the predicate.
  if (!friendlyFireSafetyVerdict(friendlyFire)) {
    return fail("friendlyFireSafety", TORPEDO_FRIENDLY_FIRE_RISK_PROHIBITED, {
      friendlyFireSafety: false,
    });
  }

  // §6 predicate 15 — ammunition reservation succeeds (checked above; a launch
  // may only reserve ammunition that exists).

  return {
    eligible: true,
    predicateResults: results,
    failingPredicate: null,
    reasonCode: null,
    consumedTorpedo: false,
  };
}
