// DESIGN-40 §15 detonation outcomes (INC-5, AC-14): the canonical CLOSED
// outcome set DUD / PARTIAL_DETONATION / FULL_DETONATION /
// PREMATURE_DETONATION / MAGAZINE_OR_TUBE_CHAIN_REACTION / NO_CONTACT.
// Every outcome is selected through an explicit deterministic predicate OR a
// keyed random decision (streams named `battle/torpedo/detonation/...`,
// hierarchical + domain-separated per ENGINEERING-CONTRACT; the injected
// keyedRng is the same `(stream: string) => float [0,1)` seam launch-failure.ts
// uses — never Math.random, clock, or env). The result records ALL inputs, the
// composed probability, the random decision (stream id + draw + drawBp, or the
// deciding predicate), and provenance (ruleset/formula versions + input hash).
// A dud records the in-slice reason code TORPEDO_DUD.
//
// Inputs consumed (per §15/§14 "evaluates reliability, fuze, impact geometry,
// depth, target protection, and damage state"):
//   - reliability: the AUTHORITATIVE track carrier — the track's §13
//     reliabilityState.reliabilityBp (10_000 bp scale; createTorpedoTrack
//     floors the model's 100_000-scale value / 10). The resolver reads ONLY
//     this carrier: there is NO independent caller-supplied reliability input
//     (a caller cannot inject an arbitrary reliabilityBp that changes the
//     authoritative outcome — MEDIUM-2).
//   - fuze: the AUTHORITATIVE model->fuze mapping TORPEDO_MODEL_FUZE_POLICY
//     keyed by o.track.torpedoModelId (the §13 track is the authoritative
//     model carrier). The INC-1 model surface has NO fuze field (adding one
//     would change every model's contentHash, an AC-25 golden-schema risk), so
//     this versioned model->fuze mapping is the canonical fuze source — grounded
//     in docs/research/c1-m3-torpedoes.md (Whitehead 18-in contact pistol,
//     §3.1/§4.3; RN 21-in Mk IV contact exploder, §3.1; G7a/G7e Pi MZ magnetic
//     pistols + Torpedokrise, §3.1/§3.6/§4.3; Type 93 magnetic/oxygen
//     premature-detonation issue, §3.1/§3.6) and recorded in the C-1 ADR
//     (ADR-0031 — the orchestrator writes the ADR). An UNKNOWN model id fails
//     closed (TORPEDO_STATE_INVARIANT_FAILED) — never a silent default.
//   - impact geometry: impact zone + deviationMdeg (milli-degrees of obliquity
//     from the struck surface normal) at the resolved contact.
//   - depth: track.depthSettingM — the §13 track is the authoritative depth
//     carrier, so the running depth IS the impact depth.
//   - target protection: the §17 underwater-protection level (NONE/WEAK/
//     STANDARD/STRONG/ADVANCED). §17's leak-multiplier FLOW into damage is
//     INC-6's flotation work; here the level modulates the dud/function split.
//   - damage state: whether the target is already progressively flooding
//     (integer kg total > 0 => DAMAGED; a flooding-collapsed hull decouples
//     the charge — Canberra/Prince of Wales bulkhead-tear findings, research
//     §3.4).
//   - premature environment: wakeIntercept — caller-computed (the torpedo
//     crossed the target's wake; Type 93 Java Sea premature/wake detonations,
//     research §3.6).
//
// Outcome-resolution ORDER (documented, deterministic):
//   1. NO_CONTACT — deterministic predicate: the §14 hit resolution did NOT
//      resolve contact (hit.hit === false). No contact => no warhead function;
//      the track stays a RUNNING entity (seam: no §13 terminal transition).
//      Consumes no draw.
//   2. PREMATURE_DETONATION — deterministic predicate: MAGNETIC fuze AND
//      prematureEnvironment.wakeIntercept. Evaluated BEFORE the reliability
//      draw: a wake premature is an actual pre-impact explosion (the research
//      documents wake detonations as CONSUMING events, not duds). No draw.
//   3. KEYED reliability/function block: first the composed function
//      probability
//        functionProbabilityBp = clamp(0, 10_000,
//          floor(reliabilityBp * fuzeMultiplierBp * protectionMultiplierBp *
//                damageStateMultiplierBp / 10_000^3))
//      then ONE keyed draw over
//        battle/torpedo/detonation/reliability:<battleId>:<impactMinute>:
//            <impactSubstep>:<trackId>
//          drawBp = floor(draw * 10_000)      (explicit FLOOR step)
//          drawBp  <  probability  -> warhead functions
//          drawBp >=  probability  -> DUD (TORPEDO_DUD)
//      (boundary: the DUD region is [probability, 10_000); identical `<`
//      convention to gunnery isHit and the §12 launch draw.)
//   4. MAGAZINE_OR_TUBE_CHAIN_REACTION — deterministic predicate: the warhead
//      FUNCTIONED and the impact zone is an ordnance zone (MAGAZINE / TUBE_BAY,
//      the §22 ordnance exposure). INC-5 selects the outcome CLASS; the §21/§22
//      chain-reaction base-probability mechanics and the separate explosion
//      package are INC-6's increments (documented seam — never duplicated).
//   5. PARTIAL_DETONATION vs FULL_DETONATION — deterministic geometry-quality
//      predicate (impactGeometryQuality): functioning below the full-function
//      depth band (shallow near-waterline hit) is PARTIAL; a CONTACT fuze with
//      obliquity beyond the shipped tolerance is PARTIAL; otherwise FULL. A
//      MAGNETIC fuze is not angle-sensitive (influence envelopes the hull at
//      any obliquity) — only the shallow band reduces it.
//
// AUTH BALANCE TARGET constants (INC-5 authored, recorded for ADR-0029 by
// INC-8 — DESIGN-40 pins the outcome SET and the input list, not these
// multipliers): fuze multipliers CONTACT 10_000 / MAGNETIC 9_000 (magnetic
// pistols were strictly less reliable — the 1941-43 magnetic-pistol record,
// research §3.6); protection NONE 10_000 / WEAK 9_500 / STANDARD 9_000 /
// STRONG 8_500 / ADVANCED 8_000 (stronger underwater protection raises the
// warhead dud-fraction through blast/brace decoupling); damage-state CLEAN
// 10_000 / DAMAGED 9_500 (flooding-collapsed hull decouples the charge);
// full-function band: depth >= 3 m and (CONTACT) obliquity <= 60_000 mdeg.
//
// §13 terminal mapping (shipped here, documented): DUD -> terminal "DUD";
// FULL/PARTIAL/PREMATURE/MAGAZINE_OR_TUBE -> terminal "DETONATION"; and
// NO_CONTACT -> NO terminal transition (the track remains running; an
// exhausted run still EXHAUSTS via advanceTorpedoTrack). The §13 closed union
// ALREADY carries a "DUD" member (constants.ts TORPEDO_TERMINAL_RESULTS,
// shipped by INC-4) -> NO union extension is needed; the change is recorded
// in the INC-5 report. Pure/deterministic: no I/O, clock, or ambient random.
import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  SEED_TORPEDO_MODEL_IDS,
  TORPEDO_BASIS_POINTS_PER_UNIT,
  TORPEDO_FORMULA_VERSION,
  TORPEDO_RULESET_VERSION,
  type TorpedoTerminalResult,
} from "./constants.js";
import { TORPEDO_DUD, TORPEDO_STATE_INVARIANT_FAILED } from "./reasonCodes.js";
import {
  assertAuthoritativeTorpedoTrack,
  setTorpedoTerminalResult,
  type TorpedoTrack,
} from "./track.js";
import type { TorpedoHitResolution } from "./hit-resolution.js";

