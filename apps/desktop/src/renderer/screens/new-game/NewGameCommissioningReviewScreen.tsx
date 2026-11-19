import type { ArchetypeSelection } from "@bluewave/campaign-engine";
import { Anchor } from "lucide-react";
import { Button } from "../../components/ui/button.js";
import type { SetPrimaryAction } from "../../shell/primary-action.js";
import { COMMISSIONING_GROUP_ICONS } from "./components/commissioning-review-icons.js";
import { ReviewSection } from "./components/commissioning-review/ReviewSection.js";
import { StrategicForecastCard } from "./components/commissioning-review/StrategicForecastCard.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
import { ScreenHeader } from "./components/ScreenHeader.js";
import type { FleetMethodDraft } from "./new-game-fleet-method-screen-state.js";
import type { CampaignIdentityDraft } from "./new-game-identity-screen-state.js";
import type { DraftPreferences } from "./new-game-preferences-screen-state.js";
import { useCommissioningReview } from "./useCommissioningReview.js";
import type { NewGameOptions } from "../../../shared/new-game-contract.js";

export interface NewGameCommissioningReviewScreenProps {
  readonly nationId: string;
  readonly options: NewGameOptions | null;
  readonly preferences: DraftPreferences;
  readonly archetype: ArchetypeSelection;
  readonly identity: CampaignIdentityDraft;
  readonly fleetMethod: FleetMethodDraft;
  readonly status: "ready" | "launching";
  readonly error: string | null;
  readonly onBack: () => void;
  readonly onBeginCommission: () => void;
  readonly onPrimaryActionChange: SetPrimaryAction;
}

export function NewGameCommissioningReviewScreen({
  nationId,
  options,
  preferences,
  archetype,
  identity,
  fleetMethod,
  status,
  error,
  onBack,
  onBeginCommission,
  onPrimaryActionChange,
}: NewGameCommissioningReviewScreenProps) {
  const launching = status === "launching";
  const { sections, presetLabel, forecast } = useCommissioningReview({
    nationId,
    options,
    preferences,
    archetype,
    identity,
    fleetMethod,
    launching,
    onBeginCommission,
    onPrimaryActionChange,
  });

  return (
    <NewGameScreenLayout>
      <ScreenHeader
        icon={<Anchor className="h-5 w-5" />}
        title="Final commissioning review"
        description="Confirm every decision before your appointment is commissioned."
      />

      {error !== null && <p className="text-sm text-destructive">{error}</p>}

      {sections.map((section) => (
        <ReviewSection
          key={section.group}
          title={section.title}
          ariaLabel={section.ariaLabel}
          icon={COMMISSIONING_GROUP_ICONS[section.group]}
          note={
            section.group === "uncertainty" ? `Rules of the Naval Age: ${presetLabel}` : undefined
          }
          rows={section.rows}
        />
      ))}

      {forecast !== null && <StrategicForecastCard forecast={forecast} />}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={launching}>
          Back to Fleet Method
        </Button>
      </div>
    </NewGameScreenLayout>
  );
}
