import { BluewaveError, SafeInt } from "@bluewave/contracts";
import {
  MINE_BASIS_POINTS_PER_UNIT,
  MINE_FORMULA_VERSION,
  MINE_RULESET_VERSION,
  type MineDecayPolicy,
  type MineType,
} from "./constants.js";
import { mineTypeDefinitionById, SHIPPED_MINE_TYPE_DEFINITIONS } from "./model.js";
import {
  MINE_PRESSURE_MIN,
  type AreaMinePressureRecord,
  computeAreaPressureRecordHash,
  withAreaMinePressureRecordHash,
} from "./pressure-record.js";
import {
  MINE_DECAY_POLICY_MISSING,
  INVALID_MINE_PRESSURE_STATE,
  MINE_WARFARE_INVARIANT_FAILED,
} from "./reasonCodes.js";

export const mineDecayPolicyId = "mine_decay_v1" as const;

export interface MineDecayRetentionDatum {
  mineTypeId: MineType;
  retention: number | readonly [number, number] | null;
}

export interface MineDecayContract {
  policyId: string;
  rulesetVersion: string;
  formulaVersion: string;
  basisPointsPerUnit: number;
  retentionByType: readonly MineDecayRetentionDatum[];
  freshnessUsesSameMultiplierUnlessNarrowerExplicit: boolean;
}

export const SHIPPED_MINE_DECAY_RETENTION_BY_TYPE: readonly MineDecayRetentionDatum[] =
  SHIPPED_MINE_TYPE_DEFINITIONS.map((def) => {
    const policy: MineDecayPolicy = def.decayPolicy;
    if (policy.kind === "FLAT")
      return { mineTypeId: def.mineTypeId, retention: policy.retentionBp };
    if (policy.kind === "INFRASTRUCTURE_GATED")
      return {
        mineTypeId: def.mineTypeId,
        retention: [policy.operationalRetentionBp, policy.nonOperationalRetentionBp] as const,
      };
    return { mineTypeId: def.mineTypeId, retention: null };
  });

export const SHIPPED_MINE_DECAY_CONTRACT: MineDecayContract = {
  policyId: mineDecayPolicyId,
  rulesetVersion: MINE_RULESET_VERSION,
  formulaVersion: MINE_FORMULA_VERSION,
  basisPointsPerUnit: MINE_BASIS_POINTS_PER_UNIT,
  retentionByType: SHIPPED_MINE_DECAY_RETENTION_BY_TYPE,
  freshnessUsesSameMultiplierUnlessNarrowerExplicit: true,
};

function mineDecayContractMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(MINE_WARFARE_INVARIANT_FAILED, {
    code: MINE_WARFARE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function retentionMatches(
  a: number | readonly [number, number] | null,
  b: number | readonly [number, number] | null,
): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a[0] === b[0] && a[1] === b[1];
  return a === b;
}

export function validateMineDecayContract(
  c: Partial<MineDecayContract> | null | undefined,
): asserts c is MineDecayContract {
  if (!c) mineDecayContractMismatch(c, "mine_decay_v1 missing contract");
  if (c.policyId !== mineDecayPolicyId)
    mineDecayContractMismatch(c, "mine_decay_v1 expected policy id");
  if (c.rulesetVersion !== MINE_RULESET_VERSION || c.formulaVersion !== MINE_FORMULA_VERSION)
    mineDecayContractMismatch(c, "mine_decay_v1 ruleset/formula versions");
  if (c.basisPointsPerUnit !== MINE_BASIS_POINTS_PER_UNIT)
    mineDecayContractMismatch(c, "mine_decay_v1 basis-point scale");
  if (
    !c.retentionByType ||
    c.retentionByType.length !== SHIPPED_MINE_DECAY_RETENTION_BY_TYPE.length
  )
    mineDecayContractMismatch(c, "mine_decay_v1 retention-by-type list length");
  for (let i = 0; i < SHIPPED_MINE_DECAY_RETENTION_BY_TYPE.length; i++) {
    const shipped = SHIPPED_MINE_DECAY_RETENTION_BY_TYPE[i]!;
    const given = c.retentionByType[i];
    if (
      !given ||
      given.mineTypeId !== shipped.mineTypeId ||
      !retentionMatches(given.retention, shipped.retention)
    )
      mineDecayContractMismatch(c, `mine_decay_v1 §21 retention for type ${shipped.mineTypeId}`);
  }
  if (c.freshnessUsesSameMultiplierUnlessNarrowerExplicit !== true)
    mineDecayContractMismatch(c, "mine_decay_v1 §21 same-multiplier-unless-narrower fact");
}

export interface DecayedPressure {
  retentionMultiplierBp: number;
  pressureAfterDecay: SafeInt;
  decayedPressure: SafeInt;
  freshnessRetentionMultiplierBp: number;
}

function throwDecayPolicyMissing(record: AreaMinePressureRecord): never {
  throw new BluewaveError(MINE_DECAY_POLICY_MISSING, {
    code: MINE_DECAY_POLICY_MISSING,
    minePressureId: record.minePressureId,
    mineTypeId: record.mineTypeId,
    reason:
      "scenario-special minefield has no §21 decay metadata — a decay policy definition is required",
  });
}

export function resolveDecayRetentionMultiplier(
  record: AreaMinePressureRecord,
  controlInfrastructureOperational: boolean,
): number {
  const policy: MineDecayPolicy = mineTypeDefinitionById(record.mineTypeId).decayPolicy;
  switch (policy.kind) {
    case "FLAT":
      return policy.retentionBp;
    case "INFRASTRUCTURE_GATED":
      return controlInfrastructureOperational
        ? policy.operationalRetentionBp
        : policy.nonOperationalRetentionBp;
    case "DEFINITION_REQUIRED":
      return throwDecayPolicyMissing(record);
  }
}

export function resolveDecayFreshnessRetentionMultiplier(
  record: AreaMinePressureRecord,
  controlInfrastructureOperational: boolean,
): number {
  const policy: MineDecayPolicy = mineTypeDefinitionById(record.mineTypeId).decayPolicy;
  if (policy.kind === "DEFINITION_REQUIRED") return throwDecayPolicyMissing(record);
  if (policy.freshnessRetentionBp !== null) return policy.freshnessRetentionBp;
  return resolveDecayRetentionMultiplier(record, controlInfrastructureOperational);
}

function assertActiveRecordForDecay(record: AreaMinePressureRecord): void {
  if (record.pressure < MINE_PRESSURE_MIN) {
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "pressure",
      reason:
        "decay requires an active pressure record (0 means absence, §1) — apply decay to the active record",
      value: record.pressure,
    });
  }
  if (!SafeInt.isSafeInt(record.pressure) || !SafeInt.isSafeInt(record.freshnessBp)) {
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "pressure|freshnessBp",
      reason: "decay inputs must be safe integers",
      value: { pressure: record.pressure, freshnessBp: record.freshnessBp },
    });
  }
}

export function computeDecayedPressure(
  record: AreaMinePressureRecord,
  controlInfrastructureOperational: boolean,
): DecayedPressure {
  assertActiveRecordForDecay(record);
  const retentionMultiplierBp = resolveDecayRetentionMultiplier(
    record,
    controlInfrastructureOperational,
  );
  const freshnessRetentionMultiplierBp = resolveDecayFreshnessRetentionMultiplier(
    record,
    controlInfrastructureOperational,
  );
  const pressureAfterDecay = Number(
    (BigInt(record.pressure) * BigInt(retentionMultiplierBp)) / BigInt(MINE_BASIS_POINTS_PER_UNIT),
  );
  return {
    retentionMultiplierBp,
    pressureAfterDecay: SafeInt(pressureAfterDecay),
    decayedPressure: SafeInt(Number(BigInt(record.pressure) - BigInt(pressureAfterDecay))),
    freshnessRetentionMultiplierBp,
  };
}

export function applyDecayedMonth(
  record: AreaMinePressureRecord,
  controlInfrastructureOperational: boolean,
  decayMonth: SafeInt,
): AreaMinePressureRecord {
  if (!SafeInt.isSafeInt(decayMonth))
    throw new BluewaveError(INVALID_MINE_PRESSURE_STATE, {
      code: INVALID_MINE_PRESSURE_STATE,
      field: "decayMonth",
      reason: "decay month must be a safe integer (§21)",
      value: decayMonth,
    });
  if (record.pressure < MINE_PRESSURE_MIN) return record;

  const { pressureAfterDecay, freshnessRetentionMultiplierBp } = computeDecayedPressure(
    record,
    controlInfrastructureOperational,
  );
  const freshnessAfterDecay = Number(
    (BigInt(record.freshnessBp) * BigInt(freshnessRetentionMultiplierBp)) /
      BigInt(MINE_BASIS_POINTS_PER_UNIT),
  );
  const updated: Omit<AreaMinePressureRecord, "recordHash"> = {
    ...record,
    pressure: pressureAfterDecay,
    freshnessBp: SafeInt(freshnessAfterDecay),
    lastDecayedMonth: decayMonth,
  };

  if (pressureAfterDecay >= MINE_PRESSURE_MIN) {
    return withAreaMinePressureRecordHash(updated);
  }
  return {
    ...updated,
    recordHash: computeAreaPressureRecordHash(updated as AreaMinePressureRecord),
  };
}
