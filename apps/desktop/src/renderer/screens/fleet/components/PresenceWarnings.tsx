import { memo } from "react";
import type { PresenceWarningView } from "../../../../shared/fleet-contract.js";
import { ExplanationDisclosure } from "../../../components/shared/ExplanationDisclosure.js";
import { translate } from "../../../lib/strings.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import { format } from "../station/fleet-station-state.js";

export const PresenceWarnings = memo(function PresenceWarnings({
  warnings,
  areaName,
}: {
  readonly warnings: readonly PresenceWarningView[];
  readonly areaName: (areaId: string) => string;
}) {
  const presentation = usePresentationFormat();
  if (warnings.length === 0) return null;
  return (
    <section
      role="status"
      className="space-y-1 border-l-2 border-admiralty-border pl-3 text-sm"
      data-testid="fleet-presence-warnings"
    >
      <h4 className="font-medium">{translate("fleet.presenceWarning.title")}</h4>
      <ul className="space-y-1">
        {warnings.map((warning) => (
          <li key={warning.areaId} data-testid={`fleet-presence-warning-${warning.areaId}`}>
            {format("fleet.presenceWarning.row", {
              station: areaName(warning.areaId),
              present: warning.presentTonsAfter,
              required: warning.requiredTons,
              shortfall: warning.shortfallAfter,
              before: warning.shortfallBefore,
            })}
            <ExplanationDisclosure
              tree={warning.explanation}
              area="fleet"
              summaryKey="fleet.fleet_presence.summary"
              format={presentation}
              testId={`fleet-presence-warning-explanation-${warning.areaId}`}
            />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{translate("fleet.presenceWarning.advice")}</p>
    </section>
  );
});
