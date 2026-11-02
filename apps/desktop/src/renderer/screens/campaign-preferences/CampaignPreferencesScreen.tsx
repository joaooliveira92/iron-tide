import { useCallback, useState, type ReactNode } from "react";
import { AlertTriangle, Eye, Globe, Settings2, SlidersHorizontal } from "lucide-react";
import { useBridge } from "../../lib/bridge-context.js";
import { useCampaignProjection } from "../../lib/use-campaign-projection.js";
import { Button } from "../../components/ui/button.js";
import { PageHeader } from "../../components/shared/PageHeader.js";
import {
  SettingsModal,
  SettingsRow,
  SettingsSection,
  type SettingsNavItem,
} from "../../components/shared/SettingsModal.js";
import { PreferencesLoadingState } from "./components/PreferencesLoadingState.js";
import { PreferencesErrorState } from "./components/PreferencesErrorState.js";
import { ScenarioPanel } from "./components/ScenarioPanel.js";
import { RulesetPanel } from "./components/RulesetPanel.js";
import { DisplayPreferencesPanel } from "./components/DisplayPreferencesPanel.js";
import { DangerZonePanel } from "./components/DangerZonePanel.js";
import { CloseCampaignDialog } from "./components/CloseCampaignDialog.js";
import { useDisplayPreferences } from "./hooks/useDisplayPreferences.js";
import { useClipboardCopy } from "./hooks/useClipboardCopy.js";
import { inferConfig } from "./utils/infer-config.js";
import { downloadCampaignConfig } from "./utils/export-campaign-config.js";

type PreferencesSectionId = "scenario" | "ruleset" | "display" | "danger";

const SECTIONS: readonly SettingsNavItem<PreferencesSectionId>[] = [
  {
    id: "scenario",
    label: "Scenario",
    summary: "The campaign's date, turn, difficulty and snapshot.",
    icon: Globe,
  },
  {
    id: "ruleset",
    label: "Ruleset options",
    summary: "Set at campaign creation and read-only during play.",
    icon: SlidersHorizontal,
  },
  {
    id: "display",
    label: "Display preferences",
    summary: "Local settings for how information is presented.",
    icon: Eye,
  },
  {
    id: "danger",
    label: "Danger zone",
    summary: "Irreversible actions that affect the campaign.",
    icon: AlertTriangle,
  },
];

export interface CampaignPreferencesScreenProps {
  readonly sessionId: string;
  readonly onCloseCampaign?: () => void;
  readonly onClose?: () => void;
}

export function CampaignPreferencesScreen({
  sessionId,
  onCloseCampaign,
  onClose,
}: CampaignPreferencesScreenProps) {
  const { projection, loadError, reload } = useCampaignProjection(sessionId);
  const { displayPrefs, togglePref } = useDisplayPreferences(sessionId);
  const { copied, copy } = useClipboardCopy();
  const [restartMessage, setRestartMessage] = useState<string | null>(null);
  const bridge = useBridge();
  const [open, setOpen] = useState(true);
  const [section, setSection] = useState<PreferencesSectionId>("scenario");
  const [confirmClose, setConfirmClose] = useState(false);

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
    const result = await bridge.campaign.execute("writeUiState", {
      sessionId,
      firstMonthInspection: { status: "not_started", lastCompletedStep: 0 },
    });
    if (result.outcome === "success") {
      setRestartMessage("Guided inspection will reappear on next navigation.");
    } else {
      setRestartMessage(`Restart failed: ${result.reason}`);
    }
  }, [bridge, sessionId]);

  if (loadError !== null) {
    return <PreferencesErrorState message={loadError} onRetry={reload} />;
  }

  if (projection === null) {
    return <PreferencesLoadingState />;
  }

  const config = inferConfig(projection);

  const panels: Readonly<Record<PreferencesSectionId, ReactNode>> = {
    scenario: (
      <ScenarioPanel
        sessionId={sessionId}
        projection={projection}
        difficulty={config.difficulty}
        copied={copied}
        onCopyId={handleCopyId}
      />
    ),
    ruleset: <RulesetPanel config={config} />,
    display: (
      <>
        <DisplayPreferencesPanel displayPrefs={displayPrefs} onTogglePref={togglePref} />
        <SettingsSection title="Guided inspection">
          <SettingsRow
            title="First-month tour"
            description="Restart the first-month guided tour for this campaign."
            control={
              <Button
                variant="outline"
                size="sm"
                data-testid="restart-guided-inspection"
                onClick={() => void handleRestartInspection()}
              >
                Restart guided inspection
              </Button>
            }
          >
            {restartMessage !== null && (
              <p className="text-xs text-muted-foreground">{restartMessage}</p>
            )}
          </SettingsRow>
        </SettingsSection>
      </>
    ),
    danger: (
      <DangerZonePanel
        onExportConfig={handleExportConfig}
        onReloadSnapshot={reload}
        onCloseCampaign={
          onCloseCampaign === undefined
            ? undefined
            : () => {
                setOpen(false);
                setConfirmClose(true);
              }
        }
      />
    ),
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Settings2}
        title="Campaign Preferences"
        description="View configuration, adjust display settings, and manage your campaign."
      />
      {!open && !confirmClose && (
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Open campaign preferences
        </Button>
      )}
      <SettingsModal
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          setOpen(false);
          onClose?.();
        }}
        title="Campaign preferences"
        navLabel="Campaign preference sections"
        items={SECTIONS}
        activeId={section}
        onSelect={setSection}
        testId="campaign-preferences-modal"
      >
        {panels[section]}
      </SettingsModal>
      {onCloseCampaign !== undefined && (
        <CloseCampaignDialog
          open={confirmClose}
          onOpenChange={setConfirmClose}
          onCloseCampaign={onCloseCampaign}
        />
      )}
    </div>
  );
}
