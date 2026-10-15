import { useCallback, useEffect, useState } from "react";
import { useBridge } from "../../../lib/bridge-context.js";
import type { PlayerProjection } from "@bluewave/campaign-engine";

export interface UseCampaignProjectionReturn {
  readonly projection: PlayerProjection | null;
  readonly loadError: string | null;
  readonly loadProjection: () => Promise<void>;
}

export function useCampaignProjection(sessionId: string): UseCampaignProjectionReturn {
  const [projection, setProjection] = useState<PlayerProjection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const bridge = useBridge();

  const loadProjection = useCallback(async () => {
    if (bridge === undefined) {
      setLoadError("Bluewave bridge not available");
      return;
    }
    const result = await bridge.campaign.execute("inspectCampaign", sessionId);
    if (result.outcome !== "success") {
      setLoadError(result.reason);
      return;
    }
    setProjection(result.value.projection);
  }, [bridge, sessionId]);

  useEffect(() => {
    void loadProjection();
  }, [loadProjection]);

  return { projection, loadError, loadProjection };
}
