import { useEffect, useMemo, useState } from "react";
import { useBridge } from "../../lib/bridge-context.js";
import { EMPTY_LIVE_OVERLAY, joinWorldMap, type LiveWorldMapOverlay } from "./campaign-map-join.js";

export function useLiveWorldMapOverlay(sessionId: string | null): LiveWorldMapOverlay {
  const bridge = useBridge();
  const [baseOverlay, setOverlay] = useState<LiveWorldMapOverlay>(EMPTY_LIVE_OVERLAY);
  const [playerNationId, setPlayerNationId] = useState<string | null>(null);

  useEffect(() => {
    if (bridge === undefined || sessionId === null) {
      setOverlay(EMPTY_LIVE_OVERLAY);
      return;
    }
    let active = true;
    bridge.campaign
      .execute("inspectMap", sessionId)
      .then((result) => {
        if (!active) return;
        if (result.outcome !== "success") {
          setOverlay(EMPTY_LIVE_OVERLAY);
          setPlayerNationId(null);
          return;
        }
        setOverlay(joinWorldMap(result.value.strategic.world));
        setPlayerNationId(result.value.playerNationId);
      })
      .catch(() => {
        if (active) {
          setOverlay(EMPTY_LIVE_OVERLAY);
          setPlayerNationId(null);
        }
      });
    return () => {
      active = false;
    };
  }, [bridge, sessionId]);

  const overlay = useMemo(
    () => (baseOverlay.source === "campaign" ? { ...baseOverlay, playerNationId } : baseOverlay),
    [baseOverlay, playerNationId],
  );

  return overlay;
}
