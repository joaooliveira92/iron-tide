import {
  ARCHETYPE_POINT_TOTAL,
  type ArchetypeAllocation,
  type ArchetypeDimension,
  type ArchetypePreset,
} from "@bluewave/campaign-engine";
import { Check, Plus, RotateCcw } from "lucide-react";
import { memo, useMemo } from "react";
import { SlidePanel } from "@/components/slide-panel/index.js";
import { Button } from "@/components/ui/button.js";
import { CardContent, CardHeader } from "@/components/ui/card.js";
import { GlassCard } from "@/components/ui/glass-card.js";
import { buildArchetypeConsequence } from "../../archetype-consequence.js";
import { ARCHETYPE_DIMENSION_DESCRIPTORS } from "../../archetype-dimensions.js";
import { ArchetypeConsequencePanel } from "../../ArchetypeConsequencePanel.js";
import { ArchetypeAllocationEditor } from "./ArchetypeAllocationEditor.js";

/** What the custom slot's panel needs to edit its allocation in place. */
export interface ArchetypeDetailEditor {
  /** Points the working allocation spends. */
  readonly points: number;
  /** The engine validator's diagnostics; empty when the allocation is valid. */
  readonly errors: readonly string[];
  readonly onDimensionChange: (dimension: ArchetypeDimension, value: number) => void;
  /** Return the working allocation to the balanced baseline. */
  readonly onReset: () => void;
}

export interface ArchetypeDetailPanelProps {
  /** The focused slot: a named preset, or the custom-build slot. */
  readonly entry: {
    readonly preset?: ArchetypePreset;
  };
  /** The allocation whose consequences are shown (the preset's or the custom build). */
  readonly allocation: ArchetypeAllocation;
  /** Whether the previewed slot's selection is the one currently applied. */
  readonly applied: boolean;
  /** Previewed and not yet applied: the step's primary action will apply it. */
  readonly pending: boolean;
  /**
   * Makes the custom slot's body the editable allocator instead of a read-only
   * allocation. Ignored for preset slots.
   */
  readonly editor?: ArchetypeDetailEditor;
}

/**
 * The detail pane's focused-archetype slide panel: name and tagline, the
 * three-dimension allocation, and the live consequence preview — with an Active
 * state, or a note that the step's primary action will apply it. The panel has
 * no control of its own: applying is Enter, a tap on the card, or the primary
 * action. Keyed by slot in the caller, so it eases in again each time focus
 * moves. The custom slot's body is the allocator itself when an `editor` is
 * given: the one editable detail slot, validated by the engine upstream.
 */
export const ArchetypeDetailPanel = memo(function ArchetypeDetailPanel({
  entry,
  allocation,
  applied,
  pending,
  editor,
}: ArchetypeDetailPanelProps) {
  const isCustom = entry.preset === undefined;
  const name = isCustom ? "Create Your Own" : entry.preset.name;
  const tagline = isCustom
    ? `Distribute exactly ${ARCHETYPE_POINT_TOTAL} points across three engine-backed attributes.`
    : entry.preset.tagline;

  const consequence = useMemo(() => buildArchetypeConsequence(allocation), [allocation]);
  const headingId = `archetype-detail-heading-${isCustom ? "custom" : entry.preset.id}`;

  const allocationRows = useMemo(
    () =>
      ARCHETYPE_DIMENSION_DESCRIPTORS.map((descriptor) => (
        <div key={descriptor.dimension} className="flex items-baseline justify-between gap-3">
          <dt className="text-sm text-muted-foreground">{descriptor.label}</dt>
          <dd className="text-sm font-medium tabular-nums">{allocation[descriptor.dimension]}</dd>
        </div>
      )),
    [allocation],
  );

  return (
    <SlidePanel isOpen placement="inline" animateOnMount aria-labelledby={headingId}>
      <GlassCard glassVariant="liquid-refract">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={headingId} className="text-lg font-semibold tracking-tight">
              {name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
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

        <CardContent className="space-y-5 pt-0">
          {!isCustom && entry.preset.description !== undefined && (
            <p className="text-sm text-muted-foreground">{entry.preset.description}</p>
          )}

          {isCustom && editor !== undefined ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="min-w-0 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Allocation
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={editor.onReset}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset
                  </Button>
                </div>
                <ArchetypeAllocationEditor
                  allocation={allocation}
                  points={editor.points}
                  errors={editor.errors}
                  onDimensionChange={editor.onDimensionChange}
                />
              </div>

              <div className="min-w-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Live preview
                </p>
                <ArchetypeConsequencePanel consequence={consequence} compact />
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {isCustom && <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  Allocation
                </p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {allocationRows}
                </dl>
              </div>

              <ArchetypeConsequencePanel consequence={consequence} compact />
            </>
          )}
        </CardContent>
      </GlassCard>
    </SlidePanel>
  );
});
