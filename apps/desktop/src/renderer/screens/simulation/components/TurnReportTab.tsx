import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { CheckCircle2 } from "lucide-react";

import { Accordion } from "../../../components/ui/accordion.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { BattleOutcomesSection } from "./BattleOutcomesSection.js";
import { DomainEventsSection } from "./DomainEventsSection.js";
import { FinancialLedgerSection } from "./FinancialLedgerSection.js";
import { TreasuryGrid } from "./TreasuryGrid.js";

interface TurnReportTabProps {
  readonly commitResult: CommitMonthResponse | null;
}

export function TurnReportTab({ commitResult }: TurnReportTabProps) {
  if (commitResult === null) {
    return (
      <Empty>
        <EmptyIcon>
          <CheckCircle2 />
        </EmptyIcon>
        <EmptyTitle>No turn advanced yet</EmptyTitle>
        <EmptyDescription>
          Advance the turn to generate a report of the month's outcomes.
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <CheckCircle2 className="h-4 w-4" />
          Turn Advancement Report — Month {commitResult.report.month.month}/
          {commitResult.report.month.year}
        </CardTitle>
        <CardDescription className="text-xs">
          Review the economic allocations and administrative outcomes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <TreasuryGrid report={commitResult.report} />

        <Accordion multiple defaultValue={["events", "ledger", "battle-outcomes"]}>
          <DomainEventsSection events={commitResult.domainEvents} />
          <FinancialLedgerSection entries={commitResult.financialLedger} />
          <BattleOutcomesSection outcomes={commitResult.closingSnapshot.battleOutcomes} />
        </Accordion>
      </CardContent>
    </Card>
  );
}
