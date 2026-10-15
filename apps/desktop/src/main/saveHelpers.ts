import type { CampaignState } from "@bluewave/campaign";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

/**
 * `CampaignCompiler.compile()`'s `rawHash` (and, equally, any hand-built
 * post-month `CampaignState`) is computed over `snapshot` alone, but
 * `SaveStore.save`/`load` verify a hash computed over the whole state
 * (`{snapshot, envelope}`) — the two don't agree, so saving a state's own
 * `rawHash` as-is fails `SaveStore.load`'s integrity check.
 * `packages/cross-process-test/src/run-child.ts` (the one proven
 * compile->advance->save/load loop in the repo) recomputes `rawHash` this
 * same way immediately before calling `store.save`; `compileCampaign.ts`
 * (ticket 12) and `commitMonth.ts` (ticket 13) both need this exact
 * recomputation, so it lives here once rather than duplicated per command.
 */
export function toSaveableState(state: CampaignState): CampaignState {
  const { rawHash: _rawHash, ...stateForHash } = state;
  return { ...state, rawHash: sha256Hex(canonicalSerialize(stateForHash)) };
}
