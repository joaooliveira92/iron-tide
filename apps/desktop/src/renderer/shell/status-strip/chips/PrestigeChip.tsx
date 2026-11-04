import { Crown } from "lucide-react";

import { cn } from "../../../lib/utils.js";
import type { StatusStripModel } from "../../status-strip-state.js";
import { PrestigeCard } from "../cards/PrestigeCard.js";
import { rowById } from "../rows.js";
import { PinnableCard } from "../StripCard.js";
import { CHIP } from "../strip-styles.js";

export function PrestigeChip({ model }: { readonly model: StatusStripModel }) {
  const row = rowById(model.nation, "prestige");
  if (row === undefined) return null;
  const { prestige } = model;
  return (
    <PinnableCard
      trigger={<button type="button" />}
      variant="button"
      triggerProps={{ "aria-label": `Prestige ${row.value}` }}
      triggerClassName={cn(
        CHIP,
        "cursor-help",
        prestige.atRisk && "border-destructive/40 bg-destructive/10",
      )}
      card={
        <PrestigeCard gauge={prestige} note={row.note} explanation={model.prestigeExplanation} />
      }
    >
      <Crown
        className={cn("size-3.5", prestige.atRisk ? "text-destructive" : "text-admiralty-accent")}
        aria-hidden="true"
      />
      <span className="text-muted-foreground">Prestige</span>
      <span className="font-display tabular-nums font-semibold">{row.value}</span>
    </PinnableCard>
  );
}
