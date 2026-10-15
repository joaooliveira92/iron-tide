import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

/**
 * Derive the deterministic command id for one construction request.
 *
 * A retry of the SAME payload reproduces the same id (idempotent replay),
 * while reusing a `transportRequestId` with a DIFFERENT payload produces a
 * different id -> the idempotency store reports `IDEMPOTENCY_CONFLICT`
 * instead of silently serving the wrong order.
 */
export function deriveConstructionCommandId(
  transportRequestId: string,
  designId: string,
  expectedRevision: number,
): string {
  const fingerprint = sha256Hex(canonicalSerialize({ designId, expectedRevision })).slice(0, 8);
  return `cmd-${transportRequestId}-${fingerprint}`;
}
