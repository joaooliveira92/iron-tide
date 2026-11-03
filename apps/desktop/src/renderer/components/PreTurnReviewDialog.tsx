import { useState } from "react";
import { ChevronsRight, OctagonAlert } from "lucide-react";

import { advanceMonth } from "@bluewave/campaign";
import type { StrategicPriority } from "@bluewave/campaign-engine";

import { cn } from "../lib/utils.js";
import { usePresentationFormat } from "../shell/usePresentationFormat.js";
import { Button } from "./ui/button.js";
import { Dialog, DialogBody, DialogContent } from "./ui/dialog.js";
import { Slipways } from "./pre-turn-review/Slipways.js";
import { TransitHeader } from "./pre-turn-review/TransitHeader.js";
import { TreasuryLedger } from "./pre-turn-review/TreasuryLedger.js";
import { WatchList } from "./pre-turn-review/WatchList.js";
import { formatMonth } from "./preTurnReviewFormat.js";
import { reviewVerdict, type VerdictKind } from "./preTurnReviewModel.js";
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
  readonly onOpenPriority?: (priority: StrategicPriority) => void;
}

const ADVANCE_STYLE: Readonly<Record<VerdictKind, string>> = {
  clear:
    "bg-admiralty-accent text-admiralty-accent-foreground hover:bg-admiralty-accent/90 focus-visible:ring-admiralty-accent",
  caution:
    "bg-admiralty-accent text-admiralty-accent-foreground hover:bg-admiralty-accent/90 focus-visible:ring-admiralty-accent",
  hold: "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
};

function SaveLamp({
  saving,
  message,
}: {
  readonly saving: boolean;
  readonly message: string | null;
}) {
  const text = saving ? "Saving…" : (message ?? "Saved");
  return (
    <p role="status" className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          saving ? "animate-pulse bg-warning" : "bg-success",
        )}
      />
      <span className="truncate">{text}</span>
    </p>
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
  onOpenPriority,
}: PreTurnReviewDialogViewProps) {
  const format = usePresentationFormat();
  const nextMonth = advanceMonth(campaign.month.year, campaign.month.month, 1);
  const verdict = reviewVerdict(data.priorities, data.economy);
  const canAdvance = !committing && !saving;
  const [confirming, setConfirming] = useState(false);
  const holding = verdict.kind === "hold";
  const advanceLabel = `Advance to ${formatMonth(nextMonth)}`;

  const changeOpen = (next: boolean) => {
    if (!next) setConfirming(false);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent flush>
        <TransitHeader
          current={formatMonth(campaign.month)}
          next={formatMonth(nextMonth)}
          verdict={verdict}
        />

        <DialogBody className="grid content-start divide-border/70 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:divide-x">
          <TreasuryLedger
            economy={data.economy}
            loading={data.loading}
            fallbackTreasury={campaign.treasury}
            fallbackNet={campaign.projectedSurplusDeficit}
            format={format}
          />
          <div className="divide-y divide-border/70">
            <Slipways
              pipeline={data.pipeline}
              economy={data.economy}
              constructionCount={data.constructionCount}
              expectedCompletions={data.expectedCompletions}
              researchSpend={data.researchSpend}
              loading={data.loading}
              format={format}
            />
            <WatchList
              priorities={data.priorities}
              loading={data.loading}
              onOpen={onOpenPriority}
            />
          </div>
        </DialogBody>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-6 py-3">
          <div className="min-w-0">
            {confirming ? (
              <p
                role="alert"
                className="flex items-center gap-2 text-xs font-medium text-destructive"
              >
                <OctagonAlert aria-hidden="true" className="size-4 shrink-0" />
                {verdict.detail}. Advance regardless?
              </p>
            ) : (
              <SaveLamp saving={saving} message={saveMessage} />
            )}
            {committing && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Advancing… the commit is synchronous and cannot be cancelled mid-resolution.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => (confirming ? setConfirming(false) : changeOpen(false))}
              disabled={committing}
            >
              {confirming ? "Go back" : "Cancel"}
            </Button>
            <Button
              className={cn("min-w-44 font-display", ADVANCE_STYLE[verdict.kind])}
              onClick={() => {
                if (holding && !confirming) setConfirming(true);
                else void onAdvance();
              }}
              disabled={!canAdvance}
            >
              {committing ? (
                "Advancing…"
              ) : (
                <>
                  {confirming ? `${advanceLabel} anyway` : advanceLabel}
                  <ChevronsRight aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </footer>
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
