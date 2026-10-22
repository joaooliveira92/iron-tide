import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { createEnvelope } from "@bluewave/deterministic";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
  MINE_TYPES,
  type MineType,
} from "./constants.js";
import { INVALID_MINE_PRESSURE_STATE } from "./reasonCodes.js";

export const MINE_PRESSURE_MIN = 1 as const;
export const MINE_PRESSURE_MAX = 1_000_000 as const;

export const MINE_FRESHNESS_MIN_BP = 0 as const;
export const MINE_FRESHNESS_MAX_BP = MINE_BASIS_POINTS_PER_UNIT;

export const minePressureRecordContentVersion = "mine_pressure_v1" as const;

export const MINE_PRESSURE_POLICY_ID = minePressureRecordContentVersion;

export interface MinePressureContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  pressureMin: number;
  pressureMax: number;
  freshnessMinBp: number;
  freshnessMaxBp: number;
}

export const SHIPPED_MINE_PRESSURE_CONTRACT: MinePressureContract = {
  policyId: MINE_PRESSURE_POLICY_ID,
  rulesetVersion: MINE_RULESET_VERSION,
  formulaVersion: MINE_FORMULA_VERSION,
  basisPointsPerUnit: MINE_BASIS_POINTS_PER_UNIT,
  pressureMin: MINE_PRESSURE_MIN,
  pressureMax: MINE_PRESSURE_MAX,
  freshnessMinBp: MINE_FRESHNESS_MIN_BP,
  freshnessMaxBp: MINE_FRESHNESS_MAX_BP,
};

function minePressureContractMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
    code: INVALID_MINE_PRESSURE_STATE,
    contract,
    reason,
  });
}

