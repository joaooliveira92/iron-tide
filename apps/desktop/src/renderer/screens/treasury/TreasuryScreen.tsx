import { Wallet } from "lucide-react";
import { ScreenStage } from "../../components/shared/ScreenStage.js";
import { useCampaignProjection } from "../../lib/use-campaign-projection.js";
import {
  BudgetAtAGlanceCard,
  BudgetPolicyPanel,
  TreasuryLoadErrorState,
  TreasuryLoadingState,
  TreasurySummaryCards,
} from "./components/index.js";
import { summarizeTreasury } from "./treasury-summary.js";

export interface TreasuryScreenProps {
  readonly sessionId: string;
}

export function TreasuryScreen({ sessionId }: TreasuryScreenProps) {
  const { projection, loadError } = useCampaignProjection(sessionId);

  if (loadError !== null) return <TreasuryLoadErrorState message={loadError} />;
  if (projection === null) return <TreasuryLoadingState />;

  const breakdown = summarizeTreasury(projection);

  return (
    <ScreenStage
      guidedTarget="treasury"
      className="space-y-8"
      icon={Wallet}
      title="Treasury"
      description="Government naval allocation, expenditure, and projected position. Set the appropriation rate and research budget below."
    >
      <BudgetAtAGlanceCard breakdown={breakdown} />

      <BudgetPolicyPanel sessionId={sessionId} />

      <TreasurySummaryCards breakdown={breakdown} />
    </ScreenStage>
  );
}
