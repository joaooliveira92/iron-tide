import { Anchor } from "lucide-react";
import { GlassSectionCard } from "../../../components/shared/GlassSectionCard.js";
import type { DiplomacyBlockadeRow } from "../diplomacy-view-model.js";

export function BlockadesSection({ rows }: { readonly rows: readonly DiplomacyBlockadeRow[] }) {
  return (
    <GlassSectionCard
      icon={<Anchor className="h-4 w-4 text-muted-foreground" />}
      title="Blockades"
      description="Blockade coverage involving your nation, per strategic area."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No blockades yet</p>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <div
              key={row.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <span className="text-sm">
                {row.blockaderName} → {row.blockadedName}
              </span>
              <span className="text-xs text-muted-foreground">
                in {row.areaLabel} · since {row.establishedMonth}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassSectionCard>
  );
}
