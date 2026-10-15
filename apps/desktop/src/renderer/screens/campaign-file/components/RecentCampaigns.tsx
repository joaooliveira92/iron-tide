import { X } from "lucide-react";

import { Button } from "../../../components/ui/button.js";
import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { Item, ItemActions, ItemContent } from "../../../components/ui/item.js";
import type { RecentFile } from "../types.js";
import { campaignFileName } from "../utils/recent-files.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";

interface RecentCampaignsProps {
  readonly files: readonly RecentFile[];
  readonly disabled: boolean;
  readonly onOpen: (file: RecentFile) => void;
  readonly onRemove: (path: string) => void;
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
          <Item key={file.path}>
            <ItemContent>
              <button
                className="cursor-pointer truncate text-left font-mono text-xs font-semibold text-foreground hover:text-primary"
                onClick={() => onOpen(file)}
                title={file.path}
                disabled={disabled}
              >
                {campaignFileName(file.path)}
              </button>
            </ItemContent>
            <ItemActions>
              <span className="text-[12px] text-muted-foreground">Rev {file.activeRevision}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemove(file.path)}
                aria-label="Remove from recent"
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