export function validateMinePressureContract(
  c: Partial<MinePressureContract> | null | undefined,
): asserts c is MinePressureContract {
  if (!c) minePressureContractMismatch(c, "mine_pressure_v1 missing contract");
  if (c.policyId !== MINE_PRESSURE_POLICY_ID)
    minePressureContractMismatch(c, "mine_pressure_v1 expected policy id");
  if (c.rulesetVersion !== MINE_RULESET_VERSION || c.formulaVersion !== MINE_FORMULA_VERSION)
    minePressureContractMismatch(c, "mine_pressure_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== MINE_BASIS_POINTS_PER_UNIT)
    minePressureContractMismatch(c, "mine_pressure_v1 basis-point scale");
  if (c.pressureMin !== MINE_PRESSURE_MIN || c.pressureMax !== MINE_PRESSURE_MAX)
    minePressureContractMismatch(c, "mine_pressure_v1 §1 pressure bounds");
  if (c.freshnessMinBp !== MINE_FRESHNESS_MIN_BP || c.freshnessMaxBp !== MINE_FRESHNESS_MAX_BP)
    minePressureContractMismatch(c, "mine_pressure_v1 §1 freshness bounds");
}

export interface OrderedSourceCompositionItem {
  layingSourceId: string;
  contributingValue: number;
  count: number;
}

export interface MineDetectionConfidenceRecord {
  observingParticipantId: string;
  confidenceBp: number;
}

export interface AreaMinePressureRecord {
  minePressureId: string;
  areaId: string;
  layingParticipantId: string;
  targetBelligerents: readonly string[];
  mineTypeId: MineType;
  pressure: SafeInt;
  freshnessBp: SafeInt;
  sourceComposition: readonly OrderedSourceCompositionItem[];
  mineCountOrAbstractedEquivalent: SafeInt;
  detectionConfidenceRecords: readonly MineDetectionConfidenceRecord[];
  creationMonth: SafeInt;
  lastReinforcedMonth: SafeInt | null;
  lastDecayedMonth: SafeInt | null;
  lastSweptMonth: SafeInt | null;
  legalOwnerOfSourceFacilities: string | null;
  militaryControllerOfSourceFacilities: string | null;
  rulesetVersion: string;
  formulaVersion: string;
  recordHash: string;
}

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && Number.isSafeInteger(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export function assertAreaMinePressureRecordSurface(r: AreaMinePressureRecord): void {
  const invariant = (field: string, value: unknown, reason: string): never => {
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field,
      reason,
      value,
    });
  };

  if (!isNonEmptyString(r.minePressureId))
    invariant("minePressureId", r.minePressureId, "non-empty id required");
  if (!isNonEmptyString(r.areaId)) invariant("areaId", r.areaId, "non-empty area id required");
  if (!isNonEmptyString(r.layingParticipantId))
    invariant(
      "layingParticipantId",
      r.layingParticipantId,
      "non-empty laying participant required",
    );

  if (!Array.isArray(r.targetBelligerents) || r.targetBelligerents.length === 0)
    invariant(
      "targetBelligerents",
      r.targetBelligerents,
      "ordered target belligerents must be non-empty",
    );
  for (const id of r.targetBelligerents) {
    if (!isNonEmptyString(id))
      invariant(
        "targetBelligerents",
        r.targetBelligerents,
        "target belligerent ids must be non-empty strings",
      );
  }

  if (!(MINE_TYPES as readonly string[]).includes(r.mineTypeId))
    invariant("mineTypeId", r.mineTypeId, "must be a canonical §2 mine type");

  if (!isInt(r.pressure) || r.pressure < MINE_PRESSURE_MIN || r.pressure > MINE_PRESSURE_MAX)
    invariant(
      "pressure",
      r.pressure,
      `pressure must be an integer within ${MINE_PRESSURE_MIN}..${MINE_PRESSURE_MAX}`,
    );

  if (
    !isInt(r.freshnessBp) ||
    r.freshnessBp < MINE_FRESHNESS_MIN_BP ||
    r.freshnessBp > MINE_FRESHNESS_MAX_BP
  )
    invariant(
      "freshnessBp",
      r.freshnessBp,
      `freshness must be an integer within ${MINE_FRESHNESS_MIN_BP}..${MINE_FRESHNESS_MAX_BP}`,
    );

  if (!Array.isArray(r.sourceComposition))
    invariant("sourceComposition", r.sourceComposition, "source composition must be an array");
  for (let i = 0; i < r.sourceComposition.length; i++) {
    const raw = r.sourceComposition[i] as unknown;
    if (raw === null || raw === undefined || typeof raw !== "object")
      invariant(`sourceComposition[${i}]`, raw, "composition item must be a record");
    const item = raw as Record<string, unknown>;
    if (!isNonEmptyString(item.layingSourceId))
      invariant(
        `sourceComposition[${i}].layingSourceId`,
        item.layingSourceId,
        "non-empty laying source id",
      );
    if (!isInt(item.contributingValue) || (item.contributingValue as number) < 0)
      invariant(
        `sourceComposition[${i}].contributingValue`,
        item.contributingValue,
        "contributing value must be a non-negative integer",
      );
    if (!isInt(item.count) || (item.count as number) < 0)
      invariant(
        `sourceComposition[${i}].count`,
        item.count,
        "count must be a non-negative integer",
      );
  }

  if (!isInt(r.mineCountOrAbstractedEquivalent) || r.mineCountOrAbstractedEquivalent < 0)
    invariant(
      "mineCountOrAbstractedEquivalent",
      r.mineCountOrAbstractedEquivalent,
      "mine count / abstracted equivalent must be a non-negative integer",
    );

  if (!Array.isArray(r.detectionConfidenceRecords))
    invariant(
      "detectionConfidenceRecords",
      r.detectionConfidenceRecords,
      "detection-confidence records must be an array",
    );
  for (let i = 0; i < r.detectionConfidenceRecords.length; i++) {
    const raw = r.detectionConfidenceRecords[i] as unknown;
    if (raw === null || raw === undefined || typeof raw !== "object")
      invariant(`detectionConfidenceRecords[${i}]`, raw, "confidence record must be a record");
    const item = raw as Record<string, unknown>;
    if (!isNonEmptyString(item.observingParticipantId))
      invariant(
        `detectionConfidenceRecords[${i}].observingParticipantId`,
        item.observingParticipantId,
        "non-empty observing participant id",
      );
    if (
      !isInt(item.confidenceBp) ||
      (item.confidenceBp as number) < MINE_FRESHNESS_MIN_BP ||
      (item.confidenceBp as number) > MINE_FRESHNESS_MAX_BP
    )
      invariant(
        `detectionConfidenceRecords[${i}].confidenceBp`,
        item.confidenceBp,
        `confidence must be within ${MINE_FRESHNESS_MIN_BP}..${MINE_FRESHNESS_MAX_BP}`,
      );
  }

  if (!isInt(r.creationMonth))
    invariant("creationMonth", r.creationMonth, "creation month must be an integer");
  if (r.lastReinforcedMonth !== null && !isInt(r.lastReinforcedMonth))
    invariant(
      "lastReinforcedMonth",
      r.lastReinforcedMonth,
      "last reinforced month must be an integer or null",
    );
  if (r.lastDecayedMonth !== null && !isInt(r.lastDecayedMonth))
    invariant(
      "lastDecayedMonth",
      r.lastDecayedMonth,
      "last decay month must be an integer or null",
    );
  if (r.lastSweptMonth !== null && !isInt(r.lastSweptMonth))
    invariant("lastSweptMonth", r.lastSweptMonth, "last swept month must be an integer or null");

  if (r.legalOwnerOfSourceFacilities !== null && !isNonEmptyString(r.legalOwnerOfSourceFacilities))
    invariant(
      "legalOwnerOfSourceFacilities",
      r.legalOwnerOfSourceFacilities,
      "must be a non-empty string or null",
    );
  if (
    r.militaryControllerOfSourceFacilities !== null &&
    !isNonEmptyString(r.militaryControllerOfSourceFacilities)
  )
    invariant(
      "militaryControllerOfSourceFacilities",
      r.militaryControllerOfSourceFacilities,
      "must be a non-empty string or null",
    );

  if (r.rulesetVersion !== MINE_RULESET_VERSION)
    invariant("rulesetVersion", r.rulesetVersion, "must be the shipped mine ruleset version");
  if (r.formulaVersion !== MINE_FORMULA_VERSION)
    invariant("formulaVersion", r.formulaVersion, "must be the shipped mine formula version");
}

export function validateAreaMinePressureRecord(r: AreaMinePressureRecord): void {
  assertAreaMinePressureRecordSurface(r);
  if (!isNonEmptyString(r.recordHash)) {
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "recordHash",
      reason: "record hash must be a non-empty string",
      value: r.recordHash,
    });
  }
}

export function isActivePressure(pressure: number): boolean {
  return isInt(pressure) && pressure >= MINE_PRESSURE_MIN && pressure <= MINE_PRESSURE_MAX;
}

export function computeAreaPressureRecordHash(r: AreaMinePressureRecord): string {
  const { recordHash: _ignored, ...surface } = r;
  void _ignored;
  return createEnvelope("area-mine-pressure-record", minePressureRecordContentVersion, surface)
    .bodyHash;
}

export function withAreaMinePressureRecordHash(
  r: Omit<AreaMinePressureRecord, "recordHash">,
): AreaMinePressureRecord {
  const full = r as AreaMinePressureRecord;
  assertAreaMinePressureRecordSurface(full);
  return { ...full, recordHash: computeAreaPressureRecordHash(full) };
}

export function verifyAreaMinePressureRecordHash(r: AreaMinePressureRecord): boolean {
  return computeAreaPressureRecordHash(r) === r.recordHash;
}
