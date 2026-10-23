import { useCallback, useState } from "react";
import type { PlayerProjection } from "@bluewave/campaign-engine";

import { useCampaignRevision } from "../shell/CampaignShellContext.js";
import { useRead } from "./use-read.js";

export interface CampaignProjectionState {
  readonly projection: PlayerProjection | null;
  readonly loadError: string | null;
  readonly reload: () => void;
}

export function useCampaignProjection(sessionId: string): CampaignProjectionState {
  const revision = useCampaignRevision();
  const [refreshToken, setRefreshToken] = useState(0);
  const read = useRead("inspectCampaign", sessionId, revision, { refreshToken });
  const reload = useCallback(() => setRefreshToken((token) => token + 1), []);

  if (read.status === "ready")
    return { projection: read.value.projection, loadError: null, reload };
  if (read.status === "unavailable") return { projection: null, loadError: read.reason, reload };
  return { projection: null, loadError: null, reload };
}
