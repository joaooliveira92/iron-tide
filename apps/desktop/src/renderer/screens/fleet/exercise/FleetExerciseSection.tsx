import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import { useMemo } from "react";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import type { FleetExerciseTensionPreview } from "../../../../shared/fleet-contract.js";
import { campaignNationLabel } from "../../../content/presentationContent.js";
import { translate } from "../../../lib/strings.js";
import {
  limitReached,
  tensionOutlook,
  type ExerciseShipRow,
  type ExerciseState,
} from "./exercise-model.js";
import { useFleetExercise } from "./useFleetExercise.js";

export interface FleetExerciseViewProps {
  readonly state: ExerciseState;
  readonly rows: readonly ExerciseShipRow[];
  readonly selected: readonly string[];
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly outcomeUnknown: boolean;
  readonly onToggle: (shipId: string) => void;
  readonly onHold: () => Promise<CommandOutcome>;
  readonly onRetry: () => void;
  readonly onReload: () => void;
}

export function FleetExerciseView({
  state,
  rows,
  selected,
  loadError,
  busy,
  outcomeUnknown,
  onToggle,
  onHold,
  onRetry,
  onReload,
}: FleetExerciseViewProps) {
  const format = usePresentationFormat();
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const exercise = state.exercise;
  if (exercise === null) return null;
  const scheduled = exercise.scheduled;
  const exhausted = limitReached(exercise);
  const candidates = rows.filter((row) => row.eligible || row.exercising);
  return (
    <section
      className="space-y-3 border-t pt-4"
      data-testid="fleet-exercise"
      aria-labelledby="fleet-exercise-h"
    >
      <div className="flex items-center gap-2">
        <h3 id="fleet-exercise-h" className="text-sm font-medium">
          {translate("fleet.exercise.heading")}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {translate("fleet.exercise.badge", {
            held: exercise.heldInNextExerciseYear,
            max: exercise.maxPerCalendarYear,
            year: exercise.nextExerciseYear,
          })}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {translate("fleet.exercise.intro", {
          multiple: exercise.maintenanceMultiple,
          gain: exercise.experienceGain,
        })}
      </p>
      {exercise.experienceGainExplanation !== undefined && (
        <ExplanationDisclosure
          tree={exercise.experienceGainExplanation}
          area="fleet"
          summaryKey="fleet.fleet_exercise_gain.summary"
          format={format}
          testId="fleet-exercise-gain-explanation"
        />
      )}
      {exercise.tensionPreview !== undefined && !exhausted && (
        <TensionPreview preview={exercise.tensionPreview} selectedCount={selected.length} />
      )}

      {loadError !== null && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/50 p-3 text-sm">
          <p className="whitespace-pre-line text-destructive">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={onReload}>
            {translate("fleet.exercise.reload")}
          </Button>
        </div>
      )}
      {state.notice !== null && (
        <div role="status" className="rounded-md border px-3 py-2 text-sm">
          <p className="whitespace-pre-line">{state.notice}</p>
        </div>
      )}
      {outcomeUnknown && (
        <div role="alert" className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span>{translate("fleet.exercise.outcomeUnknown")}</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {translate("fleet.exercise.retry")}
          </Button>
        </div>
      )}

      {scheduled !== undefined && (
        <p
          role="status"
          className="rounded-md border px-3 py-2 text-sm"
          data-testid="fleet-exercise-scheduled"
        >
          {translate(
            scheduled.shipIds.length === 1
              ? "fleet.exercise.scheduled.one"
              : "fleet.exercise.scheduled.many",
            { month: scheduled.month, n: scheduled.shipIds.length },
          )}
        </p>
      )}

      {exhausted ? (
        <p className="text-sm text-muted-foreground">
          {translate("fleet.exercise.limitReached", { year: exercise.nextExerciseYear })}
        </p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">{translate("fleet.exercise.noShips")}</p>
      ) : (
        <Card>
          <CardContent className="space-y-1.5 p-4">
            {candidates.map((row) => (
              <label key={row.shipId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selectedIds.has(row.shipId)}
                  disabled={busy || !row.eligible}
                  onChange={() => onToggle(row.shipId)}
                  aria-label={translate("fleet.exercise.shipLabel", { name: row.name })}
                />
                <span>{row.name}</span>
                {row.exercising && (
                  <span className="text-xs text-muted-foreground">
                    {translate("fleet.exercise.exercising")}
                  </span>
                )}
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {!exhausted && (
        <Button
          type="button"
          size="sm"
          disabled={busy || selected.length === 0}
          onClick={() => void onHold()}
        >
          {translate("fleet.exercise.hold")}
        </Button>
      )}
    </section>
  );
}

function TensionPreview({
  preview,
  selectedCount,
}: {
  readonly preview: FleetExerciseTensionPreview;
  readonly selectedCount: number;
}) {
  const format = usePresentationFormat();
  const outlook = tensionOutlook(preview, selectedCount);
  const powers = outlook.rows.length;
  return (
    <div className="space-y-1 text-xs" data-testid="fleet-exercise-tension">
      <p className="font-medium">{translate("fleet.exercise.tension.heading")}</p>
      {outlook.belowThreshold ? (
        <p className="text-muted-foreground">
          {translate("fleet.exercise.tension.below", { min: preview.minShips })}
        </p>
      ) : powers === 0 ? (
        <p className="text-muted-foreground">{translate("fleet.exercise.tension.none")}</p>
      ) : (
        <>
          <p>
            {translate(
              powers === 1 ? "fleet.exercise.tension.one" : "fleet.exercise.tension.many",
              { n: powers, step: preview.increase, ceiling: preview.ceiling },
            )}
          </p>
          <ul className="space-y-0.5 pl-3 text-muted-foreground">
            {outlook.rows.map((row) => (
              <li key={row.otherNationId}>
                {translate("fleet.exercise.tension.row", {
                  nation: campaignNationLabel(row.otherNationId),
                  before: row.before,
                  after: row.after,
                })}
              </li>
            ))}
          </ul>
        </>
      )}
      <ExplanationDisclosure
        tree={preview.explanation}
        area="fleet"
        summaryKey="fleet.fleet_exercise_tension.summary"
        format={format}
        testId="fleet-exercise-tension-explanation"
      />
    </div>
  );
}

export function FleetExerciseSection({ sessionId }: { readonly sessionId: string }) {
  const exercise = useFleetExercise(sessionId);
  return (
    <FleetExerciseView
      state={exercise.state}
      rows={exercise.rows}
      selected={exercise.selected}
      loadError={exercise.loadError}
      busy={exercise.busy}
      outcomeUnknown={exercise.outcomeUnknown}
      onToggle={exercise.toggle}
      onHold={exercise.hold}
      onRetry={exercise.retry}
      onReload={exercise.reload}
    />
  );
}