function invariant(field: string, value: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    field,
    reason,
    value,
  });
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

// ---- §15 closed outcome set ---------------------------------------------------
export const TORPEDO_DETONATION_OUTCOMES = [
  "DUD",
  "PARTIAL_DETONATION",
  "FULL_DETONATION",
  "PREMATURE_DETONATION",
  "MAGAZINE_OR_TUBE_CHAIN_REACTION",
  "NO_CONTACT",
] as const;
export type TorpedoDetonationOutcome = (typeof TORPEDO_DETONATION_OUTCOMES)[number];

export function isDetonationOutcome(v: string): v is TorpedoDetonationOutcome {
  return (TORPEDO_DETONATION_OUTCOMES as readonly string[]).includes(v);
}

// ---- input surfaces (authored INC-5) -----------------------------------------
export const TORPEDO_FUZE_POLICIES = ["CONTACT", "MAGNETIC"] as const;
export type TorpedoFuzePolicy = (typeof TORPEDO_FUZE_POLICIES)[number];

// ---- AUTHORITATIVE model -> fuze mapping (INC-5, ADR-0031) ------------------
// OUT OF SCOPE for the torpedo performance-data retirement (ship-part-model ticket 13b): this
// map is a combat ALGORITHM constant (which exploder a model family carried), not per-model
// performance data. It stays keyed by the unchanged torpedo part ids.
// The versioned carrier that pins each shipped model's §15 fuze policy. The
// INC-1 model surface has NO fuze field (adding one would change every model's
// contentHash, an AC-25 golden-schema risk), so THIS mapping is the canonical
// fuze source — resolveTorpedoDetonation and the probability composer read the
// fuze from it via o.track.torpedoModelId and NEVER from a caller-supplied
// value (HIGH-1). Grounded in docs/research/c1-m3-torpedoes.md:
//   - whitehead_18in_1894 -> CONTACT  (§3.1 line 89 "n/a (contact)"; §4.3
//     line 309 "contact pistol")
//   - rn_21in_mk_iv_1916   -> CONTACT  (§3.1 line 90 — WW1 British standard,
//     contact exploder, no magnetic pistol)
//   - ger_533mm_g7a_1934   -> MAGNETIC (§3.1 line 95 / §3.6 line 236 — Pi A/AZ
//     + Pi MZ magnetic pistols, Torpedokrise)
//   - ger_533mm_g7e_1936   -> MAGNETIC (§3.1 line 96 / §4.3 line 315 — "same
//     pistols")
//   - jpn_61cm_type93_1935 -> MAGNETIC (§3.1 line 97 / §3.6 line 246 — Java Sea
//     premature/wake detonations, fuze sensitivity)
//   - whitehead_14in_1886  -> CONTACT  (§3.1 line 88 / §4.3 line 309 — contact
//     pistol, no run-based arming captured)
//   - rn_21in_mk_viii_1927 -> CONTACT  (§3.1 line 92 / §4.3 line 311 — RN
//     workhorse; RN WW2 fleet torpedoes used contact exploders — the same
//     contact-exploder family as the Mk IV row's "no magnetic pistol" note)
//   - usn_21in_mk14_1931   -> MAGNETIC (§3.1 line 93 / §3.6 line 242 — the
//     Mk 6 exploder's magnetic-influence arm: 1941-43 premature/depth fiasco)
// Unknown model ids FAIL CLOSED (TORPEDO_STATE_INVARIANT_FAILED) — never a
// silent default (HIGH-1). Keyed by the §13 track.torpedoModelId carrier.
export const TORPEDO_MODEL_FUZE_POLICY: Record<string, TorpedoFuzePolicy> = {
  whitehead_18in_1894: "CONTACT",
  rn_21in_mk_iv_1916: "CONTACT",
  ger_533mm_g7a_1934: "MAGNETIC",
  ger_533mm_g7e_1936: "MAGNETIC",
  jpn_61cm_type93_1935: "MAGNETIC",
  whitehead_14in_1886: "CONTACT",
  rn_21in_mk_viii_1927: "CONTACT",
  usn_21in_mk14_1931: "MAGNETIC",
};

