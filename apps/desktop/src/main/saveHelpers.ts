import type { CampaignState } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

export function toSaveableState(state: CampaignState): CampaignState {
  const { rawHash: _rawHash, ...stateForHash } = state;
  return { ...state, rawHash: sha256Hex(canonicalSerialize(stateForHash)) };
}
