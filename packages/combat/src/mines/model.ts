import { BluewaveError } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_BATTLE_GENERATION_POLICY_ID,
  MINE_FRIENDLY_FIRE_POLICY_ID,
  MINE_REPORT_SIGNATURE_POLICY_ID,
  MINE_SOURCE_KINDS,
  MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP,
  MINE_STRIKE_OUTCOMES,
  MINE_TARGET_CLASSES,
  MINE_TYPES,
  type MineDecayPolicy,
  type MineSourceKind,
  type MineStrikeOutcome,
  type MineSweepResistance,
  type MineTargetClass,
  type MineType,
} from "./constants.js";
import { INVALID_MINE_TYPE_DEFINITION } from "./reasonCodes.js";

export const mineTypeDefinitionsContentVersion = "mine_type_definitions_v1" as const;

export interface MineStrikeProfile {
  baseSeverityWeightsBp: Readonly<
    Record<Exclude<MineStrikeOutcome, "IMMOBILIZED_FOR_TOW">, number>
  >;
}

export interface MineTypeDefinition {
  mineTypeId: MineType;
  technologyPrerequisiteIds: readonly string[];
  eligibleLayingSourceKinds: readonly MineSourceKind[];
  baseLayingValue: number;
  strikeProfile: MineStrikeProfile;
  targetEligibility: readonly MineTargetClass[];
  sweepResistance: MineSweepResistance;
  decayPolicy: MineDecayPolicy;
  friendlyFirePolicyId: string;
  battleGenerationPolicyId: string;
  reportSignaturePolicyId: string;
  contentVersion: string;
  contentHash: string;
}

