import { Anchor, Check } from "lucide-react";
import { Button } from "../../components/ui/button.js";
import { GlassCard } from "../../components/ui/glass-card.js";
import { NewGameScreenLayout } from "./components/NewGameScreenLayout.js";
import { ScreenHeader } from "./components/ScreenHeader.js";
import { useWorldGenerationChecklist } from "./useWorldGenerationChecklist.js";
import { CHECKLIST_LINES } from "./world-generation-presentation.js";

export interface NewGameLaunchingScreenProps {
  readonly error: string | null;
  readonly onBackToReview: () => void;
}

export function NewGameLaunchingScreen({ error, onBackToReview }: NewGameLaunchingScreenProps) {
  const { revealedCount, flavorText } = useWorldGenerationChecklist(error === null);

  if (error !== null) {
    return (
      <NewGameScreenLayout size="sm" centered>
        <ScreenHeader
          icon={<Anchor className="h-5 w-5" />}
          title="Commissioning failed"
          description={error}
        />
        <Button type="button" variant="outline" onClick={onBackToReview}>
          Back to Commissioning Review
        </Button>
      </NewGameScreenLayout>
    );
  }

  return (
    <NewGameScreenLayout size="sm" centered>
      <ScreenHeader
        icon={<Anchor className="h-5 w-5" />}
        title="Establishing the Naval Order"
        description={flavorText}
      />
      <GlassCard glassVariant="liquid-refract" className="w-full">
        <ul className="flex flex-col gap-2 p-6 text-sm">
          {CHECKLIST_LINES.slice(0, revealedCount).map((line) => (
            <li key={line} className="flex items-center gap-2 text-muted-foreground">
              <Check className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </NewGameScreenLayout>
  );
}
