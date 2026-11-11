import type {
  DiplomacyPeaceOffer,
  DiplomacyPeaceTerm,
  DiplomacyPeaceTermRef,
} from "@bluewave/campaign-engine";
import { Handshake } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog.js";
import { RadioGroup, RadioGroupItem } from "../../../components/ui/radio-group.js";
import { cn } from "../../../lib/utils.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { capitalizeFirst } from "../diplomacy-presentation.js";

export interface PeaceTermsDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly enemyName: string;
  readonly offer: DiplomacyPeaceOffer;
  readonly onConfirm: (term: DiplomacyPeaceTermRef) => void;
}

const AREA = "diplomacy";

export function peaceTermKey(term: DiplomacyPeaceTermRef): string {
  return term._tag === "CedeArea" ? `CedeArea:${term.areaId}` : "StatusQuo";
}

function TermOption({
  term,
  enemyName,
}: {
  readonly term: DiplomacyPeaceTerm;
  readonly enemyName: string;
}) {
  const format = usePresentationFormat();
  const key = peaceTermKey(term.term);
  const cost = Number(term.costExplanation.result);
  const remaining = Number(term.remainingExplanation.result);
  const reasonId = `peace-term-reason-${key}`;
  return (
    <div className="space-y-1.5 rounded-lg border bg-card p-3" data-testid={`peace-term-${key}`}>
      <RadioGroupItem
        value={key}
        disabled={!term.affordable}
        aria-describedby={term.affordable ? undefined : reasonId}
        className="flex w-full items-center justify-between gap-3 border-0 bg-transparent p-1 text-left data-checked:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">
            {term.term._tag === "CedeArea"
              ? `${enemyName} cedes ${term.label}`
              : "Keep the borders as they are"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {term.term._tag === "CedeArea" ? "The whole area changes hands." : "No area moves."}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-sm tabular-nums">
          {term.provisional && <Badge variant="outline">Provisional</Badge>}
          <span data-testid={`peace-term-cost-${key}`}>Cost {format.count(cost)}</span>
          <span
            className={cn("text-muted-foreground", remaining < 0 && "text-destructive")}
            data-testid={`peace-term-left-${key}`}
          >
            Left {format.count(remaining)}
          </span>
        </span>
      </RadioGroupItem>
      {!term.affordable && (
        <p id={reasonId} className="px-1 text-xs text-destructive">
          Costs {format.count(-remaining)} more war score than you have.
        </p>
      )}
      <div className="space-y-0.5 px-1">
        <ExplanationDisclosure
          tree={term.costExplanation}
          area={AREA}
          summaryKey="diplomacy.peace_cost.summary"
          format={format}
          testId={`peace-cost-explanation-${key}`}
        />
        <ExplanationDisclosure
          tree={term.remainingExplanation}
          area={AREA}
          summaryKey="diplomacy.peace_remaining.summary"
          format={format}
          testId={`peace-remaining-explanation-${key}`}
        />
      </div>
    </div>
  );
}

export function PeaceTermsDialog({
  open,
  onOpenChange,
  enemyName,
  offer,
  onConfirm,
}: PeaceTermsDialogProps) {
  const format = usePresentationFormat();
  const [selected, setSelected] = useState("StatusQuo");
  const headingId = useId();
  useEffect(() => {
    if (open) setSelected("StatusQuo");
  }, [open]);
  const chosen = offer.terms.find((t) => peaceTermKey(t.term) === selected && t.affordable);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Handshake aria-hidden="true" className="mr-2 inline size-4" />
            Peace terms with {capitalizeFirst(enemyName)}
          </DialogTitle>
          <DialogDescription>
            Choose what you ask for, within your war score. Confirming queues the terms as an order;
            they take effect when you advance the month.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm">
                War score to spend{" "}
                <span className="font-semibold tabular-nums" data-testid="peace-budget">
                  {format.count(Number(offer.budgetExplanation.result))}
                </span>
              </p>
              <ExplanationDisclosure
                tree={offer.budgetExplanation}
                area={AREA}
                summaryKey="diplomacy.peace_budget.summary"
                format={format}
                testId="peace-budget-explanation"
              />
            </div>
            <p id={headingId} className="text-xs font-medium uppercase text-muted-foreground">
              Terms
            </p>
            <RadioGroup
              aria-labelledby={headingId}
              value={selected}
              onValueChange={(value) => setSelected(value as string)}
              className="gap-2"
            >
              {offer.terms.map((term) => (
                <TermOption key={peaceTermKey(term.term)} term={term} enemyName={enemyName} />
              ))}
            </RadioGroup>
            {offer.terms.length === 1 && (
              <p className="text-xs text-muted-foreground" data-testid="peace-no-cessions">
                No enemy area can be demanded yet: none is priced for cession, or only their home
                area is left.
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={chosen === undefined}
            onClick={() => {
              if (chosen === undefined) return;
              onConfirm(chosen.term);
              onOpenChange(false);
            }}
          >
            Queue peace terms
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