// Fail-closed lookup: the authoritative fuze for a shipped torpedo model id.
export function fuzePolicyForModel(torpedoModelId: string): TorpedoFuzePolicy {
  const fuze = TORPEDO_MODEL_FUZE_POLICY[torpedoModelId];
  if (fuze === undefined) {
    invariant(
      "torpedoModelId",
      torpedoModelId,
      `no shipped model->fuze policy for torpedo model id ${torpedoModelId}`,
    );
  }
  return fuze;
}

// §17 impact-zone families (the layout layer classes the struck zone; the
// ordnance-class zones drive the §15 chain-reaction outcome).
export const TORPEDO_IMPACT_ZONES = [
  "EXTREMITY",
  "MACHINERY",
  "MAGAZINE",
  "TUBE_BAY",
  "CENTRAL",
  "BREACHED",
] as const;
export type TorpedoImpactZone = (typeof TORPEDO_IMPACT_ZONES)[number];
// The ordnance-class zones that select the §15 chain-reaction outcome.
export const TORPEDO_ORDNANCE_IMPACT_ZONES = ["MAGAZINE", "TUBE_BAY"] as const;

// §17 underwater-protection levels (the target-protection input).
export const TORPEDO_TARGET_PROTECTION_LEVELS = [
  "NONE",
  "WEAK",
  "STANDARD",
  "STRONG",
  "ADVANCED",
] as const;
export type TorpedoTargetProtectionLevel = (typeof TORPEDO_TARGET_PROTECTION_LEVELS)[number];

// Deterministic damage-state indicator for the resolved target: "CLEAN" when
// no ongoing progressive flooding, "DAMAGED" once the total is > 0 kg.
export type TorpedoDamageStateIndicator = "CLEAN" | "DAMAGED";

// ---- authored BALANCE TARGET constants (INC-5, recorded for ADR-0029) --------
// Fuze function multipliers: the reliability band weighted by fuze policy.
export const TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP: Record<TorpedoFuzePolicy, number> = {
  CONTACT: 10_000,
  MAGNETIC: 9_000,
};
// Target-protection function multipliers (stronger underwater protection
// raises the dud share — the warhead/fuze decoupling under a deep TDS).
export const TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP: Record<
  TorpedoTargetProtectionLevel,
  number
> = {
  NONE: 10_000,
  WEAK: 9_500,
  STANDARD: 9_000,
  STRONG: 8_500,
  ADVANCED: 8_000,
};
// Damage-state function multipliers: an already-progressively-flooding target
// raises the dud share.
export const TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP: Record<
  TorpedoDamageStateIndicator,
  number
> = {
  CLEAN: 10_000,
  DAMAGED: 9_500,
};
// Full-function geometry band:
//   - TORPEDO_FULL_FUNCTION_MIN_DEPTH_M (metres): a hit shallower than this is
//     a near-waterline graze -> PARTIAL;
//   - TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG (milli-degrees, = 60°): a
//     CONTACT-fuze strike beyond this obliquity is grazing -> PARTIAL.
export const TORPEDO_FULL_FUNCTION_MIN_DEPTH_M = 3 as const;
export const TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG = 60_000 as const;

