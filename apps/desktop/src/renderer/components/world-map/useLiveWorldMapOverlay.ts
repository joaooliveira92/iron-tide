/**
 * Fetching and joining the live campaign overlay is its own concern, separate
 * from the map's interaction state machine. This hook owns the bridge calls,
 * their cancellation, and the player-nation resolution; it returns the overlay
 * the chart should draw (or the empty fixture fallback when there is no
 * session, or the bridge/inspection fails).
 */

import { useEffect, useMemo, useState } from "react";
import { useBridge } from "../../lib/bridge-context.js";
import { resolvePlayerNationId } from "./area-tree.js";
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
        setOverlay(joinWorldMap(result.value.world));
        // The tree's Ships / Possessions lenses are the player's: resolve who that is.
        return Promise.resolve(bridge.campaign.execute("inspectCampaign", sessionId))
          .then((campaign) => {
            if (!active) return;
            setPlayerNationId(
              campaign?.outcome === "success"
                ? resolvePlayerNationId(result.value.world, campaign.value.projection.nationName)
                : null,
            );
          })
          .catch(() => {
            if (active) setPlayerNationId(null);
          });
      })
      .catch(() => {
        if (active) setOverlay(EMPTY_LIVE_OVERLAY);
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
