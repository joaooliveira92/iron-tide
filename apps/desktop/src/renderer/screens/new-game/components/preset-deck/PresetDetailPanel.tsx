import { Check } from "lucide-react";
import { memo, useMemo } from "react";
import { SlidePanel } from "@/components/slide-panel/index.js";
import { CardContent, CardHeader } from "@/components/ui/card.js";
import { GlassCard } from "@/components/ui/glass-card.js";
import { presetSettingRows } from "../../preset-detail-view.js";
import type { PresetDefinition } from "../../rules-of-the-naval-age-presets.js";

export interface PresetDetailPanelProps {
  /** The previewed preset. */
  readonly preset: PresetDefinition;
  /** Whether the previewed preset's bundle is the one currently applied. */
  readonly applied: boolean;
  /** Previewed and not yet applied: the step's primary action will apply it. */
  readonly pending: boolean;
}

/**
 * The detail pane's focused-preset slide panel: name, tagline and the six
 * engine settings the bundle fixes, with an Active state, or a note that the
 * step's primary action will apply it. The panel has no control of its own:
 * applying is Enter, a tap on the card, or the primary action. Keyed by
 * preset in the caller, so it eases in again each time focus moves.
 */
export const PresetDetailPanel = memo(function PresetDetailPanel({
  preset,
  applied,
  pending,
}: PresetDetailPanelProps) {
  const rows = useMemo(() => presetSettingRows(preset.bundle), [preset]);
  const headingId = `preset-detail-heading-${preset.id}`;

  return (
    <SlidePanel isOpen placement="inline" animateOnMount aria-labelledby={headingId}>
      <GlassCard glassVariant="liquid-refract">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
              {preset.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{preset.tagline}</p>
          </div>

          {applied ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded bg-admiralty-accent px-2.5 py-1 font-display text-[0.7rem] font-black uppercase tracking-wider text-admiralty-accent-foreground">
              <Check className="h-3 w-3" aria-hidden="true" />
              Active
            </span>
          ) : pending ? (
            <span className="shrink-0 font-display text-[0.65rem] uppercase tracking-wider text-muted-foreground">
              Applies on Next
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.field} className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-muted-foreground">{row.label}</dt>
                <dd className="text-sm font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </GlassCard>
    </SlidePanel>
  );
});