// TorpedoDetonationContract — ships the INC-5 authored §15 detonation constant
// surface (MEDIUM-3), mirroring the INC-1..INC-4 `SHIPPED_TORPEDO_CONTRACT` +
// `validateTorpedoContract` idiom in constants.ts (fail-closed on tampering).
// The detonation constants (fuze multipliers, protection multipliers,
// damage-state multipliers, the full-function geometry band, and the
// authoritative model->fuze mapping) live HERE in detonation.ts (they reference
// the §15/§17 types defined in this module), so they are pinned by this
// dedicated contract + guard rather than being moved into constants.ts — the
// exact tamper-guard behavior is the same.
export interface TorpedoDetonationContract {
  fuzePolicies: readonly TorpedoFuzePolicy[];
  fuzeFunctionMultiplierBp: Record<TorpedoFuzePolicy, number>;
  targetProtectionLevels: readonly TorpedoTargetProtectionLevel[];
  protectionFunctionMultiplierBp: Record<TorpedoTargetProtectionLevel, number>;
  damageStateFunctionMultiplierBp: Record<TorpedoDamageStateIndicator, number>;
  fullFunctionMinDepthM: number;
  fullFunctionMaxDeviationMdeg: number;
  modelFuzePolicy: Record<string, TorpedoFuzePolicy>; // model id -> §15 fuze
}

export const SHIPPED_TORPEDO_DETONATION_CONTRACT: TorpedoDetonationContract = {
  fuzePolicies: TORPEDO_FUZE_POLICIES,
  fuzeFunctionMultiplierBp: TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP,
  targetProtectionLevels: TORPEDO_TARGET_PROTECTION_LEVELS,
  protectionFunctionMultiplierBp: TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP,
  damageStateFunctionMultiplierBp: TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP,
  fullFunctionMinDepthM: TORPEDO_FULL_FUNCTION_MIN_DEPTH_M,
  fullFunctionMaxDeviationMdeg: TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG,
  modelFuzePolicy: TORPEDO_MODEL_FUZE_POLICY,
};

function throwContractMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function contractArrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// Deep equality for the contract's authored integer-keyed multiplier maps.
function contractRecordEquals(
  a: Record<string, number> | null | undefined,
  b: Record<string, number>,
): boolean {
  if (!a) return false;
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (!contractArrayEquals(aKeys, bKeys)) return false;
  return bKeys.every((k) => a[k] === b[k]);
}

// Fail-closed validation of the INC-5 detonation constant surface. The
// model->fuze mapping is pinned exactly: the key set MUST equal the shipped
// seed model ids (ordered) and every value MUST be a canonical §15 fuze — a
// tampered/missing/extra mapping never passes (no silent fuze default).
export function validateTorpedoDetonationContract(
  c: Partial<TorpedoDetonationContract> | null | undefined,
): asserts c is TorpedoDetonationContract {
  if (!c) throwContractMismatch(c, "torpedo_v1 detonation contract missing");
  if (!c.fuzePolicies || !contractArrayEquals(c.fuzePolicies, TORPEDO_FUZE_POLICIES))
    throwContractMismatch(c, "torpedo_v1 §15 fuze-policy closed enum");
  if (!contractRecordEquals(c.fuzeFunctionMultiplierBp, TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP))
    throwContractMismatch(c, "torpedo_v1 §15 fuze-function multiplier");
  if (
    !c.targetProtectionLevels ||
    !contractArrayEquals(c.targetProtectionLevels, TORPEDO_TARGET_PROTECTION_LEVELS)
  )
    throwContractMismatch(c, "torpedo_v1 §17 target-protection closed enum");
  if (
    !contractRecordEquals(
      c.protectionFunctionMultiplierBp,
      TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP,
    )
  )
    throwContractMismatch(c, "torpedo_v1 §15 target-protection function multiplier");
  if (
    !contractRecordEquals(
      c.damageStateFunctionMultiplierBp,
      TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP,
    )
  )
    throwContractMismatch(c, "torpedo_v1 §15 damage-state function multiplier");
  if (c.fullFunctionMinDepthM !== TORPEDO_FULL_FUNCTION_MIN_DEPTH_M)
    throwContractMismatch(c, "torpedo_v1 §15 full-function min depth");
  if (c.fullFunctionMaxDeviationMdeg !== TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG)
    throwContractMismatch(c, "torpedo_v1 §15 full-function max deviation");
  if (!c.modelFuzePolicy) throwContractMismatch(c, "torpedo_v1 model->fuze mapping missing");
  if (!contractArrayEquals(Object.keys(c.modelFuzePolicy), [...SEED_TORPEDO_MODEL_IDS]))
    throwContractMismatch(c, "torpedo_v1 model->fuze mapping shipped model key set");
  for (const modelId of SEED_TORPEDO_MODEL_IDS) {
    const fuze = c.modelFuzePolicy[modelId];
    if (fuze !== TORPEDO_MODEL_FUZE_POLICY[modelId])
      throwContractMismatch(c, `torpedo_v1 model->fuze mapping for ${modelId}`);
  }
}

