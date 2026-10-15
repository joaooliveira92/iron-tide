import { memo } from "react";
import { AlertTriangle, Download, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { CloseCampaignDialog } from "./CloseCampaignDialog.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";

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
    <GlassCard className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4" />
          Danger Zone
        </CardTitle>
        <CardDescription>Irreversible actions that affect the campaign.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onExportConfig}>
              <Download className="h-3.5 w-3.5" />
              Export Config
            </Button>
            <Button variant="outline" size="sm" onClick={onReloadSnapshot}>
              <RefreshCw className="h-3.5 w-3.5" />
              Reload Snapshot
            </Button>
            <Button variant="outline" size="sm" disabled>
              <RotateCcw className="h-3.5 w-3.5" />
              Revert to Autosave
            </Button>
            <Button variant="outline" size="sm" disabled>
              <Save className="h-3.5 w-3.5" />
              Create Checkpoint
            </Button>
          </div>
          {onCloseCampaign !== undefined && (
            <CloseCampaignDialog onCloseCampaign={onCloseCampaign} />
          )}
        </div>
      </CardContent>
    </GlassCard>
  );
});
