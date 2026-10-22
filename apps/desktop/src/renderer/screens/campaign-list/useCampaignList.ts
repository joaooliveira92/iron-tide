import { useCallback, useState } from "react";
import { useBridge } from "../../lib/bridge-context.js";
import { readBridge } from "../../lib/bridge-read.js";
import {
  applyListLoaded,
  applyLoadFailed,
  initialCampaignListScreenState,
} from "./campaign-list-screen-state.js";

export function useCampaignList() {
  const bridge = useBridge();
  const [state, setState] = useState(initialCampaignListScreenState);

  const reload = useCallback(async () => {
    const read = await readBridge(bridge, (b) => b.campaign.execute("listCampaigns", undefined));
    setState((current) =>
      read.status === "ready"
        ? applyListLoaded(current, read.value)
        : applyLoadFailed(current, read.reason),
    );
  }, [bridge]);

  return { state, reload };
}