// ---- §15 keyed stream ---------------------------------------------------------
// Hierarchical domain-separated reliability draw, bound to (battleId + impact
// minute/substep + track id). At most ONE draw per detonation evaluation and
// ONLY on the reliability block (steps 1, 2, 4, 5 consume no draw — the draw
// layout is deterministic, so identical inputs consume identical counts).
export function torpedoDetonationReliabilityStreamId(o: {
  battleId: string;
  impactMinute: number;
  impactSubstep: number;
  torpedoTrackId: string;
}): string {
  return `battle/torpedo/detonation/reliability:${o.battleId}:${o.impactMinute}:${o.impactSubstep}:${o.torpedoTrackId}`;
}

// AC-14: map the keyed float draw to the reliability branch. Draws in
// [0, probabilityBp) function; draws >= probabilityBp are duds (the dud region
// width is 10_000 - probabilityBp). Explicit FLOOR conversion step.
export function evaluateDetonationReliabilityDraw(o: {
  probabilityBp: number;
  draw: number; // keyed draw, float [0, 1)
}): { drawBp: number; functions: boolean } {
  if (
    !isInt(o.probabilityBp) ||
    o.probabilityBp < 0 ||
    o.probabilityBp > TORPEDO_BASIS_POINTS_PER_UNIT
  )
    invariant(
      "probabilityBp",
      o.probabilityBp,
      `detonation probability must be an integer bp within [0, ${TORPEDO_BASIS_POINTS_PER_UNIT}]`,
    );
  if (typeof o.draw !== "number" || o.draw < 0 || o.draw >= 1)
    invariant("draw", o.draw, "the keyed draw must be a float within [0, 1)");
  const drawBp = Math.floor(o.draw * TORPEDO_BASIS_POINTS_PER_UNIT);
  return { drawBp, functions: drawBp < o.probabilityBp };
}

// functionProbabilityBp = clamp(0, 10_000,
//   floor(reliabilityBp * fuzeMultiplierBp * protectionMultiplierBp *
//         damageStateMultiplierBp / 10_000^3)).
// Bound analysis (ENGINEERING-CONTRACT bigint rule): the unreduced numerator
// reaches 10_000^4 = 10^16 > Number.MAX_SAFE_INTEGER (~9.0e15), so the product
// is accumulated in bigint and divided ONCE; the floored result is always in
// [0, 10_000] — a plain safe integer.
export function computeDetonationProbabilityBp(o: {
  torpedoModelId: string; // the §13 track's model carrier — the fuze is read
  // from the authoritative TORPEDO_MODEL_FUZE_POLICY mapping (never a caller
  // value); an unknown model fails closed.
  reliabilityBp: number; // normalized [0, 10_000] — the track's §13 carrier
  protectionLevel: TorpedoTargetProtectionLevel;
  damageStateIndicator: TorpedoDamageStateIndicator;
}): number {
  if (
    !isInt(o.reliabilityBp) ||
    o.reliabilityBp < 0 ||
    o.reliabilityBp > TORPEDO_BASIS_POINTS_PER_UNIT
  )
    invariant(
      "reliabilityBp",
      o.reliabilityBp,
      "reliability must be an integer bp within [0, 10_000]",
    );
  const fuzePolicy = fuzePolicyForModel(o.torpedoModelId); // fail-closed lookup
  if (!(TORPEDO_TARGET_PROTECTION_LEVELS as readonly string[]).includes(o.protectionLevel))
    invariant("protectionLevel", o.protectionLevel, "protection must be a canonical §17 level");
  if (o.damageStateIndicator !== "CLEAN" && o.damageStateIndicator !== "DAMAGED")
    invariant(
      "damageStateIndicator",
      o.damageStateIndicator,
      "damage-state indicator must be CLEAN or DAMAGED",
    );
  const num =
    BigInt(o.reliabilityBp) *
    BigInt(TORPEDO_FUZE_FUNCTION_MULTIPLIER_BP[fuzePolicy]) *
    BigInt(TORPEDO_PROTECTION_FUNCTION_MULTIPLIER_BP[o.protectionLevel]) *
    BigInt(TORPEDO_DAMAGE_STATE_FUNCTION_MULTIPLIER_BP[o.damageStateIndicator]);
  const den = BigInt(TORPEDO_BASIS_POINTS_PER_UNIT) ** 3n;
  const raw = Number(num / den); // bigint division floors; raw <= 10_000
  return Math.min(TORPEDO_BASIS_POINTS_PER_UNIT, Math.max(0, raw));
}

// Deterministic indicator from the target's §41 progressive-flooding total
// (0 kg => CLEAN; any > 0 kg => DAMAGED).
function damageStateIndicatorOf(progressiveFloodingTotalKg: number): TorpedoDamageStateIndicator {
  if (!isInt(progressiveFloodingTotalKg) || progressiveFloodingTotalKg < 0)
    invariant(
      "progressiveFloodingTotalKg",
      progressiveFloodingTotalKg,
      "progressive flooding must be a non-negative integer kg",
    );
  return progressiveFloodingTotalKg > 0 ? "DAMAGED" : "CLEAN";
}

