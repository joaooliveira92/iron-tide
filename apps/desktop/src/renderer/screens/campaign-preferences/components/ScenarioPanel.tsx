import { memo } from "react";
import { Copy, Fingerprint, Globe } from "lucide-react";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import { Badge } from "../../../components/ui/badge.js";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Separator } from "../../../components/ui/separator.js";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../../../components/ui/hover-card.js";
import { formatDate } from "../utils/format.js";
import type { CampaignConfigDisplay } from "../types.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";

export interface ScenarioPanelProps {
  readonly sessionId: string;
  readonly projection: PlayerProjection;
  readonly difficulty: CampaignConfigDisplay["difficulty"];
  readonly copied: boolean;
  readonly onCopyId: () => void;
}

export const ScenarioPanel = memo(function ScenarioPanel({
  sessionId,
  projection,
  difficulty,
  copied,
  onCopyId,
}: ScenarioPanelProps) {
  return (
    <GlassCard>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5 text-sm font-medium">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Scenario
        </CardTitle>
        <CardDescription>
          Session <span className="font-mono">{sessionId.slice(0, 16)}&hellip;</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="space-y-1">
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">
              Current Date
            </p>
            <p className="font-mono text-sm font-medium">{formatDate(projection.month)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">
              Turn / Revision
            </p>
            <p className="font-mono text-sm font-medium">
              Turn {Number(projection.revision) + 1} &middot; r{String(projection.revision)}
            </p>
          </div>
          <div className="space-y-1 col-span-2">
            <p className="text-[12px] uppercase tracking-wider text-muted-foreground">
              Campaign ID
            </p>
            <div className="flex items-center gap-1.5">
              <p className="font-mono text-xs text-muted-foreground">
                {projection.campaignIdentity.slice(0, 24)}&hellip;
              </p>
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
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider text-muted-foreground">
            Difficulty
          </span>
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
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider text-muted-foreground">
            Snapshot
          </span>
          <Badge variant="outline" className="font-mono text-[12px]">
            <Fingerprint className="mr-1 h-2.5 w-2.5" />
            {projection.snapshotHash.slice(0, 12)}
          </Badge>
        </div>
      </CardContent>
    </GlassCard>
  );
});
