import type { ReactNode } from "react";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { WindowState } from "../../shared/bridge-contract.js";
import { PresentationContentGate } from "../content/PresentationContentGate.js";
import { UiCatalogueGate } from "../content/UiCatalogueGate.js";
import { SharedWorldMapProvider } from "../components/world-map/shared-world-map.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { BackgroundLayer } from "./BackgroundLayer.js";
import { useBackground } from "./BackgroundContext.js";
import { CampaignShellProvider, useCampaignShellState } from "./CampaignShellContext.js";
import { FleetFocusProvider } from "./fleet-focus.js";
import { CampaignInterruptions } from "./interruptions/CampaignInterruptions.js";
import { MapSheet } from "./MapSheet.js";
import { ScreenHeaderProvider } from "./screen-header.js";
import {
  PreTurnReviewState,
  ShellFrame,
  ShellGuidedInspection,
  ShellPreTurnReview,
  ShellResolution,
  ShellWindow,
} from "./shell-sections.js";
import { useTheme } from "./ThemeContext.js";

declare global {
  interface Window {
    bluewave?: BluewaveDesktopBridge;
  }
}

function CampaignShellApplication({
  bridge,
  initialWindowState,
}: {
  readonly bridge: BluewaveDesktopBridge | undefined;
  readonly initialWindowState?: WindowState | undefined;
}) {
  const { resolvedTheme } = useTheme();
  const { background } = useBackground();

  return (
    <ShellWindow bridge={bridge} initialWindowState={initialWindowState}>
      <PreTurnReviewState>
        <ScreenHeaderProvider>
          <BackgroundLayer background={background} resolvedTheme={resolvedTheme} />
          <ShellFrame />
          <MapSheet />
          <ShellResolution />
          <ShellPreTurnReview />
          <CampaignInterruptions />
          <ShellGuidedInspection />
        </ScreenHeaderProvider>
      </PreTurnReviewState>
    </ShellWindow>
  );
}

function CampaignWorldMap({ children }: { readonly children: ReactNode }) {
  const { campaign } = useCampaignShellState();
  return (
    <SharedWorldMapProvider key={campaign?.sessionId ?? "no-campaign"}>
      {children}
    </SharedWorldMapProvider>
  );
}

export function App({
  bridge = window.bluewave,
  initialWindowState,
}: {
  readonly bridge?: BluewaveDesktopBridge | undefined;
  readonly initialWindowState?: WindowState | undefined;
} = {}) {
  return (
    <BridgeProvider bridge={bridge}>
      <PresentationContentGate>
        <UiCatalogueGate>
          <CampaignShellProvider bridge={bridge}>
            <CampaignWorldMap>
              <FleetFocusProvider>
                <CampaignShellApplication bridge={bridge} initialWindowState={initialWindowState} />
              </FleetFocusProvider>
            </CampaignWorldMap>
          </CampaignShellProvider>
        </UiCatalogueGate>
      </PresentationContentGate>
    </BridgeProvider>
  );
}