function invariant(m: MineTypeDefinition, field: string, value: unknown, reason: string): never {
  throw new BluewaveError(INVALID_MINE_TYPE_DEFINITION, {
    code: INVALID_MINE_TYPE_DEFINITION,
    field,
    reason,
    value,
  });
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

function isBp(v: unknown): v is number {
  return isInt(v) && v >= 0 && v <= MINE_BASIS_POINTS_PER_UNIT;
}

export function assertMineTypeDefinitionSurface(m: MineTypeDefinition): void {
  if (!(MINE_TYPES as readonly string[]).includes(m.mineTypeId))
    invariant(m, "mineTypeId", m.mineTypeId, "mineTypeId must be a canonical §2 mine type");

  if (!Array.isArray(m.technologyPrerequisiteIds))
    invariant(m, "technologyPrerequisiteIds", m.technologyPrerequisiteIds, "must be an array");
  if (!m.technologyPrerequisiteIds.every(isNonEmptyString))
    invariant(
      m,
      "technologyPrerequisiteIds",
      m.technologyPrerequisiteIds,
      "every technology prerequisite must be a non-empty string",
    );

  if (!Array.isArray(m.eligibleLayingSourceKinds) || m.eligibleLayingSourceKinds.length === 0)
    invariant(
      m,
      "eligibleLayingSourceKinds",
      m.eligibleLayingSourceKinds,
      "at least one eligible §3 laying-source kind is required",
    );
  if (
    !m.eligibleLayingSourceKinds.every((k) => (MINE_SOURCE_KINDS as readonly string[]).includes(k))
  )
    invariant(
      m,
      "eligibleLayingSourceKinds",
      m.eligibleLayingSourceKinds,
      "every laying-source kind must be a canonical §3 source kind",
    );

  if (!isInt(m.baseLayingValue) || m.baseLayingValue <= 0)
    invariant(
      m,
      "baseLayingValue",
      m.baseLayingValue,
      "baseLayingValue must be a positive integer",
    );

  if (!m.strikeProfile || typeof m.strikeProfile !== "object")
    invariant(m, "strikeProfile", m.strikeProfile, "strikeProfile is required");
  const weights = m.strikeProfile?.baseSeverityWeightsBp;
  if (!weights)
    invariant(m, "strikeProfile.baseSeverityWeightsBp", weights, "base severity weights required");
  let total = 0;
  for (const outcome of MINE_STRIKE_OUTCOMES) {
    if (outcome === "IMMOBILIZED_FOR_TOW") continue;
    const w = weights?.[outcome];
    if (w !== MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP[outcome])
      invariant(
        m,
        `strikeProfile.baseSeverityWeightsBp.${outcome}`,
        w,
        `§15 shipped base severity weight for ${outcome}`,
      );
    total += w;
  }
  if (total !== MINE_BASIS_POINTS_PER_UNIT)
    invariant(
      m,
      "strikeProfile.baseSeverityWeightsBp",
      total,
      "§15 base severity weights must total 10_000",
    );

  if (!Array.isArray(m.targetEligibility) || m.targetEligibility.length === 0)
    invariant(
      m,
      "targetEligibility",
      m.targetEligibility,
      "at least one eligible target class is required",
    );
  if (!m.targetEligibility.every((c) => (MINE_TARGET_CLASSES as readonly string[]).includes(c)))
    invariant(
      m,
      "targetEligibility",
      m.targetEligibility,
      "every target class must be a canonical §14 target class",
    );

  assertSweepResistance(m);
  assertDecayPolicy(m);

  if (m.friendlyFirePolicyId !== MINE_FRIENDLY_FIRE_POLICY_ID)
    invariant(
      m,
      "friendlyFirePolicyId",
      m.friendlyFirePolicyId,
      "§25 shipped friendly-fire policy id",
    );
  if (m.battleGenerationPolicyId !== MINE_BATTLE_GENERATION_POLICY_ID)
    invariant(
      m,
      "battleGenerationPolicyId",
      m.battleGenerationPolicyId,
      "§11 shipped battle-generation policy id",
    );
  if (m.reportSignaturePolicyId !== MINE_REPORT_SIGNATURE_POLICY_ID)
    invariant(
      m,
      "reportSignaturePolicyId",
      m.reportSignaturePolicyId,
      "§20 shipped report-signature policy id",
    );

  if (!isNonEmptyString(m.contentVersion))
    invariant(m, "contentVersion", m.contentVersion, "content version must be a non-empty string");
}

function assertSweepResistance(m: MineTypeDefinition): void {
  const r = m.sweepResistance as unknown as Record<string, unknown> | null | undefined;
  if (!r || typeof r !== "object")
    invariant(m, "sweepResistance", r, "§9 sweep resistance is required");
  if (r.kind === "FLAT") {
    if (!isBp(r.valueBp))
      invariant(
        m,
        "sweepResistance.valueBp",
        r.valueBp,
        "§9 flat resistance must be basis points [0, 10_000]",
      );
  } else if (r.kind === "CAPABILITY_GATED") {
    if (!isBp(r.withCapabilityBp))
      invariant(
        m,
        "sweepResistance.withCapabilityBp",
        r.withCapabilityBp,
        "§9 capability-gated resistance must be basis points [0, 10_000]",
      );
    if (!isBp(r.withoutCapabilityBp))
      invariant(
        m,
        "sweepResistance.withoutCapabilityBp",
        r.withoutCapabilityBp,
        "§9 capability-gated resistance must be basis points [0, 10_000]",
      );
  } else if (r.kind !== "DEFINITION_REQUIRED") {
    invariant(
      m,
      "sweepResistance.kind",
      r.kind,
      "§9 sweep-resistance kind must be FLAT, CAPABILITY_GATED, or DEFINITION_REQUIRED",
    );
  }
}

function assertDecayPolicy(m: MineTypeDefinition): void {
  const d = m.decayPolicy as unknown as Record<string, unknown> | null | undefined;
  if (!d || typeof d !== "object") invariant(m, "decayPolicy", d, "§21 decay policy is required");
  if (d.kind === "FLAT") {
    if (!isBp(d.retentionBp))
      invariant(
        m,
        "decayPolicy.retentionBp",
        d.retentionBp,
        "§21 flat retention must be basis points [0, 10_000]",
      );
    if (d.freshnessRetentionBp !== null && !isBp(d.freshnessRetentionBp))
      invariant(
        m,
        "decayPolicy.freshnessRetentionBp",
        d.freshnessRetentionBp,
        "§21 freshness retention override must be null or basis points [0, 10_000]",
      );
  } else if (d.kind === "INFRASTRUCTURE_GATED") {
    if (!isBp(d.operationalRetentionBp))
      invariant(
        m,
        "decayPolicy.operationalRetentionBp",
        d.operationalRetentionBp,
        "§21 infrastructure-gated retention must be basis points [0, 10_000]",
      );
    if (!isBp(d.nonOperationalRetentionBp))
      invariant(
        m,
        "decayPolicy.nonOperationalRetentionBp",
        d.nonOperationalRetentionBp,
        "§21 infrastructure-gated retention must be basis points [0, 10_000]",
      );
    if (d.freshnessRetentionBp !== null && !isBp(d.freshnessRetentionBp))
      invariant(
        m,
        "decayPolicy.freshnessRetentionBp",
        d.freshnessRetentionBp,
        "§21 freshness retention override must be null or basis points [0, 10_000]",
      );
  } else if (d.kind !== "DEFINITION_REQUIRED") {
    invariant(
      m,
      "decayPolicy.kind",
      d.kind,
      "§21 decay-policy kind must be FLAT, INFRASTRUCTURE_GATED, or DEFINITION_REQUIRED",
    );
  }
}

export function validateMineTypeDefinition(m: MineTypeDefinition): void {
  assertMineTypeDefinitionSurface(m);
  if (!isNonEmptyString(m.contentHash))
    invariant(m, "contentHash", m.contentHash, "content hash must be a non-empty string");
}

export function computeMineTypeDefinitionContentHash(
  m: Omit<MineTypeDefinition, "contentHash">,
): string {
  const { contentHash: _ignored, ...surface } = m as MineTypeDefinition;
  return createEnvelope("mine-type-definition", mineTypeDefinitionsContentVersion, surface)
    .bodyHash;
}

export function withMineTypeDefinitionContentHash(
  m: Omit<MineTypeDefinition, "contentHash">,
): MineTypeDefinition {
  const full = m as MineTypeDefinition;
  assertMineTypeDefinitionSurface(full);
  return { ...m, contentHash: computeMineTypeDefinitionContentHash(m) };
}

export function verifyMineTypeDefinitionContentHash(m: MineTypeDefinition): boolean {
  return computeMineTypeDefinitionContentHash(m) === m.contentHash;
}

function sharedStrikeProfile(): MineStrikeProfile {
  return { baseSeverityWeightsBp: MINE_STRIKE_BASE_SEVERITY_WEIGHTS_BP };
}

const ALL_TARGET_CLASSES: readonly MineTargetClass[] = MINE_TARGET_CLASSES;

const ALL_SOURCE_KINDS: readonly MineSourceKind[] = MINE_SOURCE_KINDS;

const DEFAULT_BASE_LAYING_VALUE = 100;

export const SHIPPED_MINE_TYPE_DEFINITIONS: readonly MineTypeDefinition[] = [
  withMineTypeDefinitionContentHash({
    mineTypeId: "CONTACT",
    technologyPrerequisiteIds: [],
    eligibleLayingSourceKinds: ALL_SOURCE_KINDS,
    baseLayingValue: DEFAULT_BASE_LAYING_VALUE,
    strikeProfile: sharedStrikeProfile(),
    targetEligibility: ALL_TARGET_CLASSES,
    sweepResistance: { kind: "FLAT", valueBp: 10_000 },
    decayPolicy: { kind: "FLAT", retentionBp: 9_750, freshnessRetentionBp: null },
    friendlyFirePolicyId: MINE_FRIENDLY_FIRE_POLICY_ID,
    battleGenerationPolicyId: MINE_BATTLE_GENERATION_POLICY_ID,
    reportSignaturePolicyId: MINE_REPORT_SIGNATURE_POLICY_ID,
    contentVersion: mineTypeDefinitionsContentVersion,
  }),
  withMineTypeDefinitionContentHash({
    mineTypeId: "MAGNETIC",
    technologyPrerequisiteIds: ["magnetic_mine_technology"],
    eligibleLayingSourceKinds: ALL_SOURCE_KINDS,
    baseLayingValue: DEFAULT_BASE_LAYING_VALUE,
    strikeProfile: sharedStrikeProfile(),
    targetEligibility: ALL_TARGET_CLASSES,
    sweepResistance: {
      kind: "CAPABILITY_GATED",
      withCapabilityBp: 10_000,
      withoutCapabilityBp: 7_500,
    },
    decayPolicy: { kind: "FLAT", retentionBp: 9_500, freshnessRetentionBp: null },
    friendlyFirePolicyId: MINE_FRIENDLY_FIRE_POLICY_ID,
    battleGenerationPolicyId: MINE_BATTLE_GENERATION_POLICY_ID,
    reportSignaturePolicyId: MINE_REPORT_SIGNATURE_POLICY_ID,
    contentVersion: mineTypeDefinitionsContentVersion,
  }),
  withMineTypeDefinitionContentHash({
    mineTypeId: "ACOUSTIC",
    technologyPrerequisiteIds: ["acoustic_mine_technology"],
    eligibleLayingSourceKinds: ALL_SOURCE_KINDS,
    baseLayingValue: DEFAULT_BASE_LAYING_VALUE,
    strikeProfile: sharedStrikeProfile(),
    targetEligibility: ALL_TARGET_CLASSES,
    sweepResistance: {
      kind: "CAPABILITY_GATED",
      withCapabilityBp: 10_000,
      withoutCapabilityBp: 7_500,
    },
    decayPolicy: { kind: "FLAT", retentionBp: 9_250, freshnessRetentionBp: null },
    friendlyFirePolicyId: MINE_FRIENDLY_FIRE_POLICY_ID,
    battleGenerationPolicyId: MINE_BATTLE_GENERATION_POLICY_ID,
    reportSignaturePolicyId: MINE_REPORT_SIGNATURE_POLICY_ID,
    contentVersion: mineTypeDefinitionsContentVersion,
  }),
  withMineTypeDefinitionContentHash({
    mineTypeId: "CONTROLLED_DEFENSIVE",
    technologyPrerequisiteIds: ["controlled_mine_technology"],
    eligibleLayingSourceKinds: [
      "CONTROLLED_NAVAL_BASE",
      "COASTAL_ARTILLERY_OR_CONTROLLED_MINE_INSTALLATION",
      "SCENARIO_MINEFIELD",
      "TYPED_EVENT_MINEFIELD",
    ],
    baseLayingValue: DEFAULT_BASE_LAYING_VALUE,
    strikeProfile: sharedStrikeProfile(),
    targetEligibility: ALL_TARGET_CLASSES,
    sweepResistance: { kind: "FLAT", valueBp: 5_000 },
    decayPolicy: {
      kind: "INFRASTRUCTURE_GATED",
      operationalRetentionBp: 9_900,
      nonOperationalRetentionBp: 9_000,
      freshnessRetentionBp: null,
    },
    friendlyFirePolicyId: MINE_FRIENDLY_FIRE_POLICY_ID,
    battleGenerationPolicyId: MINE_BATTLE_GENERATION_POLICY_ID,
    reportSignaturePolicyId: MINE_REPORT_SIGNATURE_POLICY_ID,
    contentVersion: mineTypeDefinitionsContentVersion,
  }),
  withMineTypeDefinitionContentHash({
    mineTypeId: "SUBMARINE_LAID",
    technologyPrerequisiteIds: ["minelaying_submarine_technology"],
    eligibleLayingSourceKinds: ["MINELAYING_SUBMARINE"],
    baseLayingValue: DEFAULT_BASE_LAYING_VALUE,
    strikeProfile: sharedStrikeProfile(),
    targetEligibility: ALL_TARGET_CLASSES,
    sweepResistance: { kind: "FLAT", valueBp: 9_000 },
    decayPolicy: { kind: "FLAT", retentionBp: 9_500, freshnessRetentionBp: null },
    friendlyFirePolicyId: MINE_FRIENDLY_FIRE_POLICY_ID,
    battleGenerationPolicyId: MINE_BATTLE_GENERATION_POLICY_ID,
    reportSignaturePolicyId: MINE_REPORT_SIGNATURE_POLICY_ID,
    contentVersion: mineTypeDefinitionsContentVersion,
  }),
  withMineTypeDefinitionContentHash({
    mineTypeId: "SCENARIO_SPECIAL",
    technologyPrerequisiteIds: [],
    eligibleLayingSourceKinds: ["SCENARIO_MINEFIELD", "TYPED_EVENT_MINEFIELD"],
    baseLayingValue: DEFAULT_BASE_LAYING_VALUE,
    strikeProfile: sharedStrikeProfile(),
    targetEligibility: ALL_TARGET_CLASSES,
    sweepResistance: { kind: "DEFINITION_REQUIRED" },
    decayPolicy: { kind: "DEFINITION_REQUIRED" },
    friendlyFirePolicyId: MINE_FRIENDLY_FIRE_POLICY_ID,
    battleGenerationPolicyId: MINE_BATTLE_GENERATION_POLICY_ID,
    reportSignaturePolicyId: MINE_REPORT_SIGNATURE_POLICY_ID,
    contentVersion: mineTypeDefinitionsContentVersion,
  }),
];

export function mineTypeDefinitionById(mineTypeId: string): MineTypeDefinition {
  const def = SHIPPED_MINE_TYPE_DEFINITIONS.find((d) => d.mineTypeId === mineTypeId);
  if (!def) {
    throw new BluewaveError(INVALID_MINE_TYPE_DEFINITION, {
      code: INVALID_MINE_TYPE_DEFINITION,
      reason: "unknown mine type id — no shipped definition for this type",
      value: mineTypeId,
    });
  }
  return def;
}
