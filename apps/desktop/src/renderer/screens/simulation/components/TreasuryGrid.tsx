import type { MonthReport } from "@bluewave/campaign-engine";

import { Item, ItemDescription } from "../../../components/ui/item.js";
import { cn } from "../../../lib/utils.js";

interface TreasuryGridProps {
  readonly report: MonthReport;
}

interface TreasuryCell {
  readonly label: string;
  readonly value: string;
  readonly valueClassName: string;
}

export function TreasuryGrid({ report }: TreasuryGridProps) {
  const cells: readonly TreasuryCell[] = [
    {
      label: "Opening Treasury",
      value: `${report.openingTreasury}`,
      valueClassName: "text-foreground",
    },
    {
      label: "Maintenance Cost",
      value: `-${report.maintenanceCost}`,
      valueClassName: "text-destructive",
    },
    {
      label: "Construction Spending",
      value: `-${report.newConstructionSpending}`,
      valueClassName: "text-warning",
    },
    {
      label: "Closing Treasury",
      value: `${report.closingTreasury}`,
      valueClassName: "text-success",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cells.map((cell) => (
        <Item key={cell.label} className="flex-col items-start gap-0.5 bg-muted/40">
          <ItemDescription className="uppercase tracking-wider">{cell.label}</ItemDescription>
          <span className={cn("font-mono text-sm font-semibold", cell.valueClassName)}>
            {cell.value}
          </span>
        </Item>
      ))}
    </div>
  );
}
