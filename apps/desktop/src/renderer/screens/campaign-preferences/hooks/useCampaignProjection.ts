import { useCallback, useEffect, useState } from "react";
import { useBridge } from "../../../lib/bridge-context.js";
import { readBridge } from "../../../lib/bridge-read.js";
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
    const read = await readBridge(bridge, (b) => b.campaign.execute("inspectCampaign", sessionId));
    if (read.status !== "ready") {
      setLoadError(read.reason);
      return;
    }
    setProjection(read.value.projection);
  }, [bridge, sessionId]);

  useEffect(() => {
    void loadProjection();
  }, [loadProjection]);

  return { projection, loadError, loadProjection };
}
