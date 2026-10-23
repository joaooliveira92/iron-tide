import { Wallet } from "lucide-react";
import { ScreenStage } from "../../components/shared/ScreenStage.js";
import { useCampaignProjection } from "../../lib/use-campaign-projection.js";
import { usePresentationFormat } from "../../shell/usePresentationFormat.js";
import {
  BudgetPolicyPanel,
  TreasuryLoadErrorState,
  TreasuryLoadingState,
  TreasuryStage,
  TreasuryStatusBar,
} from "./components/index.js";
import { useBudgetPolicy } from "./hooks/useBudgetPolicyPanel.js";
import { treasuryReadouts } from "./treasury-readouts.js";
import { summarizeTreasury } from "./treasury-summary.js";

export interface TreasuryScreenProps {
  readonly sessionId: string;
}

export function TreasuryScreen({ sessionId }: TreasuryScreenProps) {
  const { projection, loadError } = useCampaignProjection(sessionId);
  const policy = useBudgetPolicy(sessionId);
  const format = usePresentationFormat();

  if (loadError !== null) return <TreasuryLoadErrorState message={loadError} />;
  if (projection === null) return <TreasuryLoadingState />;

  const breakdown = summarizeTreasury(projection);

  return (
    <ScreenStage
      guidedTarget="treasury"
      className="space-y-4"
      icon={Wallet}
      title="Treasury"
      description="Where this month's appropriation goes, and the two dials that set it."
    >
      <div
        data-testid="treasury-workspace"
        className="grid min-h-[30rem] grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-lg border bg-background"
      >
        <div className="grid min-h-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <TreasuryStage
            breakdown={breakdown}
            commitments={policy.controller.state.commitments}
            previewResearch={policy.vm.previewResearch}
            pendingRateChange={policy.vm.rateChanged}
          />
          <BudgetPolicyPanel policy={policy} />
        </div>
        <TreasuryStatusBar readouts={treasuryReadouts(breakdown, format)} />
      </div>
    </ScreenStage>
  );
}
