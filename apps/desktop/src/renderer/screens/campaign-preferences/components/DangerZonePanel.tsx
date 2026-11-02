import { memo } from "react";
import { Download, RefreshCw, RotateCcw, Save, SwitchCamera } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";

export interface DangerZonePanelProps {
  readonly onExportConfig: () => void;
  readonly onReloadSnapshot: () => void;
  readonly onCloseCampaign?: (() => void) | undefined;
}

export const DangerZonePanel = memo(function DangerZonePanel({
  onExportConfig,
  onReloadSnapshot,
  onCloseCampaign,
}: DangerZonePanelProps) {
  return (
    <SettingsSection
      title="Campaign actions"
      description="Irreversible actions that affect the campaign."
    >
      <SettingsRow
        title="Export config"
        description="Download this campaign's configuration."
        control={
          <Button variant="outline" size="sm" onClick={onExportConfig}>
            <Download className="h-3.5 w-3.5" />
            Export Config
          </Button>
        }
      />
      <SettingsRow
        title="Reload snapshot"
        description="Read the campaign state again from the engine."
        control={
          <Button variant="outline" size="sm" onClick={onReloadSnapshot}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reload Snapshot
          </Button>
        }
      />
      <SettingsRow
        title="Revert to autosave"
        description="Not available yet."
        control={
          <Button variant="outline" size="sm" disabled>
            <RotateCcw className="h-3.5 w-3.5" />
            Revert to Autosave
          </Button>
        }
      />
      <SettingsRow
        title="Create checkpoint"
        description="Not available yet."
        control={
          <Button variant="outline" size="sm" disabled>
            <Save className="h-3.5 w-3.5" />
            Create Checkpoint
          </Button>
        }
      />
      {onCloseCampaign !== undefined && (
        <SettingsRow
          title="Close campaign"
          description="Return to the campaign file screen. Unsaved progress may be lost."
          control={
            <Button variant="destructive" size="sm" onClick={onCloseCampaign}>
              <SwitchCamera className="h-3.5 w-3.5" />
              Close Campaign
            </Button>
          }
        />
      )}
    </SettingsSection>
  );
});
