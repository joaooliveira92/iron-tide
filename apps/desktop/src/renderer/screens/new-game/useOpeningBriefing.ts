import { useEffect, useState } from "react";

import type { OpeningBriefingProjection } from "@bluewave/campaign-engine";
import type { InspectOpeningBriefingResult } from "../../../shared/campaign-command-contract.js";
import type { BridgeResult } from "../../../shared/bridge-contract.js";

export type LoadOpeningBriefing = (
  sessionId: string,
) => Promise<BridgeResult<InspectOpeningBriefingResult>>;

export interface OpeningBriefing {
  readonly projection: OpeningBriefingProjection | null;
  readonly error: string | null;
}

export function useOpeningBriefing(sessionId: string, load: LoadOpeningBriefing): OpeningBriefing {
  const [projection, setProjection] = useState<OpeningBriefingProjection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setProjection(null);
    setError(null);
    void load(sessionId).then((result) => {
      if (!active) return;
      if (result.outcome !== "success") {
        setError(result.reason);
        return;
      }
      setProjection(result.value.projection);
    });
    return () => {
      active = false;
    };
  }, [sessionId, load]);

  return { projection, error };
}
