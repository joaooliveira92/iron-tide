import { useState } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { TrainingSubjectId } from "../../../../shared/fleet-contract.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import {
  adderText,
  fundedSubjects,
  progressText,
  sameSubjects,
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
  const format = usePresentationFormat();
  const training = state.training;
  const authoritative = training === null ? [] : fundedSubjects(training);
  const authoritativeKey = authoritative.join("\u0000");
  const [draft, setDraft] = useState<TrainingSubjectId[]>(authoritative);
  const [syncedKey, setSyncedKey] = useState(authoritativeKey);
  if (syncedKey !== authoritativeKey) {
    setSyncedKey(authoritativeKey);
    setDraft(authoritative);
  }
  if (training === null) return null;
  const dirty = !sameSubjects(draft, authoritative);
  const atLimit = draft.length >= training.maxSubjects;
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
          {authoritative.length} of {training.maxSubjects}
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
            const chosen = draft.includes(subject.subject);
            return (
              <div key={subject.subject} className="space-y-0.5">
                <label className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={chosen}
                      disabled={busy || (!chosen && atLimit)}
                      title={
                        !chosen && atLimit
                          ? `At most ${training.maxSubjects} subjects can be funded at once`
                          : undefined
                      }
                      onChange={() =>
                        setDraft((current) =>
                          chosen
                            ? current.filter((candidate) => candidate !== subject.subject)
                            : [...current, subject.subject],
                        )
                      }
                      aria-label={`Fund ${TRAINING_SUBJECT_LABELS[subject.subject]}`}
                    />
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {TRAINING_SUBJECT_LABELS[subject.subject]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {adderText(subject.maintenanceAdderBp)}
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {progressText(subject, training.proficiencyMonths)}
                  </span>
                </label>
                {subject.maintenanceAdderExplanation !== undefined && (
                  <div className="pl-6">
                    <ExplanationDisclosure
                      tree={subject.maintenanceAdderExplanation}
                      area="fleet"
                      summaryKey="fleet.fleet_training_adder.summary"
                      format={format}
                      testId={`fleet-training-adder-${subject.subject}`}
                    />
                  </div>
                )}
                {subject.progressExplanation !== undefined && (
                  <div className="pl-6">
                    <ExplanationDisclosure
                      tree={subject.progressExplanation}
                      area="fleet"
                      summaryKey="fleet.fleet_training_progress.summary"
                      format={format}
                      testId={`fleet-training-progress-${subject.subject}`}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || !dirty}
          onClick={() => void onFund(draft)}
        >
          Apply training
        </Button>
        {dirty && draft.length < authoritative.length && (
          <span className="text-xs text-muted-foreground">
            Dropped subjects lose their progress.
          </span>
        )}
      </div>
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
