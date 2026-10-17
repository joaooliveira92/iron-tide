import { useState } from "react";

import { Button } from "../../components/ui/button.js";
import { OptionsScreen } from "../options/OptionsScreen.js";
import { CampaignActions } from "./components/CampaignActions.js";
import { CampaignFileHeader } from "./components/CampaignFileHeader.js";
import { OperationStatus } from "./components/OperationStatus.js";
import { PackageOperations } from "./components/PackageOperations.js";
import { RecentCampaigns } from "./components/RecentCampaigns.js";
import { useCampaignFiles } from "./hooks/useCampaignFiles.js";

export interface CampaignFileScreenProps {
  readonly onOpenCampaign: (sessionId: string) => void;
  readonly onStartNewGame: () => void;
}

export function CampaignFileScreen({ onOpenCampaign, onStartNewGame }: CampaignFileScreenProps) {
  const {
    recentFiles,
    result,
    pendingOperation,
    pendingLabel,
    openCampaign,
    openRecentCampaign,
    removeRecentCampaign,
    runPackageOperation,
    dismissResult,
  } = useCampaignFiles({ onOpenCampaign });
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <CampaignFileHeader />
      <CampaignActions
        disabled={pendingLabel !== null}
        onOpenCampaign={openCampaign}
        onStartNewGame={onStartNewGame}
      />
      {/* Options is reachable from the main menu, before any campaign is open (U-4). */}
      <Button type="button" variant="outline" onClick={() => setShowOptions((open) => !open)}>
        Options
      </Button>
      {showOptions ? <OptionsScreen /> : null}
      <RecentCampaigns
        files={recentFiles}
        disabled={pendingLabel !== null}
        onOpen={openRecentCampaign}
        onRemove={removeRecentCampaign}
      />
      <PackageOperations pendingOperation={pendingOperation} onRun={runPackageOperation} />
      <OperationStatus pendingLabel={pendingLabel} result={result} onDismiss={dismissResult} />
    </div>
  );
}
