import { memo } from "react";
import { Copy, Fingerprint } from "lucide-react";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import { Badge } from "../../../components/ui/badge.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";
import { formatDate } from "../utils/format.js";
import type { CampaignConfigDisplay } from "../types.js";

export interface ScenarioPanelProps {
  readonly sessionId: string;
  readonly projection: PlayerProjection;
  readonly difficulty: CampaignConfigDisplay["difficulty"];
  readonly copied: boolean;
  readonly onCopyId: () => void;
}

const mono = (text: string) => <span className="font-mono text-sm">{text}</span>;

export const ScenarioPanel = memo(function ScenarioPanel({
  sessionId,
  projection,
  difficulty,
  copied,
  onCopyId,
}: ScenarioPanelProps) {
  return (
    <SettingsSection title="Session" description={`Session ${sessionId.slice(0, 16)}…`}>
      <SettingsRow title="Current date" control={mono(formatDate(projection.month))} />
      <SettingsRow
        title="Turn / revision"
        control={mono(`Turn ${Number(projection.revision) + 1} · r${String(projection.revision)}`)}
      />
      <SettingsRow
        title="Campaign ID"
        control={
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">
              {projection.campaignIdentity.slice(0, 24)}&hellip;
            </span>
            <HoverCard>
              <HoverCardTrigger
                render={
                  <button
                    type="button"
                    aria-label={copied ? "Copied" : "Copy campaign ID"}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:text-foreground"
                  />
                }
                onClick={onCopyId}
              >
                <Copy className="h-3 w-3" />
              </HoverCardTrigger>
              <HoverCardContent side="top" variant="tip">
                <p className="text-[12px]">{copied ? "Copied!" : "Copy full ID"}</p>
              </HoverCardContent>
            </HoverCard>
          </div>
        }
      />
      <SettingsRow
        title="Difficulty"
        control={
          <Badge
            variant={
              difficulty === "Hard"
                ? "destructive"
                : difficulty === "Easy"
                  ? "default"
                  : "secondary"
            }
            className="text-[12px]"
          >
            {difficulty}
          </Badge>
        }
      />
      <SettingsRow
        title="Snapshot"
        control={
          <Badge variant="outline" className="font-mono text-[12px]">
            <Fingerprint className="mr-1 h-2.5 w-2.5" />
            {projection.snapshotHash.slice(0, 12)}
          </Badge>
        }
      />
    </SettingsSection>
  );
});
