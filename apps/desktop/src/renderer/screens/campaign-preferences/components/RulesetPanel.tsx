import { memo } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { SettingsRow, SettingsSection } from "../../../components/shared/SettingsModal.js";
import type { CampaignConfigDisplay } from "../types.js";

export interface RulesetPanelProps {
  readonly config: CampaignConfigDisplay;
}

export const RulesetPanel = memo(function RulesetPanel({ config }: RulesetPanelProps) {
  const entries: ReadonlyArray<readonly [string, string]> = [
    ["Continuity mode", config.continuityMode],
    ["Fleet size", config.fleetSize],
    ["Research speed", config.researchSpeed],
    ["Tech variation", config.technologyVariation],
    ["Historical budget", config.historicalBudget],
    ["Legacy fleet", config.legacyFleetMode],
    ["Tactical realism", config.tacticalRealism],
  ];

  return (
    <SettingsSection
      title="Ruleset options"
      description="Set at campaign creation and read-only during play."
    >
      {entries.map(([label, value]) => (
        <SettingsRow
          key={label}
          title={label}
          control={
            <Badge variant="outline" className="font-mono text-[13px]">
              {value}
            </Badge>
          }
        />
      ))}
    </SettingsSection>
  );
});
