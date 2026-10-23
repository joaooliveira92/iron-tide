import { BluewaveError } from "@bluewave/contracts";
import { AUTO_RESOLUTION_UNAVAILABLE } from "./reasonCodes.js";
import type { BattleManifest } from "./manifest.js";
import { assertAutoResolvable } from "../battleResolution/autoResolution.js";

export const AUTO_RESOLUTION_DECLARED_SURFACE_V1 = "auto_resolution_declared_surface_v1" as const;

export const RESOLVER_SUPPORTED_ASSET_TYPES = new Set(["Ship"]);
export const RESOLVER_SUPPORTED_FEATURES = new Set([
  "persistent_surface_ships",
  "strength_damage_losses",
  "provenance_return",
]);

export interface ResolverCapabilities {
  supportedAssetTypes: ReadonlySet<string>;
  supportedFeatures: ReadonlySet<string>;
  surfaceVersion: string;
}

export function shippedResolverCapabilities(): ResolverCapabilities {
  return {
    supportedAssetTypes: RESOLVER_SUPPORTED_ASSET_TYPES,
    supportedFeatures: RESOLVER_SUPPORTED_FEATURES,
    surfaceVersion: AUTO_RESOLUTION_DECLARED_SURFACE_V1,
  };
}

export function proveAutoResolvable(
  manifest: BattleManifest,
  capabilities: ResolverCapabilities,
  context?: Record<string, unknown>,
): string {
  assertAutoResolvable({ id: manifest.battleId, accepted: true });

  if (!capabilities.supportedAssetTypes.has("Ship")) {
    throw new BluewaveError(AUTO_RESOLUTION_UNAVAILABLE, {
      code: AUTO_RESOLUTION_UNAVAILABLE,
      battleId: manifest.battleId,
      reason: "resolver does not support persistent ships",
      ...context,
    });
  }
  if (!capabilities.supportedFeatures.has("persistent_surface_ships")) {
    throw new BluewaveError(AUTO_RESOLUTION_UNAVAILABLE, {
      code: AUTO_RESOLUTION_UNAVAILABLE,
      battleId: manifest.battleId,
      reason: "resolver lacks persistent-surface-ships support",
      ...context,
    });
  }
  if (manifest.missionObjectives.length > 0) {
    if (!capabilities.supportedFeatures.has("objectives")) {
      throw new BluewaveError(AUTO_RESOLUTION_UNAVAILABLE, {
        code: AUTO_RESOLUTION_UNAVAILABLE,
        battleId: manifest.battleId,
        reason: "resolver lacks objectives support",
        ...context,
      });
    }
  }

  return capabilities.surfaceVersion;
}
