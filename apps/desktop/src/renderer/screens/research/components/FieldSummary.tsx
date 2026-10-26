import { Progress } from "../../../components/ui/progress.js";
import { SlateBody, SlateFacts, SlateHeader } from "../../../components/ui/slate.js";
import { monthsPhrase } from "../research-calendar.js";
import type { ResearchFieldView } from "../research-view-model.js";

export function FieldSummary({ field }: { readonly field: ResearchFieldView }) {
  const active = field.activeTech;
  return (
    <>
      <SlateHeader
        title={field.label}
        aside={<span className="text-xs text-muted-foreground">{field.weightLabel} priority</span>}
      />
      <SlateBody className="text-xs">
        <SlateFacts
          rows={[
            {
              label: "Next turn",
              value: `${String(field.projectedPoints)} pts · ${String(field.sharePct)}% of budget`,
            },
            {
              label: "Discovered",
              value: `${String(field.discoveredTechs)} of ${String(field.totalTechs)}`,
            },
          ]}
        />
        {active !== null && (
          <div className="space-y-1 rounded-md border border-border/50 bg-muted/30 p-2">
            <div className="font-medium">{active.label}</div>
            <Progress value={active.progressPct} aria-label={`${active.label} progress`} />
            <div className="text-muted-foreground tabular-nums">
              {active.investedPoints} / {active.cost} pts
              {active.etaMonths !== null && active.etaMonths > 0
                ? ` · about ${monthsPhrase(active.etaMonths)}`
                : ""}
            </div>
          </div>
        )}
        <p className="text-muted-foreground">{field.stateNote}</p>
      </SlateBody>
    </>
  );
}
