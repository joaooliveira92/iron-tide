import type { TacticalBattleOutcome } from "@bluewave/campaign-engine";
import { Info, Layers } from "lucide-react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion.js";
import { Progress } from "../../../components/ui/progress.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { TACTICAL_RESOLVER_MAX_TURNS } from "../tactical-resolver.js";

interface TacticalOutcomeSummaryProps {
  readonly outcome: TacticalBattleOutcome;
}

export function TacticalOutcomeSummary({ outcome }: TacticalOutcomeSummaryProps) {
  return (
    <AccordionItem value="tactical">
      <AccordionTrigger>
        <span className="flex items-center gap-1.5 font-semibold text-warning">
          <Layers className="h-3.5 w-3.5" />
          Tactical Turn-by-Turn Resolver Outcome
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2 rounded-md border border-warning/30 bg-warning/5 p-3 font-mono text-xs">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[12px] text-muted-foreground">
              <span>Turns resolved</span>
              <span>
                {outcome.turnsResolved} / {TACTICAL_RESOLVER_MAX_TURNS}
              </span>
            </div>
            <Progress value={(outcome.turnsResolved / TACTICAL_RESOLVER_MAX_TURNS) * 100} />
          </div>
          <div className="text-[11px]">
            End Condition:{" "}
            <span className="font-semibold text-foreground">{outcome.endCondition}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-destructive">
            <Info className="h-3.5 w-3.5" />
            Rejected Orders: {outcome.rejectedOrders.length} (ADMIRAL RULE TESTPASSED)
          </div>
          <div className="mt-2 text-[12px] font-semibold text-muted-foreground">
            TACTICAL EVENT LEDGER:
          </div>
          <ScrollArea className="h-[120px] rounded border bg-muted/40 p-1.5">
            <div className="space-y-1 text-[11px]">
              {outcome.battleEventLedger.events.map((evt, idx) => (
                <div key={idx} className="border-b pb-1 last:border-0">
                  [{evt.turn}] <span className="text-foreground">{evt.eventType}</span> —{" "}
                  {JSON.stringify(evt.data)}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
