import { SlidePanel } from "@/components/slide-panel/index.js";
import { CardContent, CardHeader } from "@/components/ui/card.js";
import { GlassCard } from "@/components/ui/glass-card.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import {
  CATEGORY_LABEL,
  ShipTypeDetails,
  ShipTypeFacts,
} from "../../../components/design-workspace/index.js";
import type { ReferenceDeckEntry } from "../reference-deck.js";

export function ReferenceDeckDetail({
  entry,
  onStart,
}: {
  readonly entry: ReferenceDeckEntry;
  readonly onStart: (starterId: string) => void;
}) {
  const d = entry.definition;
  const starter = entry.starter;
  const headingId = `reference-detail-heading-${d.id}`;
  return (
    <SlidePanel isOpen placement="inline" animateOnMount aria-labelledby={headingId}>
      <GlassCard glassVariant="liquid-refract">
        <CardHeader className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {CATEGORY_LABEL[d.category]}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
              {d.name} <span className="tabular-nums text-muted-foreground">({d.id})</span>
            </h2>
            {d.auxiliary && <Badge variant="outline">Auxiliary</Badge>}
            {entry.current && <Badge variant="secondary">Current design</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{d.recommendedUse}</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <ShipTypeFacts
            entry={entry}
            className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4"
          />
          <ShipTypeDetails entry={entry} className="space-y-1.5 text-sm" />
          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button
              disabled={!entry.startable}
              onClick={() => starter !== null && onStart(starter.id)}
            >
              {starter === null ? "No starter design yet" : `Start from ${starter.name}`}
            </Button>
            {starter !== null && !starter.legal && (
              <p className="text-xs text-muted-foreground">
                The starter design is not legal at the campaign date.
              </p>
            )}
          </div>
        </CardContent>
      </GlassCard>
    </SlidePanel>
  );
}
