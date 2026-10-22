import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

export function deriveConstructionCommandId(
  transportRequestId: string,
  designId: string,
  expectedRevision: number,
): string {
  const fingerprint = sha256Hex(canonicalSerialize({ designId, expectedRevision })).slice(0, 8);
  return `cmd-${transportRequestId}-${fingerprint}`;
}
