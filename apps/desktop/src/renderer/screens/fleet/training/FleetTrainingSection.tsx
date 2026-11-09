import { useState } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { Button } from "../../../components/ui/button.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { TrainingSubjectId } from "../../../../shared/fleet-contract.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import { format as message } from "../station/fleet-station-state.js";
import {
  adderText,
  effectText,
  fundedSubjects,
  progressText,
  sameSubjects,
  selectionFor,
  subjectLabel,
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
  const draftSelection = selectionFor(training, draft);
  return (
    <section
      className="space-y-3 border-t pt-4"
      data-testid="fleet-training"
      aria-labelledby="fleet-training-h"
    >
      <div className="flex items-center gap-2">
        <h3 id="fleet-training-h" className="text-sm font-medium">
          {message("fleet.training.heading")}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {message("fleet.training.badge", {
            funded: authoritative.length,
            max: training.maxSubjects,
          })}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {message("fleet.training.intro", {
          max: training.maxSubjects,
          months: training.proficiencyMonths,
        })}
      </p>
      <p className="text-xs text-muted-foreground" data-testid="fleet-training-battle-only">
        {message("fleet.training.battleOnly")}
      </p>

      {loadError !== null && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/50 p-3 text-sm">
          <p className="whitespace-pre-line text-destructive">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={onReload}>
            {message("fleet.training.reload")}
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
          <span>{message("fleet.training.outcomeUnknown")}</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {message("fleet.training.retry")}
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
                          ? message("fleet.training.limitTooltip", { max: training.maxSubjects })
                          : undefined
                      }
                      onChange={() =>
                        setDraft((current) =>
                          chosen
                            ? current.filter((candidate) => candidate !== subject.subject)
                            : [...current, subject.subject],
                        )
                      }
                      aria-label={message("fleet.training.fundLabel", {
                        subject: subjectLabel(subject.subject),
                      })}
                    />
                    <span className="flex flex-col">
                      <span className="font-medium">{subjectLabel(subject.subject)}</span>
                      <span className="text-xs text-muted-foreground">
                        {adderText(subject.maintenanceAdderBp)}
                      </span>
                      <span
                        className="text-xs"
                        data-testid={`fleet-training-cost-${subject.subject}`}
                      >
                        {message("fleet.training.cost", {
                          cost: format.money(subject.monthlyCost),
                        })}
                      </span>
                      <span
                        className="text-xs text-muted-foreground"
                        data-testid={`fleet-training-effect-${subject.subject}`}
                      >
                        {effectText(subject.subject, subject.effectBp)}
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
                {subject.monthlyCostExplanation !== undefined && (
                  <div className="pl-6">
                    <ExplanationDisclosure
                      tree={subject.monthlyCostExplanation}
                      area="fleet"
                      summaryKey="fleet.fleet_training_cost.summary"
                      format={format}
                      testId={`fleet-training-cost-explanation-${subject.subject}`}
                    />
                  </div>
                )}
                {subject.effectExplanation !== undefined && (
                  <div className="pl-6">
                    <ExplanationDisclosure
                      tree={subject.effectExplanation}
                      area="fleet"
                      summaryKey="fleet.fleet_training_effect.summary"
                      format={format}
                      testId={`fleet-training-effect-explanation-${subject.subject}`}
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

      {draftSelection !== undefined && (
        <div className="space-y-1" data-testid="fleet-training-total">
          <p className="text-sm font-medium">
            {draft.length === 0
              ? message("fleet.training.totalNone")
              : message("fleet.training.total", { cost: format.money(draftSelection.monthlyCost) })}
          </p>
          {draftSelection.monthlyCostExplanation !== undefined && draft.length > 0 && (
            <ExplanationDisclosure
              tree={draftSelection.monthlyCostExplanation}
              area="fleet"
              summaryKey="fleet.fleet_training_cost.summary"
              format={format}
              testId="fleet-training-total-explanation"
            />
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || !dirty}
          onClick={() => void onFund(draft)}
        >
          {message("fleet.training.apply")}
        </Button>
        {dirty && draft.length < authoritative.length && (
          <span className="text-xs text-muted-foreground">{message("fleet.training.dropped")}</span>
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
