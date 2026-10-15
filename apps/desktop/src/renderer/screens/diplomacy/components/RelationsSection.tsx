import { Handshake } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { DeferredFeaturesPanel } from "../../../components/shared/DeferredFeaturesPanel.js";
import { GlassSectionCard } from "../../../components/shared/GlassSectionCard.js";
import { ACTION_LABELS, DEFERRED_INTEL_ITEMS } from "../diplomacy-presentation.js";
import type { DiplomacyActionKind } from "../diplomacy-screen-state.js";
import type { DiplomacyRelationRow } from "../diplomacy-view-model.js";

export interface RelationsSectionProps {
  readonly rows: readonly DiplomacyRelationRow[];
  readonly busy: boolean;
  readonly onRowAction: (partnerNationId: string, kind: DiplomacyActionKind) => void;
}

export function RelationsSection({ rows, busy, onRowAction }: RelationsSectionProps) {
  return (
    <GlassSectionCard
      icon={<Handshake className="h-4 w-4 text-muted-foreground" />}
      title="Relations"
      description="Every nation's relation, tension, NAP and start of the current stance."
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No relations recorded yet</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.partnerNationId} className="rounded-md border px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{row.partnerName}</span>
                  {row.isLikelyRival && <Badge variant="outline">Likely rival</Badge>}
                  <Badge variant="secondary">{row.relationLabel}</Badge>
                  {row.tensionBadge !== null && <Badge variant="outline">{row.tensionBadge}</Badge>}
                  <span className="text-xs text-muted-foreground">tension {row.tension}/10</span>
                  {row.nap && <Badge variant="outline">NAP</Badge>}
                  <span className="text-xs text-muted-foreground">since {row.since}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {row.actions.map((kind) => (
                    <Button
                      key={kind}
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => onRowAction(row.partnerNationId, kind)}
                    >
                      {ACTION_LABELS[kind]}
                    </Button>
                  ))}
                </div>
              </div>
              {row.highTension && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                  Relations with {row.partnerName} are {row.highTensionNote}; war is possible
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Commands are validated by the engine when submitted — a rejected command shows the engine's
        code, never a fabricated message.
      </p>
      <DeferredFeaturesPanel
        items={DEFERRED_INTEL_ITEMS}
        testId="intel-deferred"
        title="Intelligence — not yet modelled by the engine"
      />
    </GlassSectionCard>
  );
}
