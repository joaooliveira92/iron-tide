import { useState } from "react";

import type { BudgetSegmentId } from "../budget-bar.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";
import { FlowBar } from "./FlowBar.js";
import { Ledger } from "./Ledger.js";
import { PositionBrief } from "./PositionBrief.js";

export interface TreasuryStageProps {
  readonly breakdown: TreasuryBreakdown;
  readonly previewResearch: number | null;
  readonly pendingRateChange: boolean;
}

export function TreasuryStage({
  breakdown,
  previewResearch,
  pendingRateChange,
}: TreasuryStageProps) {
  const [active, setActive] = useState<BudgetSegmentId | null>(null);
  return (
    <div className="themed-scrollbar min-h-0 space-y-6 overflow-y-auto p-4">
      <PositionBrief breakdown={breakdown} pendingRateChange={pendingRateChange} />
      <FlowBar
        breakdown={breakdown}
        previewResearch={previewResearch}
        active={active}
        onActive={setActive}
      />
      <Ledger
        breakdown={breakdown}
        previewResearch={previewResearch}
        active={active}
        onActive={setActive}
      />
    </div>
  );
}
