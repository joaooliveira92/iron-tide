import type { ReactNode } from "react";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { PresentationContentGate } from "../content/PresentationContentGate.js";
import { UiCatalogueGate } from "../content/UiCatalogueGate.js";
import { SharedWorldMapProvider } from "../components/world-map/shared-world-map.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { CampaignShellProvider, useCampaignShellState } from "./CampaignShellContext.js";
import { FleetFocusProvider } from "./fleet-focus.js";

function CampaignWorldMap({ children }: { readonly children: ReactNode }) {
  const { campaign } = useCampaignShellState();
  return (
    <SharedWorldMapProvider key={campaign?.sessionId ?? "no-campaign"}>
      {children}
    </SharedWorldMapProvider>
  );
}

export function AppProviders({
  bridge,
  children,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
  readonly children: ReactNode;
}) {
  return (
    <BridgeProvider bridge={bridge}>
      <PresentationContentGate>
        <UiCatalogueGate>
          <CampaignShellProvider bridge={bridge}>
            <CampaignWorldMap>
              <FleetFocusProvider>{children}</FleetFocusProvider>
            </CampaignWorldMap>
          </CampaignShellProvider>
        </UiCatalogueGate>
      </PresentationContentGate>
    </BridgeProvider>
  );
}
