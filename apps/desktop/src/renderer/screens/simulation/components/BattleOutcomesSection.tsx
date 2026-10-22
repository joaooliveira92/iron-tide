import type { BattleOutcome } from "@bluewave/campaign-engine";
import { Crosshair } from "lucide-react";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import { BattleOutcomeRow } from "./BattleOutcomeRow.js";

interface BattleOutcomesSectionProps {
  readonly outcomes: readonly BattleOutcome[];
}

export function BattleOutcomesSection({ outcomes }: BattleOutcomesSectionProps) {
  return (
    <AccordionItem value="battle-outcomes">
      <AccordionTrigger className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Battle Outcomes
      </AccordionTrigger>
      <AccordionContent>
        {outcomes.length === 0 ? (
          <Empty>
            <EmptyIcon>
              <Crosshair />
            </EmptyIcon>
            <EmptyTitle>No battles resolved this month.</EmptyTitle>
            <EmptyDescription>
              No war-triggered battle reached a resolution during this turn's execution.
            </EmptyDescription>
          </Empty>
        ) : (
          <ScrollArea className="h-[220px] rounded-md border bg-muted/20">
            <div className="space-y-2 p-2">
              {outcomes.map((battle) => (
                <BattleOutcomeRow key={battle.battleId} battle={battle} />
              ))}
            </div>
          </ScrollArea>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