// Deterministic geometry-quality predicate: PARTIAL vs FULL.
//   - CONTACT: FULL requires depth >= the min band AND obliquity <= the bound;
//     a shallow depth or an oblique (> 60°) strike is PARTIAL.
//   - MAGNETIC: an influence fuze is not angle-sensitive (its band envelops
//     the hull at any obliquity); only the shallow influence zone reduces it.
export function impactGeometryQuality(o: {
  fuzePolicy: TorpedoFuzePolicy;
  depthM: number;
  deviationMdeg: number;
}): "FULL" | "PARTIAL" {
  if (!(TORPEDO_FUZE_POLICIES as readonly string[]).includes(o.fuzePolicy))
    invariant("fuzePolicy", o.fuzePolicy, "fuze policy must be a canonical §15 fuze");
  if (!isInt(o.depthM) || o.depthM < 0)
    invariant("depthM", o.depthM, "impact depth must be a non-negative integer metre");
  if (!isInt(o.deviationMdeg) || o.deviationMdeg < 0 || o.deviationMdeg > 360_000)
    invariant(
      "deviationMdeg",
      o.deviationMdeg,
      "strike deviation must be an integer milli-degree within [0, 360_000]",
    );
  const shallow = o.depthM < TORPEDO_FULL_FUNCTION_MIN_DEPTH_M;
  if (o.fuzePolicy === "MAGNETIC") return shallow ? "PARTIAL" : "FULL";
  const oblique = o.deviationMdeg > TORPEDO_FULL_FUNCTION_MAX_DEVIATION_MDEG;
  return shallow || oblique ? "PARTIAL" : "FULL";
}

// ---- §15 resolution surface ---------------------------------------------------
export interface TorpedoDetonationDecision {
  kind: "DETERMINISTIC_PREDICATE" | "KEYED_DRAW";
  predicate: string | null; // the deciding predicate id (deterministic picks)
  streamId: string | null; // the keyed stream id (KEYED_DRAW only)
  draw: number | null; // the raw keyed float [0, 1)
  drawBp: number | null; // the floored integer bp of the draw
}

export interface TorpedoDetonationResolution {
  outcome: TorpedoDetonationOutcome;
  reasonCode: string | null; // TORPEDO_DUD on a dud; null otherwise
  // The composed detonation-function probability that governed the KEYED
  // reliability block (the function region is [0, probabilityBp)); every
  // result records it so each entry always carries the probability.
  detonationProbabilityBp: number;
  // Whether the warhead actually functioned (exploded): FULL/PARTIAL/
  // PREMATURE/CHAIN = true; DUD/NO_CONTACT = false.
  functioned: boolean;
  decision: TorpedoDetonationDecision;
  // All inputs snapshot (§15 "records all inputs" audit surface).
  inputs: {
    trackId: string;
    hitResolved: boolean;
    hitRejection: string | null;
    reliabilityBp: number;
    fuzePolicy: TorpedoFuzePolicy;
    depthM: number;
    zone: TorpedoImpactZone | null;
    deviationMdeg: number;
    protection: TorpedoTargetProtectionLevel | null;
    damageStateIndicator: TorpedoDamageStateIndicator | null;
    wakeIntercept: boolean;
  };
  provenance: { rulesetVersion: string; formulaVersion: string; inputHash: string };
}

function buildResolution(o: {
  outcome: TorpedoDetonationOutcome;
  reasonCode: string | null;
  detonationProbabilityBp: number;
  functioned: boolean;
  decision: TorpedoDetonationDecision;
  inputs: TorpedoDetonationResolution["inputs"];
  provenance: TorpedoDetonationResolution["provenance"];
}): TorpedoDetonationResolution {
  return Object.freeze({
    outcome: o.outcome,
    reasonCode: o.reasonCode,
    detonationProbabilityBp: o.detonationProbabilityBp,
    functioned: o.functioned,
    decision: Object.freeze(o.decision),
    inputs: Object.freeze(o.inputs),
    provenance: Object.freeze(o.provenance),
  });
}

