import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import { limitReached, type ExerciseShipRow, type ExerciseState } from "./exercise-model.js";
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
          Annual fleet exercise
        </h3>
        <Badge variant="secondary" className="text-xs">
          {exercise.heldInNextExerciseYear} of {exercise.maxPerCalendarYear} in{" "}
          {exercise.nextExerciseYear}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Chosen ships exercise together in the month after you order it. They cost{" "}
        {exercise.maintenanceMultiple} times their active maintenance that month and cannot sail,
        fight or take missions. Their divisions gain {exercise.experienceGain} experience.
      </p>

      {loadError !== null && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/50 p-3 text-sm">
          <p className="whitespace-pre-line text-destructive">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={onReload}>
            Reload
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
          <span>The outcome of the last request is unknown.</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {scheduled !== undefined && (
        <p
          role="status"
          className="rounded-md border px-3 py-2 text-sm"
          data-testid="fleet-exercise-scheduled"
        >
          Exercise set for {scheduled.month} with {scheduled.shipIds.length}{" "}
          {scheduled.shipIds.length === 1 ? "ship" : "ships"}.
        </p>
      )}

      {exhausted ? (
        <p className="text-sm text-muted-foreground">
          The exercise for {exercise.nextExerciseYear} has already been ordered.
        </p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active, unassigned ships are available.</p>
      ) : (
        <Card>
          <CardContent className="space-y-1.5 p-4">
            {candidates.map((row) => (
              <label key={row.shipId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.includes(row.shipId)}
                  disabled={busy || !row.eligible}
                  onChange={() => onToggle(row.shipId)}
                  aria-label={`Exercise ${row.name}`}
                />
                <span>{row.name}</span>
                {row.exercising && (
                  <span className="text-xs text-muted-foreground">exercising</span>
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
          Hold fleet exercise
        </Button>
      )}
    </section>
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
