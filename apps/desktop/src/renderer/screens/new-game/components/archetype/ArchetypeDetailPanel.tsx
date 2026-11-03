import { ARCHETYPE_POINT_TOTAL } from "@bluewave/campaign-engine";
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
import { useArchetypeActions, useArchetypeMeta } from "./ArchetypeWorkspaceProvider.js";

export const ArchetypeDetailPanel = memo(function ArchetypeDetailPanel() {
  const { detail } = useArchetypeMeta();
  const { changeDimension, resetDraft } = useArchetypeActions();
  const { entry, allocation, applied, pending, points, errors } = detail;

  const consequence = useMemo(() => buildArchetypeConsequence(allocation), [allocation]);
  const isCustom = entry.kind === "custom";
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
              {isCustom ? "Create Your Own" : entry.preset.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isCustom
                ? `Distribute exactly ${ARCHETYPE_POINT_TOTAL} points across three engine-backed attributes.`
                : entry.preset.tagline}
            </p>
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
          {isCustom ? (
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
                    onClick={resetDraft}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset
                  </Button>
                </div>
                <ArchetypeAllocationEditor
                  allocation={allocation}
                  points={points}
                  errors={errors}
                  onDimensionChange={changeDimension}
                />
              </div>

              <div className="min-w-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Live preview
                </p>
                <ArchetypeConsequencePanel consequence={consequence} />
              </div>
            </div>
          ) : (
            <>
              {entry.preset.description !== undefined && (
                <p className="text-sm text-muted-foreground">{entry.preset.description}</p>
              )}

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Allocation
                </p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
                  {allocationRows}
                </dl>
              </div>

              <ArchetypeConsequencePanel consequence={consequence} />
            </>
          )}
        </CardContent>
      </GlassCard>
    </SlidePanel>
  );
});
