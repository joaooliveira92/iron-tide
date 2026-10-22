import { BluewaveError } from "@bluewave/contracts";
import type { CompiledTorpedo } from "@bluewave/armament";
import { INVALID_TORPEDO_MODEL_DEFINITION } from "./reasonCodes.js";

export type CompiledTorpedoRegistry = Readonly<Record<string, CompiledTorpedo>>;

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
