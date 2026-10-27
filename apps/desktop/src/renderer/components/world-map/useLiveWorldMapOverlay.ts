import { useMemo } from "react";
import type { StrategicMapView } from "@bluewave/campaign-engine";
import { useRead } from "../../lib/use-read.js";
import { EMPTY_LIVE_OVERLAY, joinWorldMap, type LiveWorldMapOverlay } from "./campaign-map-join.js";

export interface LiveWorldMapRead {
  readonly overlay: LiveWorldMapOverlay;
  readonly strategic: StrategicMapView | null;
  readonly status: "loading" | "ready" | "unavailable";
  readonly reason: string | null;
}

export function useLiveWorldMapOverlay(
  sessionId: string | null,
  revision: number | null = null,
  refreshToken = 0,
): LiveWorldMapRead {
  const read = useRead("inspectMap", sessionId ?? "", sessionId === null ? null : revision, {
    enabled: sessionId !== null,
    refreshToken,
  });

  return useMemo(() => {
    if (sessionId === null) {
      return { overlay: EMPTY_LIVE_OVERLAY, strategic: null, status: "unavailable", reason: null };
    }
    if (read.status === "loading") {
      return { overlay: EMPTY_LIVE_OVERLAY, strategic: null, status: "loading", reason: null };
    }
    if (read.status === "unavailable") {
      return {
        overlay: EMPTY_LIVE_OVERLAY,
        strategic: null,
        status: "unavailable",
        reason: read.reason,
      };
    }
    const overlay = joinWorldMap(read.value.strategic.world);
    return {
      overlay: { ...overlay, playerNationId: read.value.playerNationId },
      strategic: read.value.strategic,
      status: "ready",
      reason: null,
    };
  }, [read, sessionId]);
}
