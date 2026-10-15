import type { BattleResolution, TacticalBattleOutcome } from "@bluewave/campaign-engine";

import { Accordion } from "../../../components/ui/accordion.js";
import { AutoResolutionSummary } from "./AutoResolutionSummary.js";
import { TacticalOutcomeSummary } from "./TacticalOutcomeSummary.js";

interface BattleResolutionPanelProps {
  readonly autoResolution: BattleResolution | null;
  readonly tacticalOutcome: TacticalBattleOutcome | null;
}

/** Collapsible results of whichever battle resolvers have run this session. */
export function BattleResolutionPanel({
  autoResolution,
  tacticalOutcome,
}: BattleResolutionPanelProps) {
  if (autoResolution === null && tacticalOutcome === null) return null;

  return (
    <Accordion multiple defaultValue={["auto", "tactical"]}>
      {autoResolution !== null && <AutoResolutionSummary resolution={autoResolution} />}
      {tacticalOutcome !== null && <TacticalOutcomeSummary outcome={tacticalOutcome} />}
    </Accordion>
  );
}