// §15 composed resolver (AC-14). Deterministic ordering documented in the
// module header: NO_CONTACT -> PREMATURE -> (KEYED) dud/function ->
// MAGAZINE_OR_TUBE_CHAIN_REACTION -> PARTIAL/FULL. Every branch is either an
// explicit deterministic predicate or the single keyed reliability draw.
export function resolveTorpedoDetonation(o: {
  track: TorpedoTrack; // authoritative RUNNING track — the §13 identity + depth +
  // reliabilityState + torpedoModelId carriers (there is NO independent
  // weapon/fuze/reliability input)
  hit: TorpedoHitResolution; // the §14 hit verdict feeding this stage
  impact: { zone: TorpedoImpactZone | null; deviationMdeg: number };
  targetProtection: TorpedoTargetProtectionLevel | null; // null when no target
  damageState: { progressiveFloodingTotalKg: number } | null; // null when no target
  prematureEnvironment: { wakeIntercept: boolean };
  keyedRng: (stream: string) => number; // deterministic keyed stream -> float [0,1)
}): TorpedoDetonationResolution {
  // Fail-closed structural validation (reversible-to-invariant; never mutates).
  assertAuthoritativeTorpedoTrack(o.track);
  if (o.track.terminalResult !== null)
    invariant("track", o.track.torpedoTrackId, "detonation resolution requires the RUNNING track");
  // Reliability comes ONLY from the §13 track carrier (never an independent
  // caller input — MEDIUM-2). assertAuthoritativeTorpedoTrack already enforces
  // reliabilityState.reliabilityBp is an integer bp within [0, 10_000].
  const reliabilityBp = o.track.reliabilityState.reliabilityBp;
  // Fuze comes ONLY from the authoritative model->fuze mapping via the §13
  // torpedoModelId carrier (never a caller-supplied value — HIGH-1). An unknown
  // model id fails closed (TORPEDO_STATE_INVARIANT_FAILED).
  const fuzePolicy = fuzePolicyForModel(o.track.torpedoModelId);
  if (
    !isInt(o.impact.deviationMdeg) ||
    o.impact.deviationMdeg < 0 ||
    o.impact.deviationMdeg > 360_000
  )
    invariant(
      "deviationMdeg",
      o.impact.deviationMdeg,
      "strike deviation must be an integer milli-degree within [0, 360_000]",
    );
  if (
    o.impact.zone !== null &&
    !(TORPEDO_IMPACT_ZONES as readonly string[]).includes(o.impact.zone)
  )
    invariant("zone", o.impact.zone, "impact zone must be a canonical §17 zone or null");
  if (
    o.targetProtection !== null &&
    !(TORPEDO_TARGET_PROTECTION_LEVELS as readonly string[]).includes(o.targetProtection)
  )
    invariant(
      "targetProtection",
      o.targetProtection,
      "target protection must be a canonical level",
    );
  if (o.damageState !== null && typeof o.damageState !== "object")
    invariant("damageState", o.damageState, "damage state must be null or a record");
  if (typeof o.keyedRng !== "function")
    invariant("keyedRng", o.keyedRng, "a deterministic keyed RNG stream function is required");
  if (typeof o.prematureEnvironment.wakeIntercept !== "boolean")
    invariant(
      "wakeIntercept",
      o.prematureEnvironment.wakeIntercept,
      "wake intercept must be a boolean",
    );
  // A resolved hit REQUIRES the full impact/protection/damage geometry; a
  // non-hit takes the null NO_CONTACT path. Fail closed on a mismatch.
  if (
    o.hit.hit &&
    (o.impact.zone === null || o.targetProtection === null || o.damageState === null)
  )
    invariant(
      "hitGeometry",
      o.hit.trackId,
      "a resolved hit requires impact zone + target protection + damage state; a miss requires none of them",
    );

  const damageStateIndicator: TorpedoDamageStateIndicator | null =
    o.damageState === null
      ? null
      : damageStateIndicatorOf(o.damageState.progressiveFloodingTotalKg);
  const probabilityBp =
    o.hit.hit && o.targetProtection !== null && damageStateIndicator !== null
      ? computeDetonationProbabilityBp({
          torpedoModelId: o.track.torpedoModelId,
          reliabilityBp,
          protectionLevel: o.targetProtection,
          damageStateIndicator,
        })
      : 0;
  const depthM = o.track.depthSettingM;

  const inputsSnapshot: TorpedoDetonationResolution["inputs"] = {
    trackId: o.track.torpedoTrackId,
    hitResolved: o.hit.hit,
    hitRejection: o.hit.rejection,
    reliabilityBp,
    fuzePolicy,
    depthM,
    zone: o.impact.zone,
    deviationMdeg: o.impact.deviationMdeg,
    protection: o.targetProtection,
    damageStateIndicator,
    wakeIntercept: o.prematureEnvironment.wakeIntercept,
  };
  const provenance: TorpedoDetonationResolution["provenance"] = {
    rulesetVersion: TORPEDO_RULESET_VERSION,
    formulaVersion: TORPEDO_FORMULA_VERSION,
    inputHash: sha256Hex(
      canonicalSerialize({
        inputs: inputsSnapshot,
        rulesetVersion: TORPEDO_RULESET_VERSION,
        formulaVersion: TORPEDO_FORMULA_VERSION,
      }),
    ),
  };

  // (1) NO_CONTACT — deterministic predicate: the §14 resolver found no contact.
  if (!o.hit.hit) {
    return buildResolution({
      outcome: "NO_CONTACT",
      reasonCode: null,
      detonationProbabilityBp: 0,
      functioned: false,
      decision: {
        kind: "DETERMINISTIC_PREDICATE",
        predicate: "no-resolved-hit-contact",
        streamId: null,
        draw: null,
        drawBp: null,
      },
      inputs: inputsSnapshot,
      provenance,
    });
  }

  // (2) PREMATURE_DETONATION — deterministic predicate: an influence (MAGNETIC)
  // fuze torpedo that crossed the target's wake pre-detonates ahead of the
  // intended contact (research: wake/premature detonations, e.g. Type 93).
  if (fuzePolicy === "MAGNETIC" && o.prematureEnvironment.wakeIntercept) {
    return buildResolution({
      outcome: "PREMATURE_DETONATION",
      reasonCode: null,
      detonationProbabilityBp: probabilityBp,
      functioned: true,
      decision: {
        kind: "DETERMINISTIC_PREDICATE",
        predicate: "magnetic-fuze-wake-intercept",
        streamId: null,
        draw: null,
        drawBp: null,
      },
      inputs: inputsSnapshot,
      provenance,
    });
  }

  // (3) KEYED reliability/function block — the ONLY §15 random decision:
  // drawBp < probabilityBp functions; drawBp >= it is a DUD.
  const streamId = torpedoDetonationReliabilityStreamId({
    battleId: o.track.battleId,
    impactMinute: o.hit.impactMinute,
    impactSubstep: o.hit.impactSubstep,
    torpedoTrackId: o.track.torpedoTrackId,
  });
  const draw = o.keyedRng(streamId);
  const { drawBp, functions } = evaluateDetonationReliabilityDraw({
    probabilityBp,
    draw,
  });
  if (!functions) {
    return buildResolution({
      outcome: "DUD",
      reasonCode: TORPEDO_DUD,
      detonationProbabilityBp: probabilityBp,
      functioned: false,
      decision: {
        kind: "KEYED_DRAW",
        predicate: null,
        streamId,
        draw,
        drawBp,
      },
      inputs: inputsSnapshot,
      provenance,
    });
  }

  // (4) ordnance-impact chain reaction — deterministic predicate (the §15
  // outcome CLASS; the §22 base probability + separate explosion package is
  // INC-6's §21/§22 work).
  //
  // LOW-4 (INC-6 draw-layout stability): this deterministic ordnance-zone ->
  // chain-reaction predicate ships in INC-5 as an explicit-predicate outcome
  // (per AC-14), but §22's base-probability mechanics are deferred to INC-6.
  // When INC-6 adds the §22 probability draw it MUST preserve the reliability
  // draw (above, step 3) as the SOLE/stable draw in the detonation evaluation —
  // the draw layout (battle/torpedo/detonation/reliability:... consumed once,
  // here) must not shift, so downstream draw consumption and save-continuity
  // stay stable. Do NOT insert a second draw in this branch.
  if (
    o.impact.zone !== null &&
    (TORPEDO_ORDNANCE_IMPACT_ZONES as readonly string[]).includes(o.impact.zone)
  ) {
    return buildResolution({
      outcome: "MAGAZINE_OR_TUBE_CHAIN_REACTION",
      reasonCode: null,
      detonationProbabilityBp: probabilityBp,
      functioned: true,
      decision: {
        kind: "DETERMINISTIC_PREDICATE",
        predicate: "ordnance-zone-impact",
        streamId: null,
        draw: null,
        drawBp: null,
      },
      inputs: inputsSnapshot,
      provenance,
    });
  }

  // (5) PARTIAL vs FULL — deterministic geometry-quality predicate.
  const grade = impactGeometryQuality({
    fuzePolicy,
    depthM,
    deviationMdeg: o.impact.deviationMdeg,
  });
  return buildResolution({
    outcome: grade === "FULL" ? "FULL_DETONATION" : "PARTIAL_DETONATION",
    reasonCode: null,
    detonationProbabilityBp: probabilityBp,
    functioned: true,
    decision: {
      kind: "DETERMINISTIC_PREDICATE",
      predicate: grade === "FULL" ? "full-function-geometry" : "reduced-function-geometry",
      streamId: null,
      draw: null,
      drawBp: null,
    },
    inputs: inputsSnapshot,
    provenance,
  });
}

