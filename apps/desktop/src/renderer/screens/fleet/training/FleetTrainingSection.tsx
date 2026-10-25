import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import type { TrainingSubjectId } from "../../../../shared/fleet-contract.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import {
  adderText,
  canFundMore,
  fundedSubjects,
  progressText,
  toggledSubjects,
  TRAINING_SUBJECT_LABELS,
  type TrainingState,
} from "./training-model.js";
import { useSpecialTraining } from "./useSpecialTraining.js";

export interface FleetTrainingViewProps {
  readonly state: TrainingState;
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly outcomeUnknown: boolean;
  readonly onFund: (subjects: readonly TrainingSubjectId[]) => Promise<CommandOutcome>;
  readonly onRetry: () => void;
  readonly onReload: () => void;
}

export function FleetTrainingView({
  state,
  loadError,
  busy,
  outcomeUnknown,
  onFund,
  onRetry,
  onReload,
}: FleetTrainingViewProps) {
  const training = state.training;
  if (training === null) return null;
  const mayFundMore = canFundMore(training);
  return (
    <section
      className="space-y-3 border-t pt-4"
      data-testid="fleet-training"
      aria-labelledby="fleet-training-h"
    >
      <div className="flex items-center gap-2">
        <h3 id="fleet-training-h" className="text-sm font-medium">
          Special training
        </h3>
        <Badge variant="secondary" className="text-xs">
          {fundedSubjects(training).length} of {training.maxSubjects}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Fund up to {training.maxSubjects} subjects. A subject is proficient after{" "}
        {training.proficiencyMonths} funded months and is lost the moment you stop funding it.
        Training raises the maintenance of your active ships.
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

      <Card>
        <CardContent className="space-y-2 p-4">
          {training.subjects.map((subject) => {
            const disabled = busy || (!subject.funded && !mayFundMore);
            return (
              <div
                key={subject.subject}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="flex flex-col">
                  <span className="font-medium">{TRAINING_SUBJECT_LABELS[subject.subject]}</span>
                  <span className="text-xs text-muted-foreground">
                    {adderText(subject.maintenanceAdderBp)}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {progressText(subject, training.proficiencyMonths)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={subject.funded ? "default" : "outline"}
                  disabled={disabled}
                  aria-pressed={subject.funded}
                  aria-label={`${subject.funded ? "Stop funding" : "Fund"} ${TRAINING_SUBJECT_LABELS[subject.subject]}`}
                  title={
                    !subject.funded && !mayFundMore
                      ? `At most ${training.maxSubjects} subjects can be funded at once`
                      : undefined
                  }
                  onClick={() => void onFund(toggledSubjects(training, subject.subject))}
                >
                  {subject.funded ? "Stop funding" : "Fund"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

export function FleetTrainingSection({ sessionId }: { readonly sessionId: string }) {
  const training = useSpecialTraining(sessionId);
  return (
    <FleetTrainingView
      state={training.state}
      loadError={training.loadError}
      busy={training.busy}
      outcomeUnknown={training.outcomeUnknown}
      onFund={training.fund}
      onRetry={training.retry}
      onReload={training.reload}
    />
  );
}
