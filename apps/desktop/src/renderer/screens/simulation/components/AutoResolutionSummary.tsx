import type { BattleResolution } from "@bluewave/campaign-engine";
import { Award } from "lucide-react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion.js";
import { Badge } from "../../../components/ui/badge.js";

interface AutoResolutionSummaryProps {
  readonly resolution: BattleResolution;
}

/** The auto-resolver's result: winner, war-score change, and per-ship outcomes. */
export function AutoResolutionSummary({ resolution }: AutoResolutionSummaryProps) {
  return (
    <AccordionItem value="auto">
      <AccordionTrigger>
        <span className="flex items-center gap-1.5 font-semibold text-success">
          <Award className="h-3.5 w-3.5" />
          Auto-Resolution Completed
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2 rounded-md border border-success/30 bg-success/5 p-3 font-mono text-xs">
          <div className="flex items-center justify-between border-b pb-1">
            <span className="font-semibold">
              WINNER: {resolution.missionOutcome.winner ?? "INCONCLUSIVE"}
            </span>
            <Badge variant="outline" className="text-[12px]">
              {resolution.missionOutcome.outcomeKind}
            </Badge>
          </div>
          <div className="text-[11px]">
            War Score Change:{" "}
            <span className="font-semibold text-foreground">{resolution.warScoreChange}</span>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-muted-foreground">SHIP OUTCOMES:</div>
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div>
              <span className="font-semibold text-muted-foreground">ATTACKER SHIPS:</span>
              {resolution.attacker.ships.map((s, idx) => (
                <div key={idx} className="flex justify-between border-b py-0.5 last:border-0">
                  <span>{s.shipId}</span>
                  <span className="font-semibold text-foreground">{s.outcome}</span>
                </div>
              ))}
            </div>
            <div>
              <span className="font-semibold text-muted-foreground">DEFENDER SHIPS:</span>
              {resolution.defender.ships.map((s, idx) => (
                <div key={idx} className="flex justify-between border-b py-0.5 last:border-0">
                  <span>{s.shipId}</span>
                  <span className="font-semibold text-foreground">{s.outcome}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
