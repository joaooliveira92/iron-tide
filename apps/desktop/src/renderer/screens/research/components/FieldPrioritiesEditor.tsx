import { FlaskConical } from "lucide-react";
import { Button } from "../../../components/ui/button.js";
import { GlassSectionCard } from "../../../components/shared/GlassSectionCard.js";
import type { FieldWeightOption } from "../research-field-priorities.js";
import type { ResearchFieldRow } from "../research-view-model.js";
import { FieldPriorityRow } from "./FieldPriorityRow.js";

export interface FieldPrioritiesEditorProps {
  readonly fields: readonly ResearchFieldRow[];
  readonly highCount: number;
  readonly highCap: number;
  readonly highCountValid: boolean;
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly canSubmit: boolean;
  readonly onSetFieldWeight: (fieldId: string, weight: FieldWeightOption) => void;
  readonly onSubmit: () => void;
}

export function FieldPrioritiesEditor({
  fields,
  highCount,
  highCap,
  highCountValid,
  dirty,
  busy,
  canSubmit,
  onSetFieldWeight,
  onSubmit,
}: FieldPrioritiesEditorProps) {
  const highCapReached = highCount >= highCap;

  return (
    <GlassSectionCard
      icon={<FlaskConical className="h-4 w-4 text-muted-foreground" />}
      title="Field priorities"
      description="High (4) / Medium (2) / Low (1) weight scale; exactly 1..5 fields may stay High."
    >
      {dirty && (
        <p className="text-xs font-medium text-amber-600" role="status" aria-live="polite">
          Unsaved changes — draft differs from the last committed priorities
        </p>
      )}
      <div className="space-y-2.5">
        {fields.map((field) => (
          <FieldPriorityRow
            key={field.fieldId}
            field={field}
            highCapReached={highCapReached}
            highCap={highCap}
            busy={busy}
            onSetWeight={(weight) => onSetFieldWeight(field.fieldId, weight)}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          {highCount} high-priority field{highCount === 1 ? "" : "s"} (
          {highCountValid ? "within" : "outside"} the engine's 1..{highCap} limit)
          {highCount >= highCap ? " — lower a High field before raising another" : ""}
        </p>
        <Button onClick={onSubmit} disabled={!canSubmit || busy} size="sm">
          {busy ? "Applying…" : "Set priorities"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Queued priorities are applied by the engine on the <strong>next turn advance</strong> — the
        engine remains the only writer of research state. Projected points use the engine's
        largest-remainder split over the budget and current weights.
      </p>
    </GlassSectionCard>
  );
}
