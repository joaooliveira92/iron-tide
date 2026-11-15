import { Play, RefreshCw, ShieldCheck, X, type LucideIcon } from "lucide-react";

import { Button } from "../../../components/ui/button.js";
import { CardContent, CardHeader, CardTitle } from "../../../components/ui/card.js";
import { Item, ItemActions, ItemContent } from "../../../components/ui/item.js";
import type { RecentCampaignEntry } from "../../../../shared/continuity-contract.js";
import type { OperationKind } from "../types.js";
import { campaignFileName } from "../utils/campaign-file-name.js";
import { GlassCard } from "@/components/ui/glass-card.jsx";
import { Tip } from "../../../components/ui/tip.js";

interface RecentCampaignsProps {
  readonly files: readonly RecentCampaignEntry[];
  readonly disabled: boolean;
  readonly onOpen: (file: RecentCampaignEntry) => void;
  readonly onRemove: (packagePath: string) => void;
  readonly onRunOperation: (kind: OperationKind, packagePath: string) => void;
}

const OPERATIONS: readonly {
  readonly kind: OperationKind;
  readonly label: string;
  readonly Icon: LucideIcon;
}[] = [
  { kind: "verify", label: "Verify", Icon: ShieldCheck },
  { kind: "recover", label: "Recover", Icon: RefreshCw },
  { kind: "replay", label: "Replay", Icon: Play },
];

export function RecentCampaigns({
  files,
  disabled,
  onOpen,
  onRemove,
  onRunOperation,
}: RecentCampaignsProps) {
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
              {file.available
                ? OPERATIONS.map(({ kind, label, Icon }) => (
                    <Button
                      key={kind}
                      variant="ghost"
                      size="icon"
                      disabled={disabled}
                      onClick={() => onRunOperation(kind, file.packagePath)}
                      aria-label={`${label} ${campaignFileName(file.packagePath)}`}
                    >
                      <Icon />
                    </Button>
                  ))
                : null}
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