// ---- §13 terminal mapping (the detonation -> track-lifecycle wire) -------------
// Deterministic mapping of the §15 closed outcomes onto the §13 closed
// terminal-union members (constants.ts already ships "DUD" — no extension).
// NO_CONTACT maps to null: the torpedo remains a RUNNING authoritative entity
// and the engine re-evaluates it after the next advance.
export function torpedoTerminalForDetonationOutcome(
  outcome: TorpedoDetonationOutcome,
): TorpedoTerminalResult | null {
  if (!isDetonationOutcome(outcome))
    invariant("outcome", outcome, "outcome must be a canonical §15 outcome");
  switch (outcome) {
    case "DUD":
      return "DUD";
    case "FULL_DETONATION":
    case "PARTIAL_DETONATION":
    case "PREMATURE_DETONATION":
    case "MAGAZINE_OR_TUBE_CHAIN_REACTION":
      return "DETONATION";
    case "NO_CONTACT":
      return null;
  }
}

// Wire the detonation outcome onto the track lifecycle: terminal via the §13
// one-way setTorpedoTerminalResult; NO_CONTACT returns the SAME running track
// (no transition — the torpedo stays an authoritative entity).
export function applyTorpedoDetonationToTrack(o: {
  track: TorpedoTrack;
  outcome: TorpedoDetonationOutcome;
}): TorpedoTrack {
  const terminal = torpedoTerminalForDetonationOutcome(o.outcome);
  if (terminal === null) return o.track;
  return setTorpedoTerminalResult(o.track, terminal);
}
