import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs.js";
import { usePresentationFormat } from "../../../shell/usePresentationFormat.js";
import type { TreasuryCommitments } from "../../../../shared/budget-contract.js";
import type { BudgetSegmentId } from "../budget-bar.js";
import type { TreasuryBreakdown } from "../treasury-summary.js";
import { ConstructionTab } from "./ConstructionTab.js";
import { FleetUpkeepTab } from "./FleetUpkeepTab.js";
import { FlowBar } from "./FlowBar.js";
import { Ledger, type LedgerDetail } from "./Ledger.js";
import { PositionBrief } from "./PositionBrief.js";

export type StageTab = "flow" | LedgerDetail;

export interface TreasuryStageProps {
  readonly breakdown: TreasuryBreakdown;
  readonly commitments: TreasuryCommitments | null;
  readonly previewResearch: number | null;
  readonly pendingRateChange: boolean;
}

export function TreasuryStage({
  breakdown,
  commitments,
  previewResearch,
  pendingRateChange,
}: TreasuryStageProps) {
  const format = usePresentationFormat();
  const [active, setActive] = useState<BudgetSegmentId | null>(null);
  const [tab, setTab] = useState<StageTab>("flow");
  const loading = commitments === null;

  return (
    <Tabs
      value={tab}
      onValueChange={(next) => setTab(next as StageTab)}
      className="flex min-h-0 flex-col"
    >
      <div className="border-b px-4 py-2">
        <TabsList aria-label="Treasury views" variant="line">
          <TabsTrigger value="flow">Monthly flow</TabsTrigger>
          <TabsTrigger value="fleet" disabled={loading}>
            Fleet upkeep
            {commitments !== null && (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {format.count(commitments.fleet.total)}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="construction" disabled={loading}>
            Construction
            {commitments !== null && (
              <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">
                {format.count(
                  commitments.construction.drawTotal + commitments.construction.carryingTotal,
                )}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>
      <div className="themed-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        {tab === "flow" && (
          <>
            <PositionBrief
              breakdown={breakdown}
              pendingRateChange={pendingRateChange}
              unpaidCostsPrestige={commitments?.unpaidCostsPrestige ?? null}
            />
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
              onOpen={setTab}
            />
          </>
        )}
        {tab === "fleet" && commitments !== null && (
          <FleetUpkeepTab fleet={commitments.fleet} income={breakdown.income} />
        )}
        {tab === "construction" && commitments !== null && (
          <ConstructionTab construction={commitments.construction} income={breakdown.income} />
        )}
      </div>
    </Tabs>
  );
}
