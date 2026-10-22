import type { ReactNode } from "react";

import { advanceMonth } from "@bluewave/campaign";
import type { StrategicPriority } from "@bluewave/campaign-engine";

import { Button } from "./ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.js";
import { Badge } from "./ui/badge.js";
import { SEVERITY_VARIANT } from "../lib/priorities.js";
import { usePresentationFormat } from "../shell/usePresentationFormat.js";
import { formatMonth, formatOptional } from "./preTurnReviewFormat.js";
import { usePreTurnReviewData, type PreTurnReviewData } from "./usePreTurnReviewData.js";

export interface PreTurnReviewCampaign {
  readonly month: { readonly year: number; readonly month: number };
  readonly treasury: number;
  readonly projectedSurplusDeficit: number;
}

export interface PreTurnReviewDialogViewProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly campaign: PreTurnReviewCampaign;
  readonly data: PreTurnReviewData;
  readonly saving: boolean;
  readonly saveMessage: string | null;
  readonly committing: boolean;
  readonly onAdvance: () => Promise<void>;
}

interface ReviewStat {
  readonly label: string;
  readonly value: ReactNode;
}

function ReviewStatGrid({ stats }: { readonly stats: readonly ReviewStat[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((stat) => (
        <div key={stat.label}>
          <p className="text-xs text-muted-foreground">{stat.label}</p>
          <p className="font-medium">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

const MAX_SHOWN_WARNINGS = 5;

function UnresolvedWarnings({ priorities }: { readonly priorities: readonly StrategicPriority[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Unresolved warnings</p>
      {priorities.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          The Admiralty has identified no urgent concerns.
        </p>
      ) : (
        <div className="mt-1 space-y-1.5">
          {priorities.slice(0, MAX_SHOWN_WARNINGS).map((priority) => (
            <div
              key={priority.id}
              className="flex items-center justify-between rounded border px-2 py-1.5"
            >
              <div>
                <p className="text-xs font-medium">{priority.title}</p>
                <p className="text-xs text-muted-foreground">{priority.summary}</p>
              </div>
              <Badge variant={SEVERITY_VARIANT[priority.severity]}>{priority.severity}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ReviewFooterProps {
  readonly advanceLabel: string;
  readonly canAdvance: boolean;
  readonly committing: boolean;
  readonly onCancel: () => void;
  readonly onAdvance: () => Promise<void>;
}

function ReviewFooter({
  advanceLabel,
  canAdvance,
  committing,
  onCancel,
  onAdvance,
}: ReviewFooterProps) {
  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={committing}>
        Cancel
      </Button>
      <Button onClick={() => void onAdvance()} disabled={!canAdvance}>
        {committing ? "Advancing…" : advanceLabel}
      </Button>
    </DialogFooter>
  );
}

export function PreTurnReviewDialogView({
  open,
  onOpenChange,
  campaign,
  data,
  saving,
  saveMessage,
  committing,
  onAdvance,
}: PreTurnReviewDialogViewProps) {
  const { priorities, constructionCount, expectedCompletions, researchSpend, loading } = data;
  const format = usePresentationFormat();

  const nextMonth = advanceMonth(campaign.month.year, campaign.month.month, 1);
  const advanceLabel = `Advance to ${formatMonth(nextMonth)}`;
  const canAdvance = !committing && !saving;

  const stats: readonly ReviewStat[] = [
    { label: "Current date", value: formatMonth(campaign.month) },
    { label: "Next date", value: formatMonth(nextMonth) },
    { label: "Available funds", value: format.money(campaign.treasury) },
    {
      label: "Projected surplus / deficit",
      value: format.money(campaign.projectedSurplusDeficit),
    },
    {
      label: "Active construction projects",
      value: formatOptional(constructionCount, loading, format.count),
    },
    {
      label: "Expected completions",
      value: formatOptional(expectedCompletions, loading, format.count),
    },
    {
      label: "Current research spending",
      value: formatOptional(researchSpend, loading, format.money),
    },
    { label: "Save status", value: saving ? "Saving…" : (saveMessage ?? "Saved") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pre-turn review</DialogTitle>
          <DialogDescription>
            Review the current strategic state before advancing the campaign month. All figures are
            from real campaign state.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <ReviewStatGrid stats={stats} />
          <UnresolvedWarnings priorities={priorities} />
          {committing && (
            <p className="text-xs text-muted-foreground">
              Advancing… the commit is synchronous and cannot be cancelled mid-resolution.
            </p>
          )}
        </div>

        <ReviewFooter
          advanceLabel={advanceLabel}
          canAdvance={canAdvance}
          committing={committing}
          onCancel={() => onOpenChange(false)}
          onAdvance={onAdvance}
        />
      </DialogContent>
    </Dialog>
  );
}

export interface PreTurnReviewDialogProps extends Omit<PreTurnReviewDialogViewProps, "data"> {
  readonly sessionId: string;
}

export function PreTurnReviewDialog({ sessionId, open, ...viewProps }: PreTurnReviewDialogProps) {
  const data = usePreTurnReviewData(sessionId, open);
  return <PreTurnReviewDialogView open={open} data={data} {...viewProps} />;
}
