import { memo } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import type { CampaignConfigDisplay } from "../types.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";

export interface RulesetPanelProps {
  readonly config: CampaignConfigDisplay;
}

export const RulesetPanel = memo(function RulesetPanel({ config }: RulesetPanelProps) {
  const entries: ReadonlyArray<readonly [string, string]> = [
    ["Continuity Mode", config.continuityMode],
    ["Fleet Size", config.fleetSize],
    ["Research Speed", config.researchSpeed],
    ["Tech Variation", config.technologyVariation],
    ["Historical Budget", config.historicalBudget],
    ["Legacy Fleet", config.legacyFleetMode],
    ["Tactical Realism", config.tacticalRealism],
  ];

  return (
    <GlassCard>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-1.5  font-medium">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          Ruleset Options
        </CardTitle>
        <CardDescription>Set at campaign creation &mdash; read-only during play.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {entries.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2"
            >
              <span className="text-[13px] text-muted-foreground">{label}</span>
              <Badge variant="outline" className="ml-2 font-mono text-[13px]">
                {value}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </GlassCard>
  );
});
