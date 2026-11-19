import type { LucideIcon } from "lucide-react";
import { GlassCard } from "../../../../components/ui/glass-card.js";
import { Table, TableBody, TableCell, TableRow } from "../../../../components/ui/table.js";
import type { SummaryRow } from "../../new-game-commissioning-review-screen-state.js";
import { summaryRowIcon } from "../commissioning-review-icons.js";
import { SectionBadge } from "./SectionBadge.js";

export function ReviewSection({
  title,
  ariaLabel,
  icon,
  note,
  rows,
}: {
  readonly title: string;
  readonly ariaLabel: string;
  readonly icon: LucideIcon;
  readonly note?: string | undefined;
  readonly rows: readonly SummaryRow[];
}) {
  return (
    <GlassCard glassVariant="liquid-refract">
      <section className="p-4">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <SectionBadge icon={icon} />
          <h2 className="text-sm font-semibold">{title}</h2>
          {note !== undefined && (
            <span className="ml-auto rounded-full border border-admiralty-accent/25 bg-admiralty-accent/[0.06] px-2.5 py-1 font-display text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {note}
            </span>
          )}
        </header>
        <Table aria-label={ariaLabel}>
          <TableBody>
            {rows.map((row) => {
              const RowIcon = summaryRowIcon(row.icon);
              return (
                <TableRow key={row.label}>
                  <TableCell className="w-2/5 font-medium text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <RowIcon
                        className="h-4 w-4 flex-none text-admiralty-accent/80"
                        aria-hidden="true"
                      />
                      {row.label}
                    </span>
                  </TableCell>
                  <TableCell>{row.value}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </GlassCard>
  );
}
