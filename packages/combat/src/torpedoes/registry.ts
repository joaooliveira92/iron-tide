// The battle's compiled-torpedo registry (ship-part-model ticket 13b).
//
// Combat reads torpedo performance ONLY from the neutral `CompiledTorpedo` contract, keyed by the
// torpedo part id (the value the §13 track's `torpedoModelId` carries). The registry is threaded
// through the torpedo stage context, never read from a module constant: a battle that lacks a
// record for a loaded torpedo fails closed rather than defaulting (the old `torpedoModelById`
// semantics).
import { BluewaveError } from "@bluewave/contracts";
import type { CompiledTorpedo } from "@bluewave/armament";
import { INVALID_TORPEDO_MODEL_DEFINITION } from "./reasonCodes.js";

/** The compiled torpedo records available to one battle, keyed by torpedo part id. */
export type CompiledTorpedoRegistry = Readonly<Record<string, CompiledTorpedo>>;

/**
 * Fail-closed lookup: the compiled torpedo for a part id. An unknown id throws
 * INVALID_TORPEDO_MODEL_DEFINITION (never a silent default), mirroring the retired
 * `torpedoModelById`.
 */
export function compiledTorpedoOf(
  torpedoes: CompiledTorpedoRegistry,
  partId: string,
): CompiledTorpedo {
  const record = torpedoes[partId];
  if (record === undefined) {
    throw new BluewaveError(INVALID_TORPEDO_MODEL_DEFINITION, {
      code: INVALID_TORPEDO_MODEL_DEFINITION,
      reason: "unknown torpedo part id — no compiled torpedo in this battle's registry",
      value: partId,
    });
  }
  return record;
}
