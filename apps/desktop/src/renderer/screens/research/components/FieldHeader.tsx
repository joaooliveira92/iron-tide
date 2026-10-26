import { Progress } from "../../../components/ui/progress.js";
import { monthsPhrase } from "../research-calendar.js";
import type { FieldWeightOption } from "../research-field-priorities.js";
import type { ResearchFieldView } from "../research-view-model.js";
import { fieldIcon } from "./field-icons.js";
import { WeightControl } from "./WeightControl.js";

export interface FieldHeaderProps {
  readonly field: ResearchFieldView;
  readonly highCapReached: boolean;
  readonly highCap: number;
  readonly busy: boolean;
  readonly onSetWeight: (weight: FieldWeightOption) => void;
}

export function FieldHeader({
  field,
  highCapReached,
  highCap,
  busy,
  onSetWeight,
}: FieldHeaderProps) {
  const Icon = fieldIcon(field.fieldId);
  const active = field.activeTech;

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-base leading-tight font-medium">{field.label}</h3>
          <p className="text-xs text-muted-foreground">{field.stateNote}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {active !== null && (
          <div className="w-44 space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <span className="truncate font-medium">{active.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {active.etaMonths === null
                  ? "unfunded"
                  : active.etaMonths === 0
                    ? "next turn"
                    : `~${monthsPhrase(active.etaMonths)}`}
              </span>
            </div>
            <Progress value={active.progressPct} aria-label={`${active.label} progress`} />
          </div>
        )}
        <div className="text-right text-xs">
          <div className="text-base leading-tight font-medium tabular-nums">
            {field.projectedPoints} pts
          </div>
          <div className="text-muted-foreground">{field.sharePct}% of budget</div>
        </div>
        <WeightControl
          label={field.label}
          weight={field.weight}
          highBlocked={highCapReached}
          highCap={highCap}
          disabled={busy}
          onSetWeight={onSetWeight}
        />
      </div>
    </header>
  );
}
