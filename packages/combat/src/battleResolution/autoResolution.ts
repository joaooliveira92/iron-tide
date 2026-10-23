import { BluewaveError } from "@bluewave/contracts";
export function assertAutoResolvable(manifest: {
  id: string;
  accepted: boolean;
  requiresTacticalCommandForContinuity?: boolean;
}) {
  if (!manifest.accepted)
    throw new BluewaveError("AUTO_RESOLUTION_UNAVAILABLE", {
      code: "AUTO_RESOLUTION_UNAVAILABLE",
      manifest,
    });
}
