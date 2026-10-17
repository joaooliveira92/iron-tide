import { useCallback, useState } from "react";
import { useBridge } from "../../lib/bridge-context.js";
import { FileText, Settings2 } from "lucide-react";
import { Button } from "../../components/ui/button.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.js";
import { PreferencesLoadingState } from "./components/PreferencesLoadingState.js";
import { PreferencesErrorState } from "./components/PreferencesErrorState.js";
import { ScenarioPanel } from "./components/ScenarioPanel.js";
import { RulesetPanel } from "./components/RulesetPanel.js";
import { DisplayPreferencesPanel } from "./components/DisplayPreferencesPanel.js";
import { DangerZonePanel } from "./components/DangerZonePanel.js";
import { useCampaignProjection } from "./hooks/useCampaignProjection.js";
import { useDisplayPreferences } from "./hooks/useDisplayPreferences.js";
import { useClipboardCopy } from "./hooks/useClipboardCopy.js";
import { inferConfig } from "./utils/infer-config.js";
import { downloadCampaignConfig } from "./utils/export-campaign-config.js";

export interface CampaignPreferencesScreenProps {
  readonly sessionId: string;
  readonly onCloseCampaign?: () => void;
}

export function CampaignPreferencesScreen({
  sessionId,
  onCloseCampaign,
}: CampaignPreferencesScreenProps) {
  const { projection, loadError, loadProjection } = useCampaignProjection(sessionId);
  const { displayPrefs, togglePref } = useDisplayPreferences(sessionId);
  const { copied, copy } = useClipboardCopy();
  const [restartMessage, setRestartMessage] = useState<string | null>(null);
  const bridge = useBridge();

  const handleCopyId = useCallback(() => {
    void copy(sessionId);
  }, [copy, sessionId]);

  const handleExportConfig = useCallback(() => {
    if (projection === null) return;
    downloadCampaignConfig(sessionId, projection);
  }, [projection, sessionId]);

  const handleRestartInspection = useCallback(async () => {
    if (bridge === undefined) {
      setRestartMessage("Bridge unavailable");
      return;
    }
    const read = await bridge.campaign.execute("readUiState", sessionId);
    const dismissed =
      read.outcome === "success" ? [...read.value.uiState.dismissedFingerprints] : [];
    const result = await bridge.campaign.execute("writeUiState", {
      sessionId,
      dismissedFingerprints: dismissed,
      firstMonthInspection: { status: "not_started", lastCompletedStep: 0 },
    });
    if (result.outcome === "success") {
      setRestartMessage("Guided inspection will reappear on next navigation.");
    } else {
      setRestartMessage(`Restart failed: ${result.reason}`);
    }
  }, [bridge, sessionId]);

  if (loadError !== null) {
    return <PreferencesErrorState message={loadError} onRetry={loadProjection} />;
  }

  if (projection === null) {
    return <PreferencesLoadingState />;
  }

  const config = inferConfig(projection);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings2}
        title="Campaign Preferences"
        description="View configuration, adjust display settings, and manage your campaign."
        actions={
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <FileText className="h-3 w-3" />
            Display settings are stored locally and won&apos;t affect other players.
          </div>
        }
      />

      <Tabs defaultValue="scenario">
        <TabsList>
          <TabsTrigger value="scenario">Scenario</TabsTrigger>
          <TabsTrigger value="ruleset">Ruleset Options</TabsTrigger>
          <TabsTrigger value="display">Display Preferences</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="scenario">
          <ScenarioPanel
            sessionId={sessionId}
            projection={projection}
            difficulty={config.difficulty}
            copied={copied}
            onCopyId={handleCopyId}
          />
        </TabsContent>

        <TabsContent value="ruleset">
          <RulesetPanel config={config} />
        </TabsContent>

        <TabsContent value="display">
          <DisplayPreferencesPanel displayPrefs={displayPrefs} onTogglePref={togglePref} />
          <div className="mt-6 rounded-lg border p-4 space-y-2">
            <h3 className="text-sm font-medium">Guided Inspection</h3>
            <p className="text-xs text-muted-foreground">
              Restart the first-month guided tour for this campaign.
            </p>
            <Button
              variant="outline"
              size="sm"
              data-testid="restart-guided-inspection"
              onClick={() => void handleRestartInspection()}
            >
              Restart guided inspection
            </Button>
            {restartMessage !== null && (
              <p className="text-xs text-muted-foreground">{restartMessage}</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="danger">
          <DangerZonePanel
            onExportConfig={handleExportConfig}
            onReloadSnapshot={loadProjection}
            onCloseCampaign={onCloseCampaign}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
