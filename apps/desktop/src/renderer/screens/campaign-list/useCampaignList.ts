import { useCallback, useState } from "react";
import { useBridge } from "../../lib/bridge-context.js";
import {
  applyListLoaded,
  applyLoadFailed,
  initialCampaignListScreenState,
} from "./campaign-list-screen-state.js";

export function useCampaignList() {
  const bridge = useBridge();
  const [state, setState] = useState(initialCampaignListScreenState);

  const reload = useCallback(async () => {
    if (bridge === undefined) {
      setState((current) => applyLoadFailed(current, "Bluewave bridge not available"));
      return;
    }
    const result = await bridge.campaign.execute("listCampaigns", undefined);
    if (result.outcome !== "success") {
      setState((current) => applyLoadFailed(current, result.reason));
      return;
    }
    setState((current) => applyListLoaded(current, result.value));
  }, [bridge]);

  return { state, reload };
}
