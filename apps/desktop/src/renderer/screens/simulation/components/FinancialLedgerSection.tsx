import type { FinancialLedgerEntry } from "@bluewave/campaign-engine";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../../components/ui/accordion.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import { cn } from "../../../lib/utils.js";

interface FinancialLedgerSectionProps {
  readonly entries: readonly FinancialLedgerEntry[];
}

export function FinancialLedgerSection({ entries }: FinancialLedgerSectionProps) {
  return (
    <AccordionItem value="ledger">
      <AccordionTrigger className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Financial Ledger
      </AccordionTrigger>
      <AccordionContent>
        <ScrollArea className="h-[160px] rounded-md border bg-muted/20">
          <Table className="font-mono text-[11px]">
            <TableHeader>
              <TableRow className="h-8">
                <TableHead className="p-1">Phase</TableHead>
                <TableHead className="p-1">Description</TableHead>
                <TableHead className="p-1 text-right">Amount</TableHead>
                <TableHead className="p-1 text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry, idx) => (
                <TableRow key={idx} className="h-8">
                  <TableCell className="p-1 text-muted-foreground">{entry.phase}</TableCell>
                  <TableCell className="p-1">{entry.description}</TableCell>
                  <TableCell
                    className={cn(
                      "p-1 text-right font-semibold",
                      entry.amount < 0 ? "text-destructive" : "text-success",
                    )}
                  >
                    {entry.amount}
                  </TableCell>
                  <TableCell className="p-1 text-right font-semibold">
                    {entry.runningBalance}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </AccordionContent>
    </AccordionItem>
  );
}
