import { X } from "lucide-react";

import { Button } from "../../../components/ui/button.js";
import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { Item, ItemActions, ItemContent } from "../../../components/ui/item.js";
import type { RecentCampaignEntry } from "../../../../shared/continuity-contract.js";
import { campaignFileName } from "../utils/campaign-file-name.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";
import { Tip } from "../../../components/ui/tip.js";

interface RecentCampaignsProps {
  readonly files: readonly RecentCampaignEntry[];
  readonly disabled: boolean;
  readonly onOpen: (file: RecentCampaignEntry) => void;
  readonly onRemove: (packagePath: string) => void;
}

export function RecentCampaigns({ files, disabled, onOpen, onRemove }: RecentCampaignsProps) {
  if (files.length === 0) return null;

  return (
    <GlassCard glassVariant="liquid-refract">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent Campaigns</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {files.map((file) => (
          <Item key={file.packagePath}>
            <ItemContent>
              <Tip label={file.packagePath}>
                <button
                  className="cursor-pointer truncate text-left font-mono text-xs font-semibold text-foreground hover:text-primary"
                  onClick={() => onOpen(file)}

                  disabled={disabled || !file.available}
                >
                  {campaignFileName(file.packagePath)}
                </button>
              </Tip>
              {file.available ? null : (
                <p className="text-[12px] text-destructive">
                  Package not found — it may have been moved or deleted.
                </p>
              )}
            </ItemContent>
            <ItemActions>
              <span className="text-[12px] text-muted-foreground">Rev {file.activeRevision}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(file.packagePath)}
                aria-label={`Remove ${campaignFileName(file.packagePath)} from recent`}
              >
                <X />
              </Button>
            </ItemActions>
          </Item>
        ))}
      </CardContent>
    </GlassCard>
  );
}
